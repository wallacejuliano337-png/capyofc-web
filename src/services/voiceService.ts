import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useDiscord } from '../store/discordStore';
import { useVoiceStreamStore } from '../store/voiceStreamStore';
import { VoiceParticipant, User } from '../types/discord';
import { playNotificationSound } from './notification-sounds';
import { presenceService } from './presenceService';

interface VoiceSignalPayload {
  senderId: string;
  targetId?: string;
  type: 'offer' | 'answer' | 'candidate' | 'state' | 'leave';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  state?: {
    isSpeaking?: boolean;
    isMuted?: boolean;
    isDeafened?: boolean;
    isVideoOn?: boolean;
    isScreenSharing?: boolean;
  };
}

/**
 * Calibra a linha SDP do codec Opus para padrão de voz de alta fidelidade:
 * - 64 kbps de bitrate médio (áudio encorpado e límpido vs. os 32kbps magros do padrão WebRTC)
 * - useinbandfec=1: Correção de erro de pacote para evitar voz robótica/metálica em instabilidade de rede
 * - usedtx=1: Transmissão descontínua que economiza banda e zera ruído de fundo no silêncio
 * - stereo=0;sprop-stereo=0: Dedica 100% da banda ao canal vocal mono
 * - cbr=0: Taxa de bits variável (VBR) com dinâmica natural da fala
 * - minptime=10: Latência acústica mínima
 */
export function tuneOpusSdp(sdp: string, targetBitrate = 64000): string {
  if (!sdp || typeof sdp !== 'string') return sdp;

  // Localiza o payload type numérico registrado para Opus (ex: a=rtpmap:111 opus/48000/2)
  const rtpmapMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000\/2/i);
  if (!rtpmapMatch) return sdp;

  const opusPt = rtpmapMatch[1];
  const isCrlf = sdp.includes('\r\n');
  const newline = isCrlf ? '\r\n' : '\n';

  const opusParams = [
    `maxaveragebitrate=${targetBitrate}`,
    `stereo=0`,
    `sprop-stereo=0`,
    `useinbandfec=1`,
    `usedtx=1`,
    `cbr=0`,
    `minptime=10`,
  ];

  // Verifica se já existe uma linha a=fmtp para este payload
  const fmtpRegex = new RegExp(`^a=fmtp:${opusPt}\\s+(.*)$`, 'm');
  const fmtpMatch = sdp.match(fmtpRegex);

  if (fmtpMatch) {
    const existingParams = fmtpMatch[1].trim().split(';').map((p) => p.trim()).filter(Boolean);
    const paramKeys = opusParams.map((p) => p.split('=')[0]);
    // Preserva parâmetros pré-existentes desconhecidos e atualiza os calibrados
    const preservedParams = existingParams.filter((p) => !paramKeys.includes(p.split('=')[0]));
    const merged = [...preservedParams, ...opusParams].join(';');

    const globalFmtpRegex = new RegExp(`^a=fmtp:${opusPt}\\s+.*$`, 'gm');
    return sdp.replace(globalFmtpRegex, `a=fmtp:${opusPt} ${merged}`);
  } else {
    // Insere a linha a=fmtp imediatamente após cada a=rtpmap:<pt> opus
    const globalRtpmapRegex = new RegExp(`(^a=rtpmap:${opusPt}\\s+opus\/48000\/2\r?$)`, 'gm');
    return sdp.replace(globalRtpmapRegex, (match) => `${match}${newline}a=fmtp:${opusPt} ${opusParams.join(';')}`);
  }
}

class VoiceService {
  private currentChannelId: string | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private remoteAudioElements = new Map<string, HTMLAudioElement>();
  private remoteStreams = new Map<string, MediaStream>();
  private remoteAudioAnalysers = new Map<string, { ctx: AudioContext; analyser: AnalyserNode; data: Uint8Array; rafId: number }>();
  private unsubscribeVoiceStore: (() => void) | null = null;
  private unsubscribeDiscordStore: (() => void) | null = null;
  private lastSpeakingState = false;
  private hasBoundInteractionListener = false;

  private rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.services.mozilla.com' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      },
    ],
    iceCandidatePoolSize: 10,
  };

  constructor() {
    this.bindWindowInteraction();
  }

  /**
   * Bind user interaction events to unlock audio contexts and play any blocked audio elements
   */
  private bindWindowInteraction(): void {
    if (this.hasBoundInteractionListener || typeof window === 'undefined') return;
    this.hasBoundInteractionListener = true;

    const onUserInteraction = () => {
      this.resumeAllAudio();
    };

    window.addEventListener('click', onUserInteraction, { passive: true });
    window.addEventListener('keydown', onUserInteraction, { passive: true });
  }

  /**
   * Resume all audio elements and contexts if suspended or paused by browser autoplay policy
   */
  public resumeAllAudio(): void {
    this.remoteAudioElements.forEach((el) => {
      if (el.paused && el.srcObject) {
        el.play().catch(() => {});
      }
    });
    this.remoteAudioAnalysers.forEach(({ ctx }) => {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    });
  }

  /**
   * Connect to a voice channel room
   */
  async joinChannel(channelId: string, channelName: string, serverId: string, serverName: string): Promise<void> {
    if (this.currentChannelId === channelId && this.realtimeChannel) {
      return; // Already in this room
    }

    // Leave any existing room first
    await this.leaveChannel(false);

    this.currentChannelId = channelId;
    playNotificationSound('voice_join');

    // 1. Initialize local microphone
    await useVoiceStreamStore.getState().initMic();

    const { currentUser, isMicMuted, isDeafened, isVideoOn } = useDiscord.getState();
    const { isSpeaking, screenStream } = useVoiceStreamStore.getState();

    // Set initial local state in discordStore
    const localParticipant: VoiceParticipant = {
      user: currentUser,
      isMuted: isMicMuted,
      isDeafened: isDeafened,
      isSpeaking: isSpeaking,
      isVideoOn: isVideoOn,
      isScreenSharing: Boolean(screenStream),
    };

    useDiscord.setState({
      voiceState: {
        isConnected: true,
        channelId,
        channelName,
        serverId,
        serverName,
        pingMs: 24,
        participants: [localParticipant],
      },
      activeChannelId: channelId,
      activeView: 'voice-stage',
    });

    if (!supabase) return;

    // 2. Subscribe to Supabase Realtime channel for this voice room
    const roomChannelName = `capy-voice-room-${channelId}`;
    try {
      const existing = supabase.getChannels().find(
        (ch) => ch.topic === roomChannelName || ch.topic === `realtime:${roomChannelName}`
      );
      if (existing) {
        await supabase.removeChannel(existing);
      }
    } catch {}

    const channel = supabase.channel(roomChannelName, {
      config: { presence: { key: currentUser.id } },
    });

    // 3. Listen to Presence Sync (when participants join/leave)
    channel.on('presence', { event: 'sync' }, () => {
      this.handlePresenceSync();
    });

    // 4. Listen to Realtime Broadcast (signaling & rapid state updates)
    channel.on('broadcast', { event: 'voice_signal' }, ({ payload }: { payload: VoiceSignalPayload }) => {
      this.handleVoiceSignal(payload);
    });

    // 5. Subscribe and track local presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const curUser = useDiscord.getState().currentUser;
        const curMuted = useDiscord.getState().isMicMuted;
        const curDeafened = useDiscord.getState().isDeafened;
        const curVideo = useDiscord.getState().isVideoOn;
        const curSpeaking = useVoiceStreamStore.getState().isSpeaking;
        const curScreen = Boolean(useVoiceStreamStore.getState().screenStream);

        await channel.track({
          user: curUser,
          isMuted: curMuted,
          isDeafened: curDeafened,
          isSpeaking: curSpeaking,
          isVideoOn: curVideo,
          isScreenSharing: curScreen,
          joinedAt: Date.now(),
        });
        void presenceService.syncVoicePresence();
      }
    });

    this.realtimeChannel = channel;

    // 6. Watch for local voice stream store changes (speaking, mic init, screen share)
    let prevScreenStream: MediaStream | null = useVoiceStreamStore.getState().screenStream;
    let prevMicStream: MediaStream | null = useVoiceStreamStore.getState().micStream;

    this.unsubscribeVoiceStore = useVoiceStreamStore.subscribe((state) => {
      // 6a. Local speaking state
      if (state.isSpeaking !== this.lastSpeakingState) {
        this.lastSpeakingState = state.isSpeaking;
        this.broadcastState({ isSpeaking: state.isSpeaking });
      }

      // 6b. Mic stream newly acquired or changed
      if (state.micStream !== prevMicStream) {
        prevMicStream = state.micStream;
        if (state.micStream) {
          this.attachLocalMicToAllPeers(state.micStream);
        }
      }

      // 6c. Screen share started or stopped
      if (state.screenStream !== prevScreenStream) {
        const wasSharing = Boolean(prevScreenStream);
        const isSharingNow = Boolean(state.screenStream);
        prevScreenStream = state.screenStream;

        if (isSharingNow && state.screenStream) {
          void this.handleLocalScreenStreamAdded(state.screenStream);
        } else if (wasSharing && !isSharingNow) {
          void this.handleLocalScreenStreamRemoved();
        }
      }
    });

    // 7. Watch for local mute/deafen/video changes in discordStore
    this.unsubscribeDiscordStore = useDiscord.subscribe((state, prevState) => {
      if (
        state.isMicMuted !== prevState.isMicMuted ||
        state.isDeafened !== prevState.isDeafened ||
        state.isVideoOn !== prevState.isVideoOn ||
        state.isScreenSharing !== prevState.isScreenSharing
      ) {
        // Toggle mic track enabled state locally
        const micStream = useVoiceStreamStore.getState().micStream;
        if (micStream) {
          micStream.getAudioTracks().forEach((track) => {
            track.enabled = !state.isMicMuted;
          });
        }

        // Also ensure all RTCRtpSenders for audio reflect the real mute state
        this.peerConnections.forEach((pc) => {
          pc.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === 'audio') {
              sender.track.enabled = !state.isMicMuted;
            }
          });
        });

        // Apply deafened state to remote audio elements
        this.remoteAudioElements.forEach((el) => {
          el.muted = state.isDeafened;
        });

        this.broadcastState({
          isMuted: state.isMicMuted,
          isDeafened: state.isDeafened,
          isVideoOn: state.isVideoOn,
          isScreenSharing: state.isScreenSharing,
        });

        // Also update local presence in Supabase Realtime
        if (this.realtimeChannel) {
          const curUser = state.currentUser;
          void this.realtimeChannel.track({
            user: curUser,
            isMuted: state.isMicMuted,
            isDeafened: state.isDeafened,
            isSpeaking: this.lastSpeakingState,
            isVideoOn: state.isVideoOn,
            isScreenSharing: state.isScreenSharing,
            joinedAt: Date.now(),
          });
        }
      }
    });
  }

  /**
   * Leave the current voice channel
   */
  async leaveChannel(playSound = true): Promise<void> {
    if (!this.currentChannelId && !useDiscord.getState().voiceState.isConnected) return;

    if (playSound) {
      playNotificationSound('voice_leave');
    }

    if (this.unsubscribeVoiceStore) {
      this.unsubscribeVoiceStore();
      this.unsubscribeVoiceStore = null;
    }

    if (this.unsubscribeDiscordStore) {
      this.unsubscribeDiscordStore();
      this.unsubscribeDiscordStore = null;
    }

    // Broadcast immediate leave signal to all peers
    const curUser = useDiscord.getState().currentUser;
    if (this.realtimeChannel) {
      try {
        void this.realtimeChannel.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: {
            senderId: curUser.id,
            type: 'leave',
          },
        });
      } catch {}
    }

    // Teardown WebRTC peer connections
    this.peerConnections.forEach((pc) => {
      try {
        pc.close();
      } catch {}
    });
    this.peerConnections.clear();
    this.pendingCandidates.clear();

    // Cleanup remote audio elements
    this.remoteAudioElements.forEach((el) => {
      try {
        el.srcObject = null;
        el.remove();
      } catch {}
    });
    this.remoteAudioElements.clear();

    // Cleanup audio analysers
    this.remoteAudioAnalysers.forEach(({ ctx, rafId }) => {
      try {
        if (rafId) cancelAnimationFrame(rafId);
        ctx.close().catch(() => {});
      } catch {}
    });
    this.remoteAudioAnalysers.clear();

    this.remoteStreams.clear();

    // Untrack presence and unsubscribe channel
    if (this.realtimeChannel) {
      try {
        await this.realtimeChannel.untrack();
        await new Promise((r) => setTimeout(r, 150));
        if (supabase) {
          await supabase.removeChannel(this.realtimeChannel);
        }
      } catch (err) {
        console.warn('[voiceService] Error leaving realtime channel:', err);
      }
      this.realtimeChannel = null;
    }

    this.currentChannelId = null;

    useDiscord.setState({
      voiceState: {
        isConnected: false,
        pingMs: 0,
        participants: [],
      },
      activeView: 'chat',
    });
    void presenceService.syncVoicePresence();
  }

  /**
   * Broadcast state changes (speaking, mute, video, screenshare) to all peers
   */
  broadcastState(state: { isSpeaking?: boolean; isMuted?: boolean; isDeafened?: boolean; isVideoOn?: boolean; isScreenSharing?: boolean }): void {
    if (!this.realtimeChannel) return;

    const curUser = useDiscord.getState().currentUser;
    void this.realtimeChannel.send({
      type: 'broadcast',
      event: 'voice_signal',
      payload: {
        senderId: curUser.id,
        type: 'state',
        state,
      },
    });

    // Also update local copy in participants array if needed
    this.updateParticipantState(curUser.id, state);
  }

  /**
   * Handle Presence Sync (Remote participants joined or left)
   */
  private handlePresenceSync(): void {
    if (!this.realtimeChannel) return;

    const presenceState = this.realtimeChannel.presenceState();
    const curUser = useDiscord.getState().currentUser;
    const { isMicMuted, isDeafened, isVideoOn } = useDiscord.getState();
    const { isSpeaking, screenStream } = useVoiceStreamStore.getState();

    const participantsMap = new Map<string, VoiceParticipant>();

    // 1. Always include local user first with real local flags
    participantsMap.set(curUser.id, {
      user: curUser,
      isMuted: isMicMuted,
      isDeafened: isDeafened,
      isSpeaking: isSpeaking,
      isVideoOn: isVideoOn,
      isScreenSharing: Boolean(screenStream),
    });

    // 2. Parse presence entries for all users in the room
    const activeRemoteUserIds = new Set<string>();

    Object.entries(presenceState).forEach(([userId, presences]) => {
      if (userId === curUser.id) return;
      activeRemoteUserIds.add(userId);

      const latestPresence = (presences as any[])?.[0];
      if (latestPresence?.user) {
        const u = latestPresence.user as User;
        const existingParticipant = useDiscord.getState().voiceState.participants.find((p) => p.user.id === u.id);

        participantsMap.set(u.id, {
          user: u,
          isMuted: existingParticipant?.isMuted ?? Boolean(latestPresence.isMuted),
          isDeafened: existingParticipant?.isDeafened ?? Boolean(latestPresence.isDeafened),
          isSpeaking: existingParticipant?.isSpeaking ?? Boolean(latestPresence.isSpeaking),
          isVideoOn: existingParticipant?.isVideoOn ?? Boolean(latestPresence.isVideoOn),
          isScreenSharing: existingParticipant?.isScreenSharing ?? Boolean(latestPresence.isScreenSharing),
          mediaStream: this.remoteStreams.get(u.id),
        });
      }
    });

    // 3. Clean up disconnected peers from WebRTC
    this.peerConnections.forEach((pc, peerId) => {
      if (!activeRemoteUserIds.has(peerId)) {
        try {
          pc.close();
        } catch {}
        this.peerConnections.delete(peerId);
        this.pendingCandidates.delete(peerId);

        const audioEl = this.remoteAudioElements.get(peerId);
        if (audioEl) {
          audioEl.srcObject = null;
          audioEl.remove();
          this.remoteAudioElements.delete(peerId);
        }

        const analyserObj = this.remoteAudioAnalysers.get(peerId);
        if (analyserObj) {
          if (analyserObj.rafId) cancelAnimationFrame(analyserObj.rafId);
          analyserObj.ctx.close().catch(() => {});
          this.remoteAudioAnalysers.delete(peerId);
        }

        this.remoteStreams.delete(peerId);
      }
    });

    // 4. Update participants list in discordStore
    const newParticipantsList = Array.from(participantsMap.values());
    useDiscord.setState((prev) => ({
      voiceState: {
        ...prev.voiceState,
        participants: newParticipantsList,
      },
    }));

    // 5. Establish WebRTC mesh connections with remote peers
    activeRemoteUserIds.forEach((peerId) => {
      this.ensurePeerConnection(peerId);
    });
  }

  /**
   * Establish or maintain WebRTC peer connection
   */
  private async ensurePeerConnection(peerId: string): Promise<RTCPeerConnection> {
    const existing = this.peerConnections.get(peerId);
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing;
    }

    const curUser = useDiscord.getState().currentUser;
    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(peerId, pc);

    // 1. Audio & Video Transceivers: ensures bidirectional m=audio and m=video line in all SDP offers/answers
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    } catch {
      // Ignored if transceiver is not supported in test environment
    }
    try {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    } catch {}

    // 2. Add local microphone audio tracks
    const micStream = useVoiceStreamStore.getState().micStream;
    if (micStream) {
      micStream.getAudioTracks().forEach((track) => {
        track.enabled = !useDiscord.getState().isMicMuted;
        try {
          pc.addTrack(track, micStream);
        } catch {}
      });
    }

    // 3. Add local screen share tracks if currently active
    const screenStream = useVoiceStreamStore.getState().screenStream;
    if (screenStream) {
      screenStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, screenStream);
        } catch {}
      });
    }

    // 4. Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && this.realtimeChannel) {
        void this.realtimeChannel.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: {
            senderId: curUser.id,
            targetId: peerId,
            type: 'candidate',
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    // 5. Connection State Monitoring & Self-healing
    pc.onconnectionstatechange = () => {
      console.log(`[voiceService] Peer ${peerId} connectionState: ${pc.connectionState}`);
      if (pc.connectionState === 'connected') {
        this.resumeAllAudio();
      } else if (pc.connectionState === 'failed') {
        console.warn(`[voiceService] Peer ${peerId} connection failed, attempting ICE restart...`);
        try {
          pc.restartIce();
        } catch {}
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[voiceService] Peer ${peerId} iceConnectionState: ${pc.iceConnectionState}`);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        this.resumeAllAudio();
      }
    };

    // 6. Handle remote tracks (audio and video)
    pc.ontrack = (event) => {
      const track = event.track;
      console.log(`[voiceService] ontrack kind=${track.kind} id=${track.id} from peer ${peerId}`);
      track.enabled = true;

      let peerStream = this.remoteStreams.get(peerId);
      if (!peerStream) {
        peerStream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream();
        this.remoteStreams.set(peerId, peerStream);
      }

      // Para vídeo, substitui faixa anterior para evitar feeds fantasmas
      if (track.kind === 'video') {
        peerStream.getVideoTracks().forEach((t) => {
          if (t.id !== track.id) {
            peerStream?.removeTrack(t);
          }
        });
      }
      if (!peerStream.getTracks().some((t) => t.id === track.id)) {
        peerStream.addTrack(track);
      }

      track.onended = () => {
        peerStream?.removeTrack(track);
        if (track.kind === 'video') {
          this.updateParticipantState(peerId, { isScreenSharing: false });
        } else if (track.kind === 'audio') {
          const remainingAudio = peerStream?.getAudioTracks() || [];
          if (remainingAudio.length > 0) {
            this.setupRemoteAudioPlayback(peerId, new MediaStream(remainingAudio));
          }
        }
      };

      if (track.kind === 'audio') {
        // Envia todas as faixas ativas do participante (voz e som da tela compartilhada)
        const allAudio = peerStream.getAudioTracks();
        const peerAudioStream = new MediaStream(allAudio);
        this.setupRemoteAudioPlayback(peerId, peerAudioStream);
        this.setupRemoteAudioVAD(peerId, new MediaStream([track]));
      }

      if (track.kind === 'video') {
        this.updateParticipantState(peerId, {
          isScreenSharing: true,
          mediaStream: peerStream,
        });
      }

      // Re-trigger participant state update so UI has reference to remote stream
      useDiscord.setState((prev) => ({
        voiceState: {
          ...prev.voiceState,
          participants: prev.voiceState.participants.map((p) =>
            p.user.id === peerId
              ? {
                  ...p,
                  mediaStream: peerStream,
                  isScreenSharing: track.kind === 'video' ? true : p.isScreenSharing,
                }
              : p
          ),
        },
      }));
    };

    // 7. Polite peer negotiation: user with lexicographically higher ID initiates offer
    const isInitiator = curUser.id > peerId;
    if (isInitiator) {
      try {
        const rawOffer = await pc.createOffer();
        const tunedOffer = {
          type: rawOffer.type,
          sdp: tuneOpusSdp(rawOffer.sdp || ''),
        };
        await pc.setLocalDescription(tunedOffer);
        this.configureAudioSenders(pc);

        if (this.realtimeChannel) {
          void this.realtimeChannel.send({
            type: 'broadcast',
            event: 'voice_signal',
            payload: {
              senderId: curUser.id,
              targetId: peerId,
              type: 'offer',
              sdp: tunedOffer,
            },
          });
        }
      } catch (err) {
        console.warn(`[voiceService] Error creating initial offer to ${peerId}:`, err);
      }
    }

    return pc;
  }

  /**
   * Drain any ICE candidates received before remote description was set
   */
  private async drainPendingCandidates(peerId: string, pc: RTCPeerConnection): Promise<void> {
    const queue = this.pendingCandidates.get(peerId);
    if (!queue || queue.length === 0) return;

    this.pendingCandidates.delete(peerId);
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn(`[voiceService] Error adding queued ICE candidate for peer ${peerId}:`, err);
      }
    }
  }

  /**
   * Handle incoming WebRTC and state signals from peers
   */
  private async handleVoiceSignal(payload: VoiceSignalPayload): Promise<void> {
    const curUser = useDiscord.getState().currentUser;
    if (payload.senderId === curUser.id) return; // Ignore self

    // 0. Immediate leave signal from remote peer
    if (payload.type === 'leave') {
      this.handleParticipantLeave(payload.senderId);
      return;
    }

    // 1. Rapid state update (speaking, mute, deafen, video, screen)
    if (payload.type === 'state' && payload.state) {
      this.updateParticipantState(payload.senderId, payload.state);
      return;
    }

    // 2. Targeted WebRTC signals (must match targetId === curUser.id)
    if (payload.targetId !== curUser.id) return;

    let pc = this.peerConnections.get(payload.senderId);
    if (!pc) {
      pc = await this.ensurePeerConnection(payload.senderId);
    }

    try {
      if (payload.type === 'offer' && payload.sdp) {
        const isPolite = curUser.id < payload.senderId;
        const offerCollision = pc.signalingState !== 'stable';

        if (offerCollision) {
          if (!isPolite) {
            console.warn(`[voiceService] Glare offer collision ignored as impolite peer with ${payload.senderId}`);
            return;
          }
          console.log(`[voiceService] Glare offer collision rolling back as polite peer with ${payload.senderId}`);
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch (e) {
            console.warn('[voiceService] Rollback error:', e);
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await this.drainPendingCandidates(payload.senderId, pc);

        const rawAnswer = await pc.createAnswer();
        const tunedAnswer = {
          type: rawAnswer.type,
          sdp: tuneOpusSdp(rawAnswer.sdp || ''),
        };
        await pc.setLocalDescription(tunedAnswer);
        this.configureAudioSenders(pc);

        if (this.realtimeChannel) {
          void this.realtimeChannel.send({
            type: 'broadcast',
            event: 'voice_signal',
            payload: {
              senderId: curUser.id,
              targetId: payload.senderId,
              type: 'answer',
              sdp: tunedAnswer,
            },
          });
        }
      } else if (payload.type === 'answer' && payload.sdp) {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
          await this.drainPendingCandidates(payload.senderId, pc);
          this.configureAudioSenders(pc);
        } else {
          console.warn(`[voiceService] Answer received in non-offer state: ${pc.signalingState}`);
        }
      } else if (payload.type === 'candidate' && payload.candidate) {
        if (pc.remoteDescription && pc.remoteDescription.type) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (candErr) {
            console.warn(`[voiceService] Error adding ICE candidate from ${payload.senderId}:`, candErr);
          }
        } else {
          // Description not yet set; queue candidate safely
          const queue = this.pendingCandidates.get(payload.senderId) || [];
          queue.push(payload.candidate);
          this.pendingCandidates.set(payload.senderId, queue);
        }
      }
    } catch (err) {
      console.warn(`[voiceService] WebRTC signal error with peer ${payload.senderId}:`, err);
    }
  }

  /**
   * Instantly clean up leaving participant
   */
  private handleParticipantLeave(userId: string): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      this.peerConnections.delete(userId);
      this.pendingCandidates.delete(userId);
    }

    const audioEl = this.remoteAudioElements.get(userId);
    if (audioEl) {
      try {
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {}
      this.remoteAudioElements.delete(userId);
    }

    const analyserObj = this.remoteAudioAnalysers.get(userId);
    if (analyserObj) {
      try {
        if (analyserObj.rafId) cancelAnimationFrame(analyserObj.rafId);
        analyserObj.ctx.close().catch(() => {});
      } catch {}
      this.remoteAudioAnalysers.delete(userId);
    }

    this.remoteStreams.delete(userId);

    useDiscord.setState((prev) => ({
      voiceState: {
        ...prev.voiceState,
        participants: prev.voiceState.participants.filter((p) => p.user.id !== userId),
      },
    }));
  }

  /**
   * Configura parâmetros de codificação de áudio de forma segura e não-bloqueante.
   * Solicita target de até 64 kbps (ou limite compatível suportado pelo navegador).
   */
  private configureAudioSenders(pc: RTCPeerConnection): void {
    try {
      if (typeof pc.getSenders !== 'function') return;
      pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio' && typeof sender.getParameters === 'function') {
          try {
            const params = sender.getParameters();
            if (!params || !params.encodings || params.encodings.length === 0) {
              return;
            }
            params.encodings[0].maxBitrate = 64000;
            if ('priority' in params.encodings[0]) {
              (params.encodings[0] as any).priority = 'high';
            }
            if ('networkPriority' in params.encodings[0]) {
              (params.encodings[0] as any).networkPriority = 'high';
            }
            if (typeof sender.setParameters === 'function') {
              sender.setParameters(params).catch((err) => {
                console.debug('[voiceService] Aviso não-bloqueante ao definir parâmetros do encoder:', err);
              });
            }
          } catch (paramErr) {
            console.debug('[voiceService] Aviso não-bloqueante em getParameters/setParameters:', paramErr);
          }
        }
      });
    } catch (err) {
      console.debug('[voiceService] Falha segura ao listar senders:', err);
    }
  }

  /**
   * Attach newly initialized microphone stream to all active peer connections
   */
  private attachLocalMicToAllPeers(stream: MediaStream): void {
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !useDiscord.getState().isMicMuted;

    this.peerConnections.forEach((pc) => {
      try {
        const senders = pc.getSenders();
        const existingAudioSender = senders.find((s) => s.track?.kind === 'audio');
        if (existingAudioSender) {
          existingAudioSender.replaceTrack(audioTrack).catch(() => {});
        } else {
          pc.addTrack(audioTrack, stream);
        }
        this.configureAudioSenders(pc);
      } catch (err) {
        console.warn('[voiceService] Error attaching mic to peer:', err);
      }
    });
  }

  /**
   * Add local screen sharing stream to all peers and renegotiate
   */
  private async handleLocalScreenStreamAdded(stream: MediaStream): Promise<void> {
    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    for (const [peerId, pc] of this.peerConnections.entries()) {
      try {
        const senders = pc.getSenders();
        stream.getTracks().forEach((track) => {
          track.enabled = true;
          const matchingSender = senders.find(
            (s) => s.track?.kind === track.kind || (track.kind === 'video' && s.track === null)
          );
          if (matchingSender && typeof matchingSender.replaceTrack === 'function') {
            matchingSender.replaceTrack(track).catch(() => {});
          } else {
            try {
              pc.addTrack(track, stream);
            } catch {}
          }
        });
        await this.renegotiatePeer(peerId);
      } catch (err) {
        console.warn(`[voiceService] Error adding screen stream to peer ${peerId}:`, err);
      }
    }
    void presenceService.syncVoicePresence();
  }

  /**
   * Remove local screen sharing track from all peers and renegotiate
   */
  private async handleLocalScreenStreamRemoved(): Promise<void> {
    for (const [peerId, pc] of this.peerConnections.entries()) {
      try {
        const senders = pc.getSenders();
        let needsRenegotiate = false;
        senders.forEach((sender) => {
          if (sender.track && sender.track.kind === 'video') {
            try {
              pc.removeTrack(sender);
              needsRenegotiate = true;
            } catch {}
          }
        });
        if (needsRenegotiate) {
          await this.renegotiatePeer(peerId);
        }
      } catch (err) {
        console.warn(`[voiceService] Error removing screen stream from peer ${peerId}:`, err);
      }
    }
    void presenceService.syncVoicePresence();
  }

  /**
   * Renegotiate SDP with a specific peer (e.g. when screen share starts or stops)
   */
  private async renegotiatePeer(peerId: string): Promise<void> {
    const pc = this.peerConnections.get(peerId);
    if (!pc || !this.realtimeChannel || pc.signalingState === 'closed') return;

    try {
      const curUser = useDiscord.getState().currentUser;
      const rawOffer = await pc.createOffer();
      const tunedOffer = {
        type: rawOffer.type,
        sdp: tuneOpusSdp(rawOffer.sdp || ''),
      };
      await pc.setLocalDescription(tunedOffer);
      this.configureAudioSenders(pc);

      void this.realtimeChannel.send({
        type: 'broadcast',
        event: 'voice_signal',
        payload: {
          senderId: curUser.id,
          targetId: peerId,
          type: 'offer',
          sdp: tunedOffer,
        },
      });
    } catch (err) {
      console.warn(`[voiceService] Renegotiation error with peer ${peerId}:`, err);
    }
  }

  /**
   * Attach remote audio track to HTMLAudioElement
   */
  private setupRemoteAudioPlayback(peerId: string, stream: MediaStream): void {
    let audioEl = this.remoteAudioElements.get(peerId);
    if (!audioEl) {
      audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.id = `remote-audio-${peerId}`;
      audioEl.style.position = 'fixed';
      audioEl.style.opacity = '0';
      audioEl.style.pointerEvents = 'none';
      audioEl.style.width = '1px';
      audioEl.style.height = '1px';
      audioEl.style.bottom = '0';
      audioEl.volume = 1.0;
      document.body.appendChild(audioEl);
      this.remoteAudioElements.set(peerId, audioEl);
    }

    audioEl.srcObject = stream;
    audioEl.muted = useDiscord.getState().isDeafened;
    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.catch((e) => {
        console.warn(`[voiceService] Auto-play audio prevented for peer ${peerId}:`, e);
      });
    }
  }

  /**
   * Monitor remote audio stream volume to detect speaking (lights up green halo)
   */
  private setupRemoteAudioVAD(peerId: string, stream: MediaStream): void {
    const existing = this.remoteAudioAnalysers.get(peerId);
    if (existing) {
      if (existing.rafId) cancelAnimationFrame(existing.rafId);
      existing.ctx.close().catch(() => {});
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      const audioCtx = new AudioCtxClass();
      if (audioCtx.state === 'suspended') {
        void audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      let wasSpeaking = false;

      const checkRemoteVolume = () => {
        if (!this.remoteAudioAnalysers.has(peerId)) return;
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const isSpeaking = avg > 15;

        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          this.updateParticipantState(peerId, { isSpeaking });
        }

        const currentEntry = this.remoteAudioAnalysers.get(peerId);
        if (currentEntry) {
          currentEntry.rafId = requestAnimationFrame(checkRemoteVolume);
        }
      };

      const rafId = requestAnimationFrame(checkRemoteVolume);
      this.remoteAudioAnalysers.set(peerId, { ctx: audioCtx, analyser, data, rafId });
    } catch (err) {
      console.warn(`[voiceService] VAD setup error for ${peerId}:`, err);
    }
  }

  /**
   * Helper to update specific participant attributes in discordStore
   */
  private updateParticipantState(userId: string, updates: Partial<VoiceParticipant>): void {
    useDiscord.setState((prev) => {
      const updated = prev.voiceState.participants.map((p) => {
        if (p.user.id === userId) {
          return { ...p, ...updates };
        }
        return p;
      });
      return {
        voiceState: {
          ...prev.voiceState,
          participants: updated,
        },
      };
    });
  }

  /**
   * Get active remote media stream for video/screen sharing
   */
  getRemoteStream(peerId: string): MediaStream | undefined {
    return this.remoteStreams.get(peerId);
  }
}

export const voiceService = new VoiceService();
