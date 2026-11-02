import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useDiscord } from '../store/discordStore';
import { useVoiceStreamStore } from '../store/voiceStreamStore';
import { VoiceParticipant, User, ScreenShareSession, ScreenShareStatus } from '../types/discord';
import { playNotificationSound } from './notification-sounds';
import { presenceService } from './presenceService';

interface VoiceSignalPayload {
  senderId: string;
  targetId?: string;
  type: 'offer' | 'answer' | 'candidate' | 'state' | 'leave' | 'sync_request' | 'share_start' | 'share_stop' | 'keyframe_request' | 'watch_stream' | 'unwatch_stream';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  state?: {
    isSpeaking?: boolean;
    isMuted?: boolean;
    isDeafened?: boolean;
    isVideoOn?: boolean;
    isScreenSharing?: boolean;
    shareSession?: ScreenShareSession | null;
  };
  shareSession?: ScreenShareSession;
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

  // Máquina de estados determinística de compartilhamento de tela com controle monotônico de sessão
  private activeSessions = new Map<string, ScreenShareSession>();
  private endedSessions = new Map<string, { lastEndedSessionId: string; endedAt: number }>();

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
    if (typeof window !== 'undefined') {
      (window as any).__voiceService = this;
    }
    this.bindWindowInteraction();
    this.bindLifecycleListeners();
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
   * Registra ouvintes globais para recuperar vídeo e áudio após minimizar a janela ou alternar abas
   */
  private bindLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    const handleVisibilityRecovery = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        this.recoverMediaSession('visibilitychange-visible');
      }
    };

    const handleWindowFocus = () => {
      this.recoverMediaSession('window-focus');
    };

    const handlePageShow = () => {
      this.recoverMediaSession('pageshow');
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityRecovery);
    }
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('focus', handleWindowFocus);

    const electronApi = (window as any).electronAPI || (window as any).arena;
    if (typeof electronApi?.onWindowRestored === 'function') {
      electronApi.onWindowRestored(() => {
        this.recoverMediaSession('electron-window-restored');
      });
    }
  }

  /**
   * Verifica se o peer connection com um determinado participante já está estabelecido
   */
  public hasEstablishedPeer(peerId: string): boolean {
    const pc = this.peerConnections.get(peerId);
    if (!pc) return false;
    return pc.connectionState === 'connected' || pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed';
  }

  /**
   * Avalia de forma determinística e idempotente o estado de compartilhamento de tela de um participante.
   * Ignora sessões já finalizadas, timestamps defasados e presenças antigas do Supabase.
   */
  public evaluateScreenShareState(
    peerId: string,
    incomingSession?: ScreenShareSession | null,
    incomingIsSharingFlag?: boolean
  ): { isSharing: boolean; session: ScreenShareSession | null; stream: MediaStream | undefined } {
    const curUser = useDiscord.getState().currentUser;
    const isLocal = peerId === curUser.id;

    // 1. Participante local: fonte de verdade é o stream de tela ativo local e sessão local
    if (isLocal) {
      const screenStream = useVoiceStreamStore.getState().screenStream;
      const hasLiveTrack = Boolean(
        screenStream && screenStream.getVideoTracks().some((t) => t.readyState === 'live')
      );
      const localSession = this.activeSessions.get(peerId);
      if (hasLiveTrack && localSession && (localSession.status === 'active' || localSession.status === 'starting')) {
        return { isSharing: true, session: localSession, stream: screenStream ?? undefined };
      }
      return { isSharing: false, session: null, stream: undefined };
    }

    // 2. Participante remoto
    const lastEnded = this.endedSessions.get(peerId);

    // 2a. Se recebeu encerramento explícito ou session nula com flag false
    if (
      incomingSession?.status === 'inactive' ||
      incomingSession?.status === 'stopping' ||
      (incomingSession === null && incomingIsSharingFlag === false)
    ) {
      if (incomingSession?.sessionId) {
        this.endedSessions.set(peerId, {
          lastEndedSessionId: incomingSession.sessionId,
          endedAt: incomingSession.endedAt || Date.now(),
        });
      }
      this.activeSessions.delete(peerId);
      this.remoteStreams.delete(peerId);
      return { isSharing: false, session: null, stream: undefined };
    }

    // 2b. Rejeição de eventos atrasados de sessões já encerradas
    if (incomingSession && lastEnded) {
      if (incomingSession.sessionId === lastEnded.lastEndedSessionId) {
        return { isSharing: false, session: null, stream: undefined };
      }
      if (incomingSession.startedAt && incomingSession.startedAt <= lastEnded.endedAt) {
        return { isSharing: false, session: null, stream: undefined };
      }
    }

    // 2c. Sessão ativa recebida
    if (incomingSession && (incomingSession.status === 'active' || incomingSession.status === 'starting')) {
      this.activeSessions.set(peerId, incomingSession);
      const remoteStream = this.getRemoteStream(peerId);
      return { isSharing: true, session: incomingSession, stream: remoteStream };
    }

    // 2d. Se não veio objeto de sessão, verifica se já existe sessão ativa registrada em memória
    const existingSession = this.activeSessions.get(peerId);
    if (existingSession && (existingSession.status === 'active' || existingSession.status === 'starting')) {
      const remoteStream = this.getRemoteStream(peerId);
      return { isSharing: true, session: existingSession, stream: remoteStream };
    }

    // 2e. Se apenas a flag incomingIsSharingFlag veio true sem sessão:
    // ATENÇÃO: Presença antiga do Supabase com isScreenSharing: true SEM sessão NÃO pode ligar AO VIVO!
    return { isSharing: false, session: null, stream: undefined };
  }

  /**
   * Registra o início de uma transmissão remota
   */
  public startRemoteScreenShareSession(peerId: string, session: ScreenShareSession): { isSharing: boolean; session: ScreenShareSession; stream: MediaStream | undefined } {
    const lastEnded = this.endedSessions.get(peerId);
    if (lastEnded) {
      if (session.sessionId === lastEnded.lastEndedSessionId || (session.startedAt && session.startedAt <= lastEnded.endedAt)) {
        return { isSharing: false, session: { ...session, status: 'inactive' }, stream: undefined };
      }
    }

    const activeSession: ScreenShareSession = {
      ...session,
      status: 'active',
    };
    this.activeSessions.set(peerId, activeSession);
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      const transceivers = typeof pc.getTransceivers === 'function' ? pc.getTransceivers() : [];
      const vt = transceivers.find((t) => t.receiver?.track && t.receiver.track.kind === 'video');
      if (vt?.receiver?.track) {
        this.syncRemoteVideoTrack(peerId, vt.receiver.track);
      }
    }
    const stream = this.getRemoteStream(peerId);
    return { isSharing: true, session: activeSession, stream };
  }

  /**
   * Registra o encerramento definitivo de uma transmissão remota
   */
  public endRemoteScreenShareSession(peerId: string, session?: ScreenShareSession): void {
    const activeSession = this.activeSessions.get(peerId) || session;
    const endedAt = Date.now();
    if (activeSession) {
      this.endedSessions.set(peerId, {
        lastEndedSessionId: activeSession.sessionId,
        endedAt,
      });
    }
    this.activeSessions.delete(peerId);
    this.remoteStreams.delete(peerId);
  }

  /**
   * Retorna a sessão ativa de um participante
   */
  public getActiveShareSession(userId: string): ScreenShareSession | undefined {
    return this.activeSessions.get(userId);
  }

  /**
   * Verifica se um participante tem sessão ativa e válida de compartilhamento
   */
  public isParticipantSharing(userId: string): boolean {
    const session = this.activeSessions.get(userId);
    return Boolean(session && (session.status === 'active' || session.status === 'starting'));
  }

  /**
   * Retorna se o usuário local está transmitindo ativamente
   */
  public isLocalSharingActive(): boolean {
    const curUser = useDiscord.getState().currentUser;
    const session = this.activeSessions.get(curUser.id);
    const screenStream = useVoiceStreamStore.getState().screenStream;
    const hasLiveTrack = Boolean(screenStream && screenStream.getVideoTracks().some(t => t.readyState === 'live'));
    return Boolean(hasLiveTrack && session && session.status === 'active');
  }

  /**
   * Recuperação resiliente de mídia e transmissões ao restaurar a janela ou retornar à página
   */
  public recoverMediaSession(reason = 'manual'): void {
    if (!this.currentChannelId) return;

    console.log(`[voiceService Diagnostic] recoverMediaSession (motivo: ${reason})`);

    const curUser = useDiscord.getState().currentUser;

    // 1. Auditar e recuperar conexões WebRTC e transceivers
    this.peerConnections.forEach((pc, peerId) => {
      console.log(`[voiceService Diagnostic] Peer ${peerId} audit ao recuperar (${reason}):`, {
        connectionState: pc.connectionState,
        iceConnectionState: pc.iceConnectionState,
        signalingState: pc.signalingState,
      });

      if (pc.connectionState === 'failed' || pc.iceConnectionState === 'failed') {
        console.warn(`[voiceService] Reiniciando ICE para o peer ${peerId} após restauração de janela...`);
        try {
          pc.restartIce();
        } catch {}
      }

      // Reassociar faixas de vídeo ativas nos transceivers remotos SOMENTE se houver sessão ativa
      const peerSession = this.activeSessions.get(peerId);
      if (peerSession && (peerSession.status === 'active' || peerSession.status === 'starting')) {
        if (typeof pc.getTransceivers === 'function') {
          const transceivers = pc.getTransceivers();
          const videoTransceiver = transceivers.find(
            (t) => t.receiver?.track && t.receiver.track.kind === 'video'
          );
          if (videoTransceiver?.receiver?.track) {
            const track = videoTransceiver.receiver.track;
            if (track.readyState === 'live') {
              track.enabled = true;
              this.syncRemoteVideoTrack(peerId, track);
            }
          }
        }
      }
    });

    // 2. Retomar elementos de áudio remoto
    this.resumeAllAudio();

    // 3. Solicitar sincronização imediata de estado aos outros participantes
    if (this.realtimeChannel) {
      void this.realtimeChannel.send({
        type: 'broadcast',
        event: 'voice_signal',
        payload: {
          senderId: curUser.id,
          type: 'sync_request',
        },
      });
    }

    // 4. Notificar a UI (React e elementos de vídeo) para retomar reprodução
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('capy:media-recovered', { detail: { reason } }));
    }
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

    this.activeSessions.clear();
    this.endedSessions.clear();

    const { currentUser, isMicMuted, isDeafened, isVideoOn } = useDiscord.getState();
    const { isSpeaking, screenStream } = useVoiceStreamStore.getState();
    const hasLiveScreen = Boolean(
      screenStream && screenStream.getVideoTracks().some((t) => t.readyState === 'live')
    );

    let initialLocalSession: ScreenShareSession | null = null;
    if (hasLiveScreen) {
      initialLocalSession = {
        sessionId: `share_${currentUser.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        ownerId: currentUser.id,
        status: 'active',
        startedAt: Date.now(),
        title: `${currentUser.displayName || currentUser.name} (Sua tela)`,
      };
      this.activeSessions.set(currentUser.id, initialLocalSession);
      useDiscord.setState({ isScreenSharing: true });
    } else {
      useDiscord.setState({ isScreenSharing: false });
    }

    // Set initial local state in discordStore
    const localParticipant: VoiceParticipant = {
      user: currentUser,
      isMuted: isMicMuted,
      isDeafened: isDeafened,
      isSpeaking: isSpeaking,
      isVideoOn: isVideoOn,
      isScreenSharing: Boolean(initialLocalSession),
      shareSession: initialLocalSession,
      mediaStream: hasLiveScreen && screenStream ? screenStream : undefined,
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
        const localSession = this.activeSessions.get(curUser.id) || null;

        await channel.track({
          user: curUser,
          isMuted: curMuted,
          isDeafened: curDeafened,
          isSpeaking: curSpeaking,
          isVideoOn: curVideo,
          isScreenSharing: Boolean(localSession),
          shareSession: localSession,
          joinedAt: Date.now(),
        });
        void presenceService.syncVoicePresence();

        // Solicita sincronização ativa imediata de estado aos outros participantes já na sala
        void channel.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: {
            senderId: curUser.id,
            type: 'sync_request',
          },
        });
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

        const curUser = state.currentUser;
        const currentLocalSession = this.activeSessions.get(curUser.id) || null;

        this.broadcastState({
          isMuted: state.isMicMuted,
          isDeafened: state.isDeafened,
          isVideoOn: state.isVideoOn,
          isScreenSharing: state.isScreenSharing,
          shareSession: currentLocalSession,
        });

        // Also update local presence in Supabase Realtime
        if (this.realtimeChannel) {
          void this.realtimeChannel.track({
            user: curUser,
            isMuted: state.isMicMuted,
            isDeafened: state.isDeafened,
            isSpeaking: this.lastSpeakingState,
            isVideoOn: state.isVideoOn,
            isScreenSharing: state.isScreenSharing,
            shareSession: currentLocalSession,
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

    // Para o compartilhamento de tela se ativo e reseta flags locais
    const activeScreenStream = useVoiceStreamStore.getState().screenStream;
    if (activeScreenStream) {
      try {
        useVoiceStreamStore.getState().stopScreenShare();
      } catch {}
    }
    useDiscord.setState({ isScreenSharing: false });

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
    this.activeSessions.clear();
    this.endedSessions.clear();

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
  broadcastState(state: { isSpeaking?: boolean; isMuted?: boolean; isDeafened?: boolean; isVideoOn?: boolean; isScreenSharing?: boolean; shareSession?: ScreenShareSession | null }): void {
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

    const isLocalSharing = this.isLocalSharingActive();
    const localSession = this.activeSessions.get(curUser.id) || null;

    // 1. Always include local user first with real local flags
    participantsMap.set(curUser.id, {
      user: curUser,
      isMuted: isMicMuted,
      isDeafened: isDeafened,
      isSpeaking: isSpeaking,
      isVideoOn: isVideoOn,
      isScreenSharing: isLocalSharing,
      shareSession: localSession,
      mediaStream: isLocalSharing && screenStream ? screenStream : undefined,
    });

    // 2. Parse presence entries for all users in the room
    const activeRemoteUserIds = new Set<string>();

    Object.entries(presenceState).forEach(([userId, presences]) => {
      if (userId === curUser.id) return;
      activeRemoteUserIds.add(userId);

      const presencesArr: any[] = Array.isArray(presences) ? (presences as any[]) : [];
      const sortedPresences = [...presencesArr].sort((a: any, b: any) => (b?.joinedAt || 0) - (a?.joinedAt || 0));
      const latestPresence: any = sortedPresences[0] || (presences as any[])?.[0];

      if (latestPresence?.user) {
        const u = latestPresence.user as User;
        const existingParticipant = useDiscord.getState().voiceState.participants.find((p) => p.user.id === u.id);

        const presenceSession = latestPresence.shareSession as ScreenShareSession | undefined;
        const presenceSharing = Boolean(latestPresence.isScreenSharing);

        const shareEval = this.evaluateScreenShareState(u.id, presenceSession, presenceSharing);

        participantsMap.set(u.id, {
          user: u,
          isMuted: existingParticipant?.isMuted ?? Boolean(latestPresence.isMuted),
          isDeafened: existingParticipant?.isDeafened ?? Boolean(latestPresence.isDeafened),
          isSpeaking: existingParticipant?.isSpeaking ?? Boolean(latestPresence.isSpeaking),
          isVideoOn: existingParticipant?.isVideoOn ?? Boolean(latestPresence.isVideoOn),
          isScreenSharing: shareEval.isSharing,
          shareSession: shareEval.session,
          mediaStream: shareEval.isSharing ? shareEval.stream : undefined,
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
        this.endRemoteScreenShareSession(peerId);
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

    // 1. Audio Transceiver
    try {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    } catch {}

    const screenStream = useVoiceStreamStore.getState().screenStream;
    const screenVideoTrack = screenStream?.getVideoTracks().find((t) => t.readyState === 'live') || screenStream?.getVideoTracks()[0];

    // Video Transceiver: se o usuário local não estiver compartilhando, usa 'recvonly'
    let videoTransceiver: RTCRtpTransceiver | null = null;
    try {
      if (screenVideoTrack && screenStream) {
        videoTransceiver = pc.addTransceiver(screenVideoTrack, {
          direction: 'sendrecv',
          streams: [screenStream],
        });
        try {
          const params = videoTransceiver.sender.getParameters();
          if (params) {
            params.degradationPreference = 'maintain-resolution';
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }
            params.encodings[0].maxBitrate = 3500000;
            (params.encodings[0] as any).minBitrate = 300000;
            params.encodings[0].networkPriority = 'high';
            videoTransceiver.sender.setParameters(params).catch(() => {});
          }
        } catch {}
      } else {
        videoTransceiver = pc.addTransceiver('video', { direction: 'recvonly' });
      }
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

    // 3. Garante associação das faixas de tela compartilhada ao peer
    if (screenStream && screenVideoTrack) {
      if (videoTransceiver && typeof videoTransceiver.sender?.replaceTrack === 'function') {
        videoTransceiver.direction = 'sendrecv';
        videoTransceiver.sender.replaceTrack(screenVideoTrack).catch(() => {});
      } else {
        try {
          pc.addTrack(screenVideoTrack, screenStream);
        } catch {}
      }
      const screenAudioTrack = screenStream.getAudioTracks()[0];
      if (screenAudioTrack) {
        try {
          pc.addTrack(screenAudioTrack, screenStream);
        } catch {}
      }
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

      if (track.kind === 'video') {
        // Guarda a faixa de vídeo recebida
        if (!peerStream.getTracks().some((t) => t.id === track.id)) {
          peerStream.addTrack(track);
        }
        this.syncRemoteVideoTrack(peerId, track);
      }

      if (track.kind === 'audio') {
        if (!peerStream.getTracks().some((t) => t.id === track.id)) {
          peerStream.addTrack(track);
        }
        track.onended = () => {
          peerStream?.removeTrack(track);
          const remainingAudio = peerStream?.getAudioTracks() || [];
          if (remainingAudio.length > 0) {
            this.setupRemoteAudioPlayback(peerId, new MediaStream(remainingAudio));
          }
        };

        const allAudio = peerStream.getAudioTracks();
        const peerAudioStream = new MediaStream(allAudio);
        this.setupRemoteAudioPlayback(peerId, peerAudioStream);
        this.setupRemoteAudioVAD(peerId, new MediaStream([track]));
      }
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

    // 0a. Solicitação de sincronização de estado de outro participante
    if (payload.type === 'sync_request') {
      const { isMicMuted, isDeafened, isVideoOn } = useDiscord.getState();
      const { isSpeaking, screenStream } = useVoiceStreamStore.getState();
      const localSession = this.activeSessions.get(curUser.id);
      const isSharing = Boolean(
        localSession &&
        localSession.status === 'active' &&
        screenStream &&
        screenStream.getVideoTracks().some((t) => t.readyState === 'live')
      );

      if (this.realtimeChannel) {
        void this.realtimeChannel.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: {
            senderId: curUser.id,
            targetId: payload.senderId,
            type: 'state',
            state: {
              isSpeaking,
              isMuted: isMicMuted,
              isDeafened,
              isVideoOn,
              isScreenSharing: isSharing,
              shareSession: isSharing ? localSession : null,
            },
          },
        });
      }
      return;
    }

    // 0aa. Espectador iniciou a visualização da transmissão do apresentador
    if (payload.type === 'watch_stream') {
      const curUser = useDiscord.getState().currentUser;
      if (payload.targetId && payload.targetId !== curUser.id) return;
      console.log(`[voiceService] Espectador ${payload.senderId} entrou na transmissão, enviando Keyframe IDR...`);
      const screenStream = useVoiceStreamStore.getState().screenStream;
      const screenVideoTrack = screenStream?.getVideoTracks().find((t) => t.readyState === 'live');
      if (screenVideoTrack) {
        const pc = this.peerConnections.get(payload.senderId);
        if (pc) {
          const transceivers = typeof pc.getTransceivers === 'function' ? pc.getTransceivers() : [];
          const vt = transceivers.find((t) => t.sender?.track?.kind === 'video' || t.sender?.track === screenVideoTrack);
          if (vt?.sender && typeof vt.sender.replaceTrack === 'function') {
            vt.sender.replaceTrack(screenVideoTrack).catch(() => {});
          }
        }
      }
      return;
    }

    if (payload.type === 'unwatch_stream') {
      console.log(`[voiceService] Espectador ${payload.senderId} parou de assistir a transmissão`);
      return;
    }

    // 0a. Solicitação de re-injeção imediata de Keyframe IDR para recuperação de tela preta
    if (payload.type === 'keyframe_request') {
      const curUser = useDiscord.getState().currentUser;
      if (payload.targetId && payload.targetId !== curUser.id) return;
      const screenStream = useVoiceStreamStore.getState().screenStream;
      const screenVideoTrack = screenStream?.getVideoTracks().find((t) => t.readyState === 'live');
      if (screenVideoTrack) {
        console.log(`[voiceService] Keyframe solicitado por ${payload.senderId}, gerando IDR imediato...`);
        const pc = this.peerConnections.get(payload.senderId);
        if (pc) {
          const transceivers = typeof pc.getTransceivers === 'function' ? pc.getTransceivers() : [];
          const vt = transceivers.find((t) => t.sender?.track?.kind === 'video' || t.sender?.track === screenVideoTrack);
          if (vt?.sender && typeof vt.sender.replaceTrack === 'function') {
            vt.sender.replaceTrack(screenVideoTrack).catch(() => {});
          }
        }
      }
      return;
    }

    // 0b. Início explícito de compartilhamento anunciado por participante remoto
    if (payload.type === 'share_start' && payload.shareSession) {
      const resolved = this.startRemoteScreenShareSession(payload.senderId, payload.shareSession);
      this.updateParticipantState(payload.senderId, {
        isScreenSharing: resolved.isSharing,
        shareSession: resolved.session,
        mediaStream: resolved.stream,
      });
      return;
    }

    // 0c. Encerramento explícito de compartilhamento anunciado por participante remoto
    if (payload.type === 'share_stop') {
      this.endRemoteScreenShareSession(payload.senderId, payload.shareSession);
      this.updateParticipantState(payload.senderId, {
        isScreenSharing: false,
        shareSession: null,
        mediaStream: undefined,
      });
      return;
    }

    // 1. Rapid state update (speaking, mute, deafen, video, screen)
    if (payload.type === 'state' && payload.state) {
      const shareEval = this.evaluateScreenShareState(
        payload.senderId,
        payload.state.shareSession,
        payload.state.isScreenSharing
      );
      this.updateParticipantState(payload.senderId, {
        ...payload.state,
        isScreenSharing: shareEval.isSharing,
        shareSession: shareEval.session,
        mediaStream: shareEval.isSharing ? shareEval.stream : undefined,
      });
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

        // Só sincroniza faixa de vídeo da oferta se o peer tiver sessão de compartilhamento comprovadamente ativa
        const peerSession = this.activeSessions.get(payload.senderId);
        if (peerSession && (peerSession.status === 'active' || peerSession.status === 'starting')) {
          const videoTransceiver = typeof pc.getTransceivers === 'function'
            ? pc.getTransceivers().find((t) => t.receiver.track && t.receiver.track.kind === 'video')
            : null;
          if (videoTransceiver?.receiver?.track && videoTransceiver.receiver.track.readyState === 'live') {
            this.syncRemoteVideoTrack(payload.senderId, videoTransceiver.receiver.track);
          }
        }

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

          // Só sincroniza faixa de vídeo da resposta se o peer tiver sessão de compartilhamento comprovadamente ativa
          const peerSession = this.activeSessions.get(payload.senderId);
          if (peerSession && (peerSession.status === 'active' || peerSession.status === 'starting')) {
            const videoTransceiver = typeof pc.getTransceivers === 'function'
              ? pc.getTransceivers().find((t) => t.receiver.track && t.receiver.track.kind === 'video')
              : null;
            if (videoTransceiver?.receiver?.track && videoTransceiver.receiver.track.readyState === 'live') {
              this.syncRemoteVideoTrack(payload.senderId, videoTransceiver.receiver.track);
            }
          }
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
    this.endRemoteScreenShareSession(userId);
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
    videoTrack.enabled = true;

    const curUser = useDiscord.getState().currentUser;
    const activeSourceName = useVoiceStreamStore.getState().activeSourceName;
    const sessionId = `share_${curUser.id}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const localSession: ScreenShareSession = {
      sessionId,
      ownerId: curUser.id,
      status: 'active',
      startedAt: Date.now(),
      title: `${curUser.displayName || curUser.name} (${activeSourceName || 'Sua tela'})`,
    };
    this.activeSessions.set(curUser.id, localSession);
    useDiscord.setState({ isScreenSharing: true });

    // 1. Broadcast share_start aos peers antecipadamente para sincronizar sessões antes da oferta WebRTC
    if (this.realtimeChannel) {
      void this.realtimeChannel.send({
        type: 'broadcast',
        event: 'voice_signal',
        payload: {
          senderId: curUser.id,
          type: 'share_start',
          shareSession: localSession,
        },
      });
    }

    for (const [peerId, pc] of this.peerConnections.entries()) {
      try {
        const transceivers = typeof pc.getTransceivers === 'function' ? pc.getTransceivers() : [];
        const videoTransceiver = transceivers.find(
          (t) =>
            t.sender.track?.kind === 'video' ||
            (t.receiver.track && t.receiver.track.kind === 'video') ||
            (t.sender.track === null && t.receiver.track?.kind !== 'audio')
        );

        if (videoTransceiver) {
          videoTransceiver.direction = 'sendrecv';
          if (typeof videoTransceiver.sender?.replaceTrack === 'function') {
            await videoTransceiver.sender.replaceTrack(videoTrack);
          }
          if (typeof (videoTransceiver.sender as any).setStreams === 'function') {
            try { (videoTransceiver.sender as any).setStreams(stream); } catch {}
          }
          try {
            const params = videoTransceiver.sender.getParameters();
            if (params) {
              params.degradationPreference = 'maintain-resolution';
              if (!params.encodings || params.encodings.length === 0) {
                params.encodings = [{}];
              }
              params.encodings[0].maxBitrate = 3500000;
              (params.encodings[0] as any).minBitrate = 300000;
              params.encodings[0].networkPriority = 'high';
              await videoTransceiver.sender.setParameters(params);
            }
          } catch (e) {
            console.warn('[voiceService] setParameters warning:', e);
          }
        } else {
          try {
            pc.addTrack(videoTrack, stream);
          } catch {
            const senders = pc.getSenders();
            const matchingSender = senders.find(
              (s) => s.track?.kind === 'video' || s.track === null
            );
            if (matchingSender && typeof matchingSender.replaceTrack === 'function') {
              await matchingSender.replaceTrack(videoTrack);
            }
          }
        }

        // Áudio da tela compartilhada se presente
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = true;
          const matchingAudioSender = pc.getSenders().find((s) => s.track === audioTrack);
          if (!matchingAudioSender) {
            try { pc.addTrack(audioTrack, stream); } catch {}
          }
        }

        await this.renegotiatePeer(peerId);
      } catch (err) {
        console.warn(`[voiceService] Error adding screen stream to peer ${peerId}:`, err);
      }
    }

    // Broadcast share_start aos peers
    if (this.realtimeChannel) {
      void this.realtimeChannel.send({
        type: 'broadcast',
        event: 'voice_signal',
        payload: {
          senderId: curUser.id,
          type: 'share_start',
          shareSession: localSession,
        },
      });
    }

    this.broadcastState({ isScreenSharing: true, shareSession: localSession });
    void presenceService.syncVoicePresence();
    if (this.realtimeChannel) {
      const { isMicMuted, isDeafened, isVideoOn } = useDiscord.getState();
      const isSpeaking = useVoiceStreamStore.getState().isSpeaking;
      void this.realtimeChannel.track({
        user: curUser,
        isMuted: isMicMuted,
        isDeafened,
        isSpeaking,
        isVideoOn,
        isScreenSharing: true,
        shareSession: localSession,
        joinedAt: Date.now(),
      });
    }
  }

  /**
   * Remove local screen sharing track from all peers and renegotiate
   */
  private async handleLocalScreenStreamRemoved(): Promise<void> {
    const curUser = useDiscord.getState().currentUser;
    const currentSession = this.activeSessions.get(curUser.id);
    const endedSession: ScreenShareSession = currentSession
      ? { ...currentSession, status: 'inactive', endedAt: Date.now() }
      : {
          sessionId: `share_${curUser.id}_ended_${Date.now()}`,
          ownerId: curUser.id,
          status: 'inactive',
          startedAt: Date.now() - 1000,
          endedAt: Date.now(),
        };

    this.endedSessions.set(curUser.id, {
      lastEndedSessionId: endedSession.sessionId,
      endedAt: endedSession.endedAt!,
    });
    this.activeSessions.delete(curUser.id);
    useDiscord.setState({ isScreenSharing: false });

    for (const [peerId, pc] of this.peerConnections.entries()) {
      try {
        const transceivers = typeof pc.getTransceivers === 'function' ? pc.getTransceivers() : [];
        let needsRenegotiate = false;

        for (const t of transceivers) {
          if (t.sender.track && t.sender.track.kind === 'video') {
            try {
              await t.sender.replaceTrack(null);
              t.direction = 'recvonly';
              needsRenegotiate = true;
            } catch {}
          }
        }

        if (!needsRenegotiate) {
          pc.getSenders().forEach((sender) => {
            if (sender.track && sender.track.kind === 'video') {
              try {
                pc.removeTrack(sender);
                needsRenegotiate = true;
              } catch {}
            }
          });
        }

        if (needsRenegotiate) {
          await this.renegotiatePeer(peerId);
        }
      } catch (err) {
        console.warn(`[voiceService] Error removing screen stream from peer ${peerId}:`, err);
      }
    }

    if (this.realtimeChannel) {
      void this.realtimeChannel.send({
        type: 'broadcast',
        event: 'voice_signal',
        payload: {
          senderId: curUser.id,
          type: 'share_stop',
          shareSession: endedSession,
        },
      });
    }

    this.broadcastState({ isScreenSharing: false, shareSession: null });
    void presenceService.syncVoicePresence();
    if (this.realtimeChannel) {
      const { isMicMuted, isDeafened, isVideoOn } = useDiscord.getState();
      const isSpeaking = useVoiceStreamStore.getState().isSpeaking;
      void this.realtimeChannel.track({
        user: curUser,
        isMuted: isMicMuted,
        isDeafened,
        isSpeaking,
        isVideoOn,
        isScreenSharing: false,
        shareSession: null,
        joinedAt: Date.now(),
      });
    }
    this.updateParticipantState(curUser.id, {
      isScreenSharing: false,
      shareSession: null,
      mediaStream: undefined,
    });
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
   * Sincroniza e associa com segurança uma faixa de vídeo remota ao participante correto.
   * REGRA OBRIGATÓRIA: Nunca ativa AO VIVO sem uma sessão ativamente registrada em activeSessions!
   */
  public syncRemoteVideoTrack(peerId: string, track: MediaStreamTrack): void {
    if (!track || track.kind !== 'video') return;
    track.enabled = true;

    let videoStream = this.remoteStreams.get(peerId);
    if (!videoStream) {
      videoStream = new MediaStream([track]);
      this.remoteStreams.set(peerId, videoStream);
    } else if (!videoStream.getTracks().some((t) => t.id === track.id)) {
      videoStream.addTrack(track);
    }

    const session = this.activeSessions.get(peerId);
    const isSessionActive = Boolean(session && (session.status === 'active' || session.status === 'starting'));

    console.log(`[voiceService Diagnostic] syncRemoteVideoTrack: peerId=${peerId} trackId=${track.id} readyState=${track.readyState} muted=${track.muted} isSessionActive=${isSessionActive}`);

    const onTrackEnded = () => {
      console.log(`[voiceService Diagnostic] Remote video track ended from peer ${peerId}`);
      const pc = this.peerConnections.get(peerId);
      const remainingVideoTrack = typeof pc?.getTransceivers === 'function'
        ? pc.getTransceivers().find((t) => t.receiver?.track?.kind === 'video' && t.receiver.track.readyState === 'live')?.receiver.track
        : null;

      if (!remainingVideoTrack) {
        this.endRemoteScreenShareSession(peerId);
        this.updateParticipantState(peerId, {
          isScreenSharing: false,
          shareSession: null,
          mediaStream: undefined,
        });
      } else {
        this.syncRemoteVideoTrack(peerId, remainingVideoTrack);
      }
    };

    let muteRecoveryTimer: any = null;
    const curUser = useDiscord.getState().currentUser;

    const onTrackMute = () => {
      console.log(`[voiceService Diagnostic] Remote video track temporarily muted from peer ${peerId}`);
      clearTimeout(muteRecoveryTimer);
      // Se permanecer muted por mais de 500ms, pede um keyframe IDR ao apresentador para não ficar com tela preta
      muteRecoveryTimer = setTimeout(() => {
        if (track.muted && this.realtimeChannel) {
          console.log(`[voiceService] Track ainda mutada após 500ms, enviando keyframe_request para peer ${peerId}`);
          void this.realtimeChannel.send({
            type: 'broadcast',
            event: 'voice_signal',
            payload: {
              senderId: curUser.id,
              targetId: peerId,
              type: 'keyframe_request',
            },
          });
        }
      }, 500);
    };

    const onTrackUnmute = () => {
      clearTimeout(muteRecoveryTimer);
      console.log(`[voiceService Diagnostic] Remote video track unmuted from peer ${peerId}`);
      track.enabled = true;
      const currentSession = this.activeSessions.get(peerId);
      if (currentSession && (currentSession.status === 'active' || currentSession.status === 'starting')) {
        let stream = this.remoteStreams.get(peerId);
        if (!stream) {
          stream = new MediaStream([track]);
          this.remoteStreams.set(peerId, stream);
        } else if (!stream.getTracks().some((t) => t.id === track.id)) {
          stream.addTrack(track);
        }
        this.updateParticipantState(peerId, {
          isScreenSharing: true,
          shareSession: currentSession,
          mediaStream: stream,
        });
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('capy:media-recovered', { detail: { reason: 'track-unmute', peerId } }));
        }
      }
    };

    track.removeEventListener('ended', onTrackEnded);
    track.removeEventListener('mute', onTrackMute);
    track.removeEventListener('unmute', onTrackUnmute);

    track.addEventListener('ended', onTrackEnded);
    track.addEventListener('mute', onTrackMute);
    track.addEventListener('unmute', onTrackUnmute);

    track.onended = onTrackEnded;
    track.onmute = onTrackMute;
    track.onunmute = onTrackUnmute;

    // SÓ marca o participante como isScreenSharing: true SE E SOMENTE SE houver sessão ativa
    if (isSessionActive && session) {
      this.updateParticipantState(peerId, {
        isScreenSharing: true,
        shareSession: session,
        mediaStream: videoStream,
      });
    } else {
      // Se não há sessão ativa, guarda apenas a faixa de vídeo para quando o share_start chegar, MAS NÃO ativa AO VIVO!
      this.updateParticipantState(peerId, {
        isScreenSharing: false,
        shareSession: null,
        mediaStream: undefined,
      });
    }
  }

  /**
   * Get active remote media stream for video/screen sharing
   * REGRA OBRIGATÓRIA: Só retorna stream se o participante possuir sessão comprovadamente ativa!
   */
  /**
   * Espectador entra ativamente na transmissão de um apresentador
   */
  public enterStream(presenterId: string, sessionId?: string): void {
    const curUser = useDiscord.getState().currentUser;
    console.log(`[voiceService] enterStream: espectador ${curUser.id} entrando na transmissão de ${presenterId}`);

    const sendSignals = () => {
      if (this.realtimeChannel) {
        void this.realtimeChannel.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: {
            senderId: curUser.id,
            targetId: presenterId,
            type: 'watch_stream',
            shareSession: sessionId ? { sessionId, ownerId: presenterId, status: 'active', startedAt: Date.now() } : undefined,
          },
        });

        void this.realtimeChannel.send({
          type: 'broadcast',
          event: 'voice_signal',
          payload: {
            senderId: curUser.id,
            targetId: presenterId,
            type: 'keyframe_request',
          },
        });
      }
    };

    if (typeof RTCPeerConnection !== 'undefined') {
      void this.ensurePeerConnection(presenterId).then((pc) => {
        const transceivers = typeof pc.getTransceivers === 'function' ? pc.getTransceivers() : [];
        const videoTransceiver = transceivers.find((t) => t.receiver?.track && t.receiver.track.kind === 'video');
        if (videoTransceiver?.receiver?.track) {
          this.syncRemoteVideoTrack(presenterId, videoTransceiver.receiver.track);
        }
        sendSignals();
      }).catch(() => {
        sendSignals();
      });
    } else {
      sendSignals();
    }
  }

  public leaveStream(presenterId: string): void {
    const curUser = useDiscord.getState().currentUser;
    console.log(`[voiceService] leaveStream: espectador ${curUser.id} saindo da transmissão de ${presenterId}`);

    if (this.realtimeChannel) {
      void this.realtimeChannel.send({
        type: 'broadcast',
        event: 'voice_signal',
        payload: {
          senderId: curUser.id,
          targetId: presenterId,
          type: 'unwatch_stream',
        },
      });
    }
  }

  public async getDiagnostics(targetPeerId?: string) {
    const results: any[] = [];
    for (const [peerId, pc] of this.peerConnections.entries()) {
      if (targetPeerId && peerId !== targetPeerId) continue;
      let inboundVideo: any = {};
      let outboundVideo: any = {};
      try {
        const stats = await pc.getStats();
        stats.forEach((report: any) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            inboundVideo = {
              framesReceived: report.framesReceived,
              framesDecoded: report.framesDecoded,
              framesDropped: report.framesDropped,
              bytesReceived: report.bytesReceived,
              frameWidth: report.frameWidth,
              frameHeight: report.frameHeight,
              keyFramesDecoded: report.keyFramesDecoded,
            };
          } else if (report.type === 'outbound-rtp' && report.kind === 'video') {
            outboundVideo = {
              framesSent: report.framesSent,
              bytesSent: report.bytesSent,
              frameWidth: report.frameWidth,
              frameHeight: report.frameHeight,
              keyFramesEncoded: report.keyFramesEncoded,
            };
          }
        });
      } catch (e) {}
      results.push({
        peerId,
        iceConnectionState: pc.iceConnectionState,
        connectionState: pc.connectionState,
        signalingState: pc.signalingState,
        activeSession: this.activeSessions.get(peerId),
        inboundVideo,
        outboundVideo,
      });
    }
    return results;
  }

  getRemoteStream(peerId: string): MediaStream | undefined {
    const session = this.activeSessions.get(peerId);
    if (!session || (session.status !== 'active' && session.status !== 'starting')) {
      return undefined;
    }

    let stream = this.remoteStreams.get(peerId);
    const hasLiveTrack = stream?.getVideoTracks().some((t) => t.readyState === 'live');

    if (!stream || !hasLiveTrack) {
      const pc = this.peerConnections.get(peerId);
      if (pc) {
        const transceivers = typeof pc.getTransceivers === 'function' ? pc.getTransceivers() : [];
        const videoTransceiver = transceivers.find(
          (t) => t.receiver.track && t.receiver.track.kind === 'video' && t.receiver.track.readyState === 'live'
        );
        if (videoTransceiver?.receiver?.track) {
          stream = new MediaStream([videoTransceiver.receiver.track]);
          this.remoteStreams.set(peerId, stream);
        }
      }
    }
    return stream;
  }
}

export const voiceService = new VoiceService();
