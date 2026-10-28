import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, db } from '../lib/supabase';
import { useDiscord } from '../store/discordStore';
import { useVoiceStreamStore } from '../store/voiceStreamStore';
import { User, VoiceParticipant } from '../types/discord';
import { presenceAction } from './social';

const SESSION_STORAGE_KEY = 'capychat_presence_session_id';

class PresenceService {
  private sessionId: string;
  private heartbeatInterval: any = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private currentCommunityId: string | null = null;
  private isTracking = false;

  constructor() {
    this.sessionId = this.initSessionId();
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.stop();
      });
    }
  }

  private initSessionId(): string {
    if (typeof window === 'undefined') {
      return '00000000-0000-0000-0000-000000000000';
    }
    try {
      let id = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!id || !uuidRegex.test(id)) {
        id = crypto.randomUUID();
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, id);
      }
      return id;
    } catch {
      return '00000000-0000-0000-0000-000000000000';
    }
  }

  /**
   * Start tracking user presence both in Supabase DB (heartbeat) and Realtime channel
   */
  start(communityId = 'd3f2173f-79f0-4362-b60a-ad079f724b54'): void {
    const curUser = useDiscord.getState().currentUser;
    if (!curUser || !curUser.id || curUser.id === 'user-me') {
      return;
    }

    if (this.isTracking && this.currentCommunityId === communityId) {
      return;
    }

    this.stop();
    this.isTracking = true;
    this.currentCommunityId = communityId;

    // 1. Immediate initial database heartbeat
    this.sendHeartbeat();

    // 2. Setup periodic database heartbeat every 20 seconds (lease expires in 75s)
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 20000);

    // 3. Connect to Supabase Realtime Presence Channel
    if (supabase) {
      try {
        const channelName = `capychat-presence-${communityId}`;
        const channel = supabase.channel(channelName, {
          config: { presence: { key: curUser.id } },
        });

        // Listen for Realtime presence changes across all users
        channel.on('presence', { event: 'sync' }, () => {
          const presenceState = channel.presenceState();
          const onlineIds = new Set<string>();
          const voiceMap: Record<string, VoiceParticipant[]> = {};

          Object.keys(presenceState).forEach((key) => {
            onlineIds.add(key);
            const items = presenceState[key] as any[];
            const item = items?.[0];
            if (item?.userId) {
              onlineIds.add(item.userId);
            }
            if (item && item.voiceChannelId && (item.userId || item.username)) {
              const chId = item.voiceChannelId;
              if (!voiceMap[chId]) voiceMap[chId] = [];
              const participantUser: User = {
                id: item.userId || key,
                name: item.username || 'User',
                displayName: item.displayName || item.username || 'User',
                avatar: item.avatar || '',
                status: item.status || 'online',
                tag: item.tag || '#0000',
              };
              if (!voiceMap[chId].some((p) => p.user.id === participantUser.id)) {
                voiceMap[chId].push({
                  user: participantUser,
                  isMuted: Boolean(item.isMuted),
                  isDeafened: Boolean(item.isDeafened),
                  isSpeaking: Boolean(item.isSpeaking),
                  isScreenSharing: Boolean(item.isScreenSharing),
                  isVideoOn: Boolean(item.isVideoOn),
                });
              }
            }
          });

          // Always ensure self is marked online
          onlineIds.add(curUser.id);

          useDiscord.getState().setRealtimeOnlineIds(onlineIds);
          useDiscord.getState().setChannelVoiceParticipants(voiceMap);
        });

        // Listen for user_presence table updates
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'user_presence' },
          (payload: any) => {
            if (payload?.new && payload.new.user_id) {
              useDiscord.getState().updatePresenceLease(payload.new.user_id, payload.new.expires_at, payload.new.status);
            }
          }
        );

        this.realtimeChannel = channel;

        // Subscribe and track self
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && typeof channel.track === 'function') {
            await this.syncVoicePresence();
          }
        });
      } catch (err) {
        console.warn('[presenceService] Realtime channel subscription error:', err);
      }
    }
  }

  /**
   * Synchronize active voice connection state with community presence channel
   */
  async syncVoicePresence(): Promise<void> {
    if (!this.realtimeChannel || typeof this.realtimeChannel.track !== 'function') return;
    const curUser = useDiscord.getState().currentUser;
    if (!curUser || !curUser.id || curUser.id === 'user-me') return;

    const { voiceState, isMicMuted, isDeafened, isVideoOn } = useDiscord.getState();
    const screenStream = useVoiceStreamStore.getState().screenStream;
    const isSpeaking = useVoiceStreamStore.getState().isSpeaking;

    try {
      await this.realtimeChannel.track({
        userId: curUser.id,
        username: curUser.name,
        displayName: curUser.displayName,
        avatar: curUser.avatar,
        status: curUser.status || 'online',
        onlineAt: new Date().toISOString(),
        voiceChannelId: voiceState.isConnected ? voiceState.channelId : null,
        voiceChannelName: voiceState.isConnected ? voiceState.channelName : null,
        voiceServerId: voiceState.isConnected ? voiceState.serverId : null,
        isMuted: isMicMuted,
        isDeafened: isDeafened,
        isSpeaking,
        isVideoOn,
        isScreenSharing: Boolean(screenStream),
      });
    } catch (err) {
      console.warn('[presenceService] Failed to sync voice presence:', err);
    }
  }

  /**
   * Send heartbeat to public.presence_action
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const curUser = useDiscord.getState().currentUser;
      if (!curUser || !curUser.id || curUser.id === 'user-me') return;

      const pref = curUser.status || 'online';
      await presenceAction('heartbeat', this.sessionId, pref);
    } catch (err) {
      // Non-critical background failure (e.g. offline network)
    }
  }

  /**
   * Stop presence tracking on logout or leave
   */
  stop(): void {
    this.isTracking = false;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.realtimeChannel) {
      try {
        if (typeof this.realtimeChannel.untrack === 'function') {
          void this.realtimeChannel.untrack();
        }
        if (supabase) {
          void supabase.removeChannel(this.realtimeChannel);
        }
      } catch {}
      this.realtimeChannel = null;
    }

    // Inform database that session is leaving
    try {
      void presenceAction('leave', this.sessionId).catch(() => {});
    } catch {}

    this.currentCommunityId = null;
  }
}

export const presenceService = new PresenceService();
