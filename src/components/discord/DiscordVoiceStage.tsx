import React, { useRef, useState, useEffect } from 'react';
import { useDiscord, currentUser } from '../../store/discordStore';
import { useVoiceStreamStore } from '../../store/voiceStreamStore';
import { useTheme } from '../../store/themeStore';
import { voiceService } from '../../services/voiceService';
import { DiscordUserContextMenu } from './DiscordUserContextMenu';
import { getAvatarUrl } from '../../utils/avatar';
import { getAssetUrl } from '../../utils/assets';
import { User, VoiceParticipant } from '../../types/discord';
import {
  Volume2,
  VolumeX,
  MicOff,
  PhoneOff,
  MessageSquare,
  Maximize2,
  Radio,
  ShieldCheck,
  LayoutGrid,
  Tv,
  Layers,
  EyeOff,
  Play,
  Activity,
} from 'lucide-react';
import { WebRTCDiagnosticsModal, VideoElementDebugInfo } from './WebRTCDiagnosticsModal';

/**
 * Miniatura de vídeo dedicada para visualização em tempo real de transmissões secundárias.
 */
interface StreamMiniThumbnailProps {
  stream: MediaStream | null;
}

const StreamMiniThumbnail: React.FC<StreamMiniThumbnailProps> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;

    const play = () => {
      if (!el || !stream) return;
      if (el.srcObject !== stream) {
        el.srcObject = stream;
      }
      if (el.paused) {
        el.play().catch(() => {});
      }
    };

    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
    play();

    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach((t) => {
      t.enabled = true;
      t.addEventListener('unmute', play);
    });

    const handleAddTrack = (e: MediaStreamTrackEvent) => {
      if (e.track.kind === 'video') {
        e.track.enabled = true;
        e.track.addEventListener('unmute', play);
        play();
      }
    };

    stream.addEventListener('addtrack', handleAddTrack);
    el.addEventListener('loadedmetadata', play);
    el.addEventListener('loadeddata', play);
    el.addEventListener('canplay', play);

    const pollInterval = setInterval(() => {
      if (el && (el.paused || el.videoWidth === 0)) {
        play();
      } else {
        clearInterval(pollInterval);
      }
    }, 350);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') play();
    };

    window.addEventListener('capy:media-recovered', play);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', play);
    window.addEventListener('pageshow', play);

    return () => {
      clearInterval(pollInterval);
      videoTracks.forEach((t) => {
        t.removeEventListener('unmute', play);
      });
      stream.removeEventListener('addtrack', handleAddTrack);
      el.removeEventListener('loadedmetadata', play);
      el.removeEventListener('loadeddata', play);
      el.removeEventListener('canplay', play);
      window.removeEventListener('capy:media-recovered', play);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', play);
      window.removeEventListener('pageshow', play);
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover bg-black pointer-events-none"
    />
  );
};

export interface ActiveScreenShare {
  id: string; // user.id
  sessionId?: string;
  user: User;
  isLocal: boolean;
  stream: MediaStream | null;
  title: string;
  hasLiveVideo?: boolean;
}

export const DiscordVoiceStage: React.FC = () => {
  const {
    voiceState,
    isMicMuted,
    isVideoOn,
    toggleMute,
    toggleVideo,
    setActiveView,
    openMemberPopout,
    openSettingsModal,
    focusedParticipantId,
    setFocusedParticipantId,
  } = useDiscord();

  const { theme } = useTheme();
  const isOled = theme === 'oled';

  const {
    screenStream,
    isSpeaking,
    activeSourceName,
    openShareModal,
    stopScreenShare,
    disconnectAll,
  } = useVoiceStreamStore();

  const [viewMode, setViewMode] = useState<'stage' | 'grid'>('grid');
  const [watchingShareId, setWatchingShareId] = useState<string | null>(null);
  const [isVideoRendering, setIsVideoRendering] = useState(false);
  const [isConnectingStream, setIsConnectingStream] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [videoDebugInfo, setVideoDebugInfo] = useState<VideoElementDebugInfo>({
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
    readyStateLabel: 'HAVE_NOTHING (0)',
    paused: true,
    muted: true,
    currentTime: 0,
    lastEvent: 'inicial',
    lastEventTime: null,
    playResult: 'aguardando',
  });

  const handleEnterStream = (shareId: string, sessionId?: string) => {
    console.log(`[DiscordVoiceStage] handleEnterStream: entrando na transmissão de ${shareId} (sessionId: ${sessionId})`);
    setWatchingShareId(shareId);
    setFocusedParticipantId(shareId);
    setViewMode('stage');
    setIsConnectingStream(true);
    setIsVideoRendering(false);
    voiceService.enterStream(shareId, sessionId);
  };

  const handleLeaveStream = () => {
    if (watchingShareId) {
      console.log(`[DiscordVoiceStage] handleLeaveStream: saindo de ${watchingShareId}`);
      voiceService.leaveStream(watchingShareId);
    }
    setWatchingShareId(null);
    setFocusedParticipantId(null);
    setViewMode('grid');
    setIsConnectingStream(false);
    setIsVideoRendering(false);
  };
  const [voiceContextMenu, setVoiceContextMenu] = useState<{
    user: User;
    position: { x: number; y: number };
  } | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  // Compile participants list ensuring local state (mute/video/screen) is kept in sync
  const hasLocal = voiceState.participants?.some(
    (p) => p.user.id === currentUser.id || p.user.name === currentUser.name,
  );
  const rawParticipants: VoiceParticipant[] = hasLocal
    ? voiceState.participants
    : [
        {
          user: currentUser,
          isMuted: isMicMuted,
          isDeafened: false,
          isSpeaking: isSpeaking,
          isScreenSharing: Boolean(screenStream),
          isVideoOn: isVideoOn,
        },
        ...(voiceState.participants || []),
      ];

  const participants: VoiceParticipant[] = rawParticipants.map((p) => {
    const isLocal = p.user.id === currentUser.id || p.user.name === currentUser.name;
    if (isLocal) {
      const isLocalSharing = voiceService.isLocalSharingActive();
      return {
        ...p,
        isMuted: isMicMuted,
        isVideoOn: isVideoOn,
        isSpeaking: isSpeaking,
        isScreenSharing: isLocalSharing,
        mediaStream: isLocalSharing && screenStream ? screenStream : undefined,
      };
    }

    const isRemoteSharing = voiceService.isParticipantSharing(p.user.id);
    const remoteStream = isRemoteSharing
      ? (voiceService.getRemoteStream(p.user.id) || p.mediaStream)
      : undefined;

    return {
      ...p,
      isScreenSharing: isRemoteSharing,
      mediaStream: remoteStream,
    };
  });

  // 1. Compilação de todas as transmissões de tela ativas (locais e remotas)
  const activeScreenShares: ActiveScreenShare[] = [];

  // Transmissão local (se o usuário estiver compartilhando sua tela de fato)
  if (voiceService.isLocalSharingActive() && screenStream) {
    const hasLiveVideo = screenStream
      .getVideoTracks()
      .some((t) => t.readyState === 'live');
    if (hasLiveVideo) {
      const localSession = voiceService.getActiveShareSession(currentUser.id);
      activeScreenShares.push({
        id: currentUser.id,
        sessionId: localSession?.sessionId,
        user: currentUser,
        isLocal: true,
        stream: screenStream,
        title: 'Sua Tela',
        hasLiveVideo: true,
      });
    }
  }

  // Transmissões remotas (recebidas via WebRTC de participantes com sessão ativa)
  participants.forEach((p) => {
    if (p.user.id === currentUser.id || p.user.name === currentUser.name) return;
    const isSharing = voiceService.isParticipantSharing(p.user.id) || p.isScreenSharing;
    if (isSharing) {
      const session = voiceService.getActiveShareSession(p.user.id);
      const remoteStream = p.mediaStream || voiceService.getRemoteStream(p.user.id);
      const hasLiveVideo = Boolean(
        remoteStream &&
        remoteStream.getVideoTracks().some((t) => t.readyState === 'live')
      );
      if (!activeScreenShares.some((s) => s.id === p.user.id)) {
        activeScreenShares.push({
          id: p.user.id,
          sessionId: session?.sessionId,
          user: p.user,
          isLocal: false,
          stream: remoteStream || null,
          title: (session?.title && !session.title.includes('Sua Tela') && !session.title.includes('Sua tela'))
            ? session.title
            : `Tela de ${p.user.displayName || p.user.name}`,
          hasLiveVideo,
        });
      }
    }
  });

  const hasActiveStream = activeScreenShares.length > 0;

  // 2. Determinação da transmissão selecionada pelo espectador ou apresentador local
  const isLocalSharingActive = voiceService.isLocalSharingActive() && Boolean(screenStream);

  let currentSelectedShare: ActiveScreenShare | null = null;
  if (hasActiveStream) {
    if (watchingShareId) {
      currentSelectedShare = activeScreenShares.find((s) => s.id === watchingShareId) || null;
    }
    if (!currentSelectedShare && isLocalSharingActive && viewMode === 'stage') {
      currentSelectedShare = activeScreenShares.find((s) => s.isLocal) || null;
    }
  }

  // Fallback quando a transmissão assistida encerra de fato: retorna à grade com segurança
  useEffect(() => {
    if (watchingShareId) {
      const isStillSharing = voiceService.isParticipantSharing(watchingShareId);
      if (!isStillSharing) {
        console.log(`[DiscordVoiceStage] Transmissão assistida ${watchingShareId} foi encerrada pelo apresentador`);
        setWatchingShareId(null);
        setFocusedParticipantId(null);
        setViewMode('grid');
        setIsConnectingStream(false);
        setIsVideoRendering(false);
      }
    } else if (viewMode === 'stage' && activeScreenShares.length === 0 && !isLocalSharingActive) {
      setViewMode('grid');
      setWatchingShareId(null);
      setFocusedParticipantId(null);
      setIsConnectingStream(false);
      setIsVideoRendering(false);
    }
  }, [participants, watchingShareId, activeScreenShares.length, viewMode, isLocalSharingActive]);

  const activeStream = currentSelectedShare ? currentSelectedShare.stream : null;
  const activeStreamOwner = currentSelectedShare
    ? currentSelectedShare.isLocal
      ? 'Sua Tela'
      : currentSelectedShare.title
    : 'Transmissão Ao Vivo';

  // Vincula a transmissão selecionada ao elemento de vídeo principal do palco com instrumentação de diagnóstico
  useEffect(() => {
    const videoEl = screenVideoRef.current;
    if (!videoEl || !activeStream) {
      if (videoEl) videoEl.srcObject = null;
      setIsVideoRendering(false);
      setVideoDebugInfo((prev) => ({
        ...prev,
        videoWidth: 0,
        videoHeight: 0,
        readyState: 0,
        readyStateLabel: 'HAVE_NOTHING (0)',
        paused: true,
        lastEvent: 'stream_removido',
        lastEventTime: Date.now(),
      }));
      return;
    }

    const updateDebug = (event: string, playRes?: string) => {
      if (!videoEl) return;
      const rState = videoEl.readyState;
      const rLabels: Record<number, string> = {
        0: 'HAVE_NOTHING (0)',
        1: 'HAVE_METADATA (1)',
        2: 'HAVE_CURRENT_DATA (2)',
        3: 'HAVE_FUTURE_DATA (3)',
        4: 'HAVE_ENOUGH_DATA (4)',
      };
      setVideoDebugInfo({
        videoWidth: videoEl.videoWidth,
        videoHeight: videoEl.videoHeight,
        readyState: rState,
        readyStateLabel: rLabels[rState] || String(rState),
        paused: videoEl.paused,
        muted: videoEl.muted,
        currentTime: videoEl.currentTime,
        lastEvent: event,
        lastEventTime: Date.now(),
        playResult: playRes !== undefined ? playRes : (videoEl.paused ? 'Pausado' : 'Reproduzindo'),
      });
    };

    if (videoEl.srcObject !== activeStream) {
      videoEl.srcObject = activeStream;
      videoEl.muted = true;
      updateDebug('srcObject_atribuido');
    }

    const checkRendering = () => {
      if (videoEl && videoEl.videoWidth > 0 && !videoEl.paused) {
        setIsVideoRendering(true);
        setIsConnectingStream(false);
      }
      updateDebug('checkRendering');
    };

    const playVideo = (origin = 'manual') => {
      if (!videoEl || !activeStream) return;
      videoEl.muted = true;
      if (videoEl.srcObject !== activeStream) {
        videoEl.srcObject = activeStream;
      }
      if (videoEl.paused) {
        videoEl
          .play()
          .then(() => {
            updateDebug(origin, 'OK (Reproduzindo)');
          })
          .catch((err) => {
            console.warn('[DiscordVoiceStage] Error playing stream video:', err);
            updateDebug(origin, `Erro: ${err.name || err.message}`);
          });
      } else {
        updateDebug(origin, 'OK (Já em reprodução)');
      }
      checkRendering();
    };

    playVideo('mount');

    const videoTracks = activeStream.getVideoTracks();
    const onTrackUnmute = () => {
      playVideo('unmute');
      checkRendering();
    };

    videoTracks.forEach((t) => {
      t.enabled = true;
      t.addEventListener('unmute', onTrackUnmute);
    });

    const handleAddTrack = (e: MediaStreamTrackEvent) => {
      if (e.track.kind === 'video') {
        e.track.enabled = true;
        e.track.addEventListener('unmute', onTrackUnmute);
        playVideo('addtrack');
      }
    };

    activeStream.addEventListener('addtrack', handleAddTrack);

    const onLoadedMetadata = () => {
      updateDebug('loadedmetadata');
      playVideo('loadedmetadata');
    };
    const onLoadedData = () => {
      updateDebug('loadeddata');
      checkRendering();
    };
    const onCanPlay = () => {
      updateDebug('canplay');
      playVideo('canplay');
    };
    const onPlaying = () => {
      updateDebug('playing');
      checkRendering();
    };
    const onTimeUpdate = () => {
      updateDebug('timeupdate');
      checkRendering();
    };
    const onError = () => {
      updateDebug(`error: ${videoEl.error ? videoEl.error.message : 'desconhecido'}`);
    };

    videoEl.addEventListener('loadedmetadata', onLoadedMetadata);
    videoEl.addEventListener('loadeddata', onLoadedData);
    videoEl.addEventListener('canplay', onCanPlay);
    videoEl.addEventListener('playing', onPlaying);
    videoEl.addEventListener('timeupdate', onTimeUpdate);
    videoEl.addEventListener('error', onError);

    let attempts = 0;
    const pollInterval = setInterval(() => {
      attempts++;
      playVideo('poll');
      checkRendering();
      if ((videoEl && videoEl.videoWidth > 0) || attempts > 15) {
        clearInterval(pollInterval);
      }
    }, 250);

    const handleMediaRecovered = () => {
      playVideo('media-recovered');
      checkRendering();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        playVideo('visibilitychange');
        checkRendering();
      }
    };

    window.addEventListener('capy:media-recovered', handleMediaRecovered);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', () => playVideo('window-focus'));
    window.addEventListener('pageshow', () => playVideo('pageshow'));

    return () => {
      clearInterval(pollInterval);
      videoTracks.forEach((t) => {
        t.removeEventListener('unmute', onTrackUnmute);
      });
      activeStream.removeEventListener('addtrack', handleAddTrack);
      videoEl.removeEventListener('loadedmetadata', onLoadedMetadata);
      videoEl.removeEventListener('loadeddata', onLoadedData);
      videoEl.removeEventListener('canplay', onCanPlay);
      videoEl.removeEventListener('playing', onPlaying);
      videoEl.removeEventListener('timeupdate', onTimeUpdate);
      videoEl.removeEventListener('error', onError);
      window.removeEventListener('capy:media-recovered', handleMediaRecovered);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeStream, currentSelectedShare?.id, viewMode]);

  // Log de diagnóstico detalhado para monitoramento de transmissões locais e remotas
  useEffect(() => {
    console.log('[DiscordVoiceStage Diagnostic]', {
      currentUser: currentUser.name,
      currentUserId: currentUser.id,
      focusedParticipantId,
      currentSelectedShare: currentSelectedShare
        ? { id: currentSelectedShare.id, title: currentSelectedShare.title, isLocal: currentSelectedShare.isLocal }
        : null,
      activeScreenShares: activeScreenShares.map((s) => ({
        id: s.id,
        title: s.title,
        isLocal: s.isLocal,
        trackCount: s.stream ? s.stream.getVideoTracks().length : 0,
        tracks: s.stream ? s.stream.getVideoTracks().map((t) => ({ id: t.id, readyState: t.readyState, muted: t.muted })) : [],
      })),
      participants: participants.map((p) => ({
        id: p.user.id,
        name: p.user.displayName || p.user.name,
        isScreenSharing: p.isScreenSharing,
        hasMediaStream: Boolean(p.mediaStream),
        videoTrackCount: p.mediaStream?.getVideoTracks().length || 0,
      })),
      videoElConnectedStreamId: screenVideoRef.current?.srcObject
        ? (screenVideoRef.current.srcObject as MediaStream).id
        : null,
    });
  }, [activeScreenShares, focusedParticipantId, currentSelectedShare, participants]);

  const handleToggleScreenShare = () => {
    if (screenStream) {
      stopScreenShare();
    } else {
      openShareModal();
    }
  };

  const getGridClass = (count: number) => {
    if (count <= 1) return 'max-w-md w-full aspect-video';
    if (count === 2) return 'grid grid-cols-1 sm:grid-cols-2 max-w-2xl w-full gap-4 h-full max-h-[320px]';
    if (count <= 4) return 'grid grid-cols-2 max-w-3xl w-full gap-4 h-full max-h-[460px]';
    if (count <= 6) return 'grid grid-cols-2 md:grid-cols-3 max-w-4xl w-full gap-4 h-full max-h-[500px]';
    return 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-5xl w-full gap-4 h-full overflow-y-auto';
  };

  const renderParticipantCard = (
    p: VoiceParticipant,
    isSingle = false,
    isCompact = false,
    activeShare?: ActiveScreenShare,
  ) => {
    const isUserSpeaking = p.isSpeaking;
    const isSelected = activeShare && currentSelectedShare?.id === activeShare.id;

    if (isCompact) {
      // Se este participante estiver compartilhando tela, exibe card com miniatura de vídeo em tempo real
      if (activeShare) {
        return (
          <div
            key={`compact-share-${p.user.id}`}
            onClick={() => {
              handleEnterStream(p.user.id, activeShare.sessionId);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setVoiceContextMenu({
                user: p.user,
                position: { x: e.clientX, y: e.clientY },
              });
            }}
            title={isSelected ? `Assistindo à tela de ${p.user.displayName || p.user.name}` : `Clique para assistir à tela de ${p.user.displayName || p.user.name}`}
            className={`relative bg-[#111214] rounded-xl overflow-hidden flex flex-col items-center justify-center border transition-all duration-150 cursor-pointer select-none w-36 h-22 sm:w-44 sm:h-26 flex-shrink-0 group ${
              isSelected
                ? 'border-[#5865f2] ring-2 ring-[#5865f2] shadow-[0_0_16px_rgba(88,101,242,0.45)]'
                : 'border-[#ef4444]/60 hover:border-[#5865f2] hover:ring-1 hover:ring-[#5865f2]/60'
            }`}
          >
            {/* Miniatura de vídeo em tempo real da transmissão */}
            <StreamMiniThumbnail stream={activeShare.stream} />

            {/* Selo superior (ASSISTINDO vs AO VIVO) */}
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1 pointer-events-none">
              {isSelected ? (
                <span className="bg-[#5865f2] text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow">
                  <Tv className="w-2.5 h-2.5" />
                  ASSISTINDO
                </span>
              ) : (
                <span className="bg-[#ef4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 shadow">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  AO VIVO
                </span>
              )}
            </div>

            {/* Identificação inferior do participante */}
            <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[11px] bg-black/75 backdrop-blur-sm px-1.5 py-0.5 rounded text-white pointer-events-none">
              <div className="flex items-center gap-1.5 truncate">
                <img
                  src={getAvatarUrl(p.user.avatar)}
                  alt={p.user.name}
                  className="w-4 h-4 rounded-full object-cover flex-shrink-0"
                />
                <span className="truncate max-w-[95px] font-medium text-[11px]">
                  {activeShare.isLocal ? 'Sua Tela' : (p.user.displayName || p.user.name)}
                </span>
              </div>
              {p.isMuted && <MicOff className="w-3 h-3 text-[#ef4444] flex-shrink-0 ml-1" />}
            </div>
          </div>
        );
      }

      // Participante apenas em áudio/voz na faixa inferior
      return (
        <div
          key={p.user.id}
          onClick={() => {
            if (p.isScreenSharing) {
              setFocusedParticipantId(p.user.id);
              setViewMode('stage');
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setVoiceContextMenu({
              user: p.user,
              position: { x: e.clientX, y: e.clientY },
            });
          }}
          className={`relative bg-[#111214] rounded-xl overflow-hidden flex flex-col items-center justify-center border transition-all duration-150 cursor-pointer select-none w-32 h-20 sm:w-36 sm:h-22 flex-shrink-0 ${
            isUserSpeaking
              ? 'border-[#22c55e] ring-2 ring-[#22c55e] shadow-[0_0_12px_rgba(34,197,94,0.4)]'
              : 'border-[#1f2023] hover:border-[#35373c]'
          }`}
        >
          <div className="relative">
            <img
              src={getAvatarUrl(p.user.avatar)}
              alt={p.user.name}
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover transition-all ${
                isUserSpeaking ? 'ring-2 ring-[#22c55e]' : ''
              }`}
            />
          </div>
          <div className="absolute bottom-1 left-1.5 right-1.5 flex items-center justify-between text-[11px] bg-black/60 backdrop-blur-sm px-1.5 py-0.5 rounded text-white pointer-events-none">
            <span className="truncate max-w-[100px] font-medium">
              {p.user.displayName || p.user.name}
            </span>
            {p.isMuted && <MicOff className="w-3 h-3 text-[#ef4444]" />}
          </div>
        </div>
      );
    }

    // Grid oficial de participantes (canal de voz sem transmissão ativa)
    return (
      <div
        key={p.user.id}
        onClick={() => {
          if (p.isScreenSharing || activeShare || voiceService.isParticipantSharing(p.user.id)) {
            const session = voiceService.getActiveShareSession(p.user.id);
            handleEnterStream(p.user.id, session?.sessionId);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setVoiceContextMenu({
            user: p.user,
            position: { x: e.clientX, y: e.clientY },
          });
        }}
        className={`relative bg-[#111214] rounded-2xl overflow-hidden flex flex-col items-center justify-center border transition-all duration-150 cursor-pointer select-none w-full h-full min-h-[180px] max-h-[360px] p-6 shadow-xl ${
          isUserSpeaking
            ? 'border-[#22c55e]/60 shadow-[0_0_20px_rgba(34,197,94,0.25)]'
            : 'border-[#1f2023] hover:border-[#2b2d31]'
        }`}
      >
        {/* Avatar Central com borda verde brilhante (#22c55e) ao emitir áudio ou Câmera */}
        <div className="relative flex items-center justify-center">
          {p.isVideoOn && p.mediaStream ? (
            <video
              autoPlay
              playsInline
              muted
              ref={(el) => {
                if (el && p.mediaStream && el.srcObject !== p.mediaStream) {
                  el.srcObject = p.mediaStream;
                  el.play().catch(() => {});
                }
              }}
              className={`w-28 h-28 sm:w-36 sm:h-36 rounded-xl object-cover transition-all duration-150 select-none ${
                isUserSpeaking
                  ? 'ring-4 ring-[#22c55e] shadow-[0_0_16px_rgba(34,197,94,0.6)]'
                  : 'ring-1 ring-white/10'
              }`}
            />
          ) : (
            <img
              src={getAvatarUrl(p.user.avatar)}
              alt={p.user.name}
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover transition-all duration-150 select-none ${
                isUserSpeaking
                  ? 'ring-4 ring-[#22c55e] shadow-[0_0_16px_rgba(34,197,94,0.6)]'
                  : 'ring-1 ring-white/10'
              }`}
            />
          )}
        </div>

        {/* Nome do Usuário abaixo do avatar com fonte compacta (text-sm font-medium text-white) */}
        <div className="mt-3.5 flex items-center justify-center gap-2 max-w-[90%]">
          <span className="text-sm font-medium text-white truncate">
            {p.user.displayName || p.user.name}
          </span>
          {p.isMuted && (
            <span title="Microfone Silenciado">
              <MicOff className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
            </span>
          )}
          {p.isDeafened && (
            <span title="Áudio Desativado">
              <VolumeX className="w-4 h-4 text-[#ef4444] flex-shrink-0" />
            </span>
          )}
          {voiceService.isParticipantSharing(p.user.id) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const session = voiceService.getActiveShareSession(p.user.id);
                handleEnterStream(p.user.id, session?.sessionId);
              }}
              title="Entrar na transmissão ao vivo"
              className="flex items-center gap-1.5 px-3 py-1 bg-[#5865f2] hover:bg-[#4752c4] text-white text-xs font-semibold rounded-md shadow-md transition-all cursor-pointer"
            >
              <span className="bg-[#ef4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                AO VIVO
              </span>
              <span className="flex items-center gap-1">
                <Play className="w-3 h-3 fill-current" />
                Entrar na Transmissão
              </span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`flex-1 flex flex-col h-full ${
        isOled ? 'bg-black' : 'bg-[#313338]'
      } select-none min-w-0 relative overflow-hidden`}
    >
      {/* 1. Voice Stage Header */}
      <header
        className={`h-12 px-4 flex items-center justify-between border-b ${
          isOled ? 'border-[#1a1a1a] bg-black' : 'border-[#202225] bg-[#313338]'
        } flex-shrink-0 z-20`}
      >
        <div className="flex items-center gap-2.5">
          <Volume2 className="w-5 h-5 text-[#23a55a]" />
          <h1 className="font-semibold text-sm text-[#f2f3f5] truncate">
            {voiceState.channelName || 'Transmissão Ao Vivo'}
          </h1>

          {hasActiveStream ? (
            <span className="bg-[#ef4444] text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
              <Radio className="w-3 h-3 animate-pulse" />
              AO VIVO
            </span>
          ) : (
            <span className="bg-[#23a55a]/15 text-[#23a55a] text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#23a55a]/30">
              <Volume2 className="w-3 h-3" />
              VOZ CONECTADA
            </span>
          )}

          <span className="text-xs text-[#949ba4] hidden md:inline">
            • {participants.length} conectado{participants.length !== 1 ? 's' : ''} • RTC {voiceState.pingMs || 24}ms
          </span>

          {voiceState.error && (
            <span
              title={voiceState.error}
              className="bg-[#da373c]/20 text-[#f23f43] text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#da373c]/40 truncate max-w-[220px]"
            >
              <MicOff className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{voiceState.error}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Botão destacado: Parar de Assistir (se estiver assistindo transmissão remota) */}
          {watchingShareId && currentSelectedShare && !currentSelectedShare.isLocal && (
            <button
              onClick={handleLeaveStream}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-[4px] bg-[#da373c] hover:bg-[#a1282c] text-white text-xs font-semibold shadow-md transition-all cursor-pointer border border-transparent"
              title="Sair da transmissão e voltar à grade (áudio continua ativo)"
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Parar de Assistir</span>
            </button>
          )}

          {/* Alternador de Grade / Palco */}
          {hasActiveStream && (
            <button
              onClick={() => {
                if (viewMode === 'stage') {
                  setViewMode('grid');
                } else {
                  if (!currentSelectedShare && activeScreenShares.length > 0) {
                    const first = activeScreenShares.find((s) => !s.isLocal) || activeScreenShares[0];
                    setWatchingShareId(first.id);
                  }
                  setViewMode('stage');
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] bg-[#2b2d31] hover:bg-[#35373c] text-xs font-medium text-[#dbdee1] transition-colors cursor-pointer border border-[#1f2023]"
            >
              {viewMode === 'stage' ? (
                <>
                  <LayoutGrid className="w-3.5 h-3.5 text-[#5865f2]" />
                  <span>Modo Grade</span>
                </>
              ) : (
                <>
                  <Tv className="w-3.5 h-3.5 text-[#23a55a]" />
                  <span>Modo Palco</span>
                </>
              )}
            </button>
          )}

          {/* Diagnóstico de Transmissão WebRTC */}
          <button
            onClick={() => setIsDiagnosticsOpen((v) => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs font-medium transition-colors cursor-pointer border ${
              isDiagnosticsOpen
                ? 'bg-[#5865f2] text-white border-[#5865f2]'
                : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] border-[#1f2023]'
            }`}
            title="Abrir painel de diagnóstico WebRTC em tempo real"
          >
            <Activity className="w-3.5 h-3.5 text-[#5865f2]" />
            <span className="hidden md:inline">Diagnóstico de transmissão</span>
            <span className="md:hidden">Diag</span>
          </button>

          {/* Open Chat */}
          <button
            onClick={() => setActiveView('chat')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] bg-[#2b2d31] hover:bg-[#35373c] text-xs font-medium text-[#dbdee1] transition-colors cursor-pointer border border-[#1f2023]"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Chat de Texto</span>
          </button>

          <button
            title="Tela Cheia"
            className="p-1.5 rounded text-[#949ba4] hover:text-[#dbdee1] hover:bg-[#35373c] transition-colors cursor-pointer"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Main Content Area */}
      {currentSelectedShare !== null && viewMode === 'stage' ? (
        /* ── MODO PALCO COM STREAM ATIVO ── */
        <div
          className={`flex-1 flex flex-col p-3 gap-3 overflow-hidden relative ${
            isOled ? 'bg-black' : 'bg-[#313338]'
          } pb-24`}
        >
          {/* Seletor de Transmissões Múltiplas (Estilo Clássico do Discord) */}
          {activeScreenShares.length > 1 && (
            <div className="flex-shrink-0 flex items-center justify-between bg-[#1e1f22]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-[#2b2d31] shadow-lg">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-[#5865f2]/20 text-[#5865f2]">
                  <Tv className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#f2f3f5] flex items-center gap-1.5">
                    <span>Transmissões Disponíveis</span>
                    <span className="bg-[#5865f2] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                      {activeScreenShares.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#949ba4] hidden sm:block">
                    Selecione qual tela deseja assistir no palco principal
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                {activeScreenShares.map((share) => {
                  const isSelected = currentSelectedShare?.id === share.id;
                  return (
                    <button
                      key={`stream-selector-${share.id}`}
                      type="button"
                      onClick={() => handleEnterStream(share.id, share.sessionId)}
                      title={`Assistir transmissão de ${share.user.displayName || share.user.name}`}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border select-none ${
                        isSelected
                          ? 'bg-[#5865f2] text-white border-[#5865f2] shadow-md shadow-[#5865f2]/30 ring-1 ring-white/20'
                          : 'bg-[#2b2d31] hover:bg-[#35373c] text-[#dbdee1] border-[#1f2023] hover:border-[#404249]'
                      }`}
                    >
                      <div className="relative">
                        <img
                          src={getAvatarUrl(share.user.avatar)}
                          alt={share.user.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black ${
                            isSelected ? 'bg-white' : 'bg-[#ef4444]'
                          }`}
                        />
                      </div>
                      <span className="truncate max-w-[130px]">
                        {share.isLocal ? 'Sua Tela' : (share.user.displayName || share.user.name)}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                          isSelected
                            ? 'bg-black/30 text-white'
                            : 'bg-[#ef4444]/20 text-[#f23f43]'
                        }`}
                      >
                        {isSelected ? 'Assistindo' : 'Assistir'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Spotlight screen-share area */}
          <div className="flex-1 bg-[#111214] rounded-xl overflow-hidden relative flex items-center justify-center border border-[#1f2023] shadow-lg min-h-0">
            <video
              ref={screenVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-contain bg-black"
              onLoadedMetadata={(e) => {
                e.currentTarget.muted = true;
                e.currentTarget.play().catch(() => {});
                if (e.currentTarget.videoWidth > 0) {
                  setIsVideoRendering(true);
                  setIsConnectingStream(false);
                }
              }}
            />

            {/* Overlay de carregamento / conexão suave (evita tela preta morta) */}
            {(!isVideoRendering || isConnectingStream) && !currentSelectedShare?.isLocal && (
              <div className="absolute inset-0 bg-[#111214]/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-10 pointer-events-none">
                <div className="relative">
                  <img
                    src={getAvatarUrl(currentSelectedShare?.user.avatar)}
                    alt={currentSelectedShare?.user.name}
                    className="w-16 h-16 rounded-full object-cover ring-4 ring-[#5865f2]/40"
                  />
                  <div className="absolute -inset-1 rounded-full border-2 border-transparent border-t-[#5865f2] animate-spin" />
                </div>
                <div className="text-center px-4">
                  <p className="text-sm font-semibold text-white">
                    Conectando à transmissão de {currentSelectedShare?.user.displayName || currentSelectedShare?.user.name}...
                  </p>
                  <p className="text-xs text-[#949ba4] mt-1">
                    Sincronizando áudio e vídeo WebRTC em tempo real
                  </p>
                </div>
              </div>
            )}

            {/* Top left stream info */}
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 pointer-events-none">
              <span className="bg-[#ef4444] text-white text-[9px] font-bold px-1.5 py-0.5 rounded leading-none flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                AO VIVO
              </span>
              <span className="text-xs font-medium text-white">
                {activeStreamOwner}
              </span>
              {activeScreenShares.length > 1 && currentSelectedShare && (
                <span className="bg-[#5865f2]/80 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
                  {activeScreenShares.findIndex((s) => s.id === currentSelectedShare?.id) + 1} de {activeScreenShares.length} telas
                </span>
              )}
            </div>

            {/* Top right stream actions */}
            <div className="absolute top-3 right-3 flex items-center gap-2">
              {Boolean(screenStream) && (
                <button
                  onClick={openShareModal}
                  className="flex items-center gap-1.5 bg-black/80 hover:bg-[#35373c] backdrop-blur-md px-2 py-1 rounded text-xs text-[#dbdee1] border border-white/10 transition-colors cursor-pointer"
                  title="Trocar tela ou janela compartilhada"
                >
                  <Layers className="w-3.5 h-3.5 text-[#8b5cf6]" />
                  <span>Trocar Janela</span>
                </button>
              )}

              <button
                onClick={() => setIsDiagnosticsOpen(true)}
                className="flex items-center gap-1.5 bg-black/80 hover:bg-[#35373c] backdrop-blur-md px-2 py-1 rounded text-xs text-[#dbdee1] border border-white/10 transition-colors cursor-pointer"
                title="Abrir painel de diagnóstico WebRTC em tempo real"
              >
                <Activity className="w-3.5 h-3.5 text-[#5865f2]" />
                <span>Diagnóstico de transmissão</span>
              </button>

              <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2 py-1 rounded text-[11px] text-[#949ba4] pointer-events-none border border-white/5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#23a55a]" />
                <span>WebRTC</span>
              </div>
            </div>
          </div>

          {/* Compact participants row below stage with live mini thumbnails */}
          <div className="flex-shrink-0 flex items-center justify-center gap-2 overflow-x-auto py-1 px-2 max-w-full">
            {participants.map((p) => {
              const activeShare = activeScreenShares.find((s) => s.id === p.user.id);
              return renderParticipantCard(p, false, true, activeShare);
            })}
          </div>
        </div>
      ) : hasActiveStream && viewMode === 'grid' ? (
        /* ── MODO GRADE COM STREAM ATIVO ── */
        <div
          className={`flex-1 flex flex-col p-4 overflow-hidden relative ${
            isOled ? 'bg-black' : 'bg-[#313338]'
          } pb-24`}
        >
          {/* Top selector if multiple streams in grid mode too */}
          {activeScreenShares.length > 1 && (
            <div className="flex-shrink-0 flex items-center justify-between bg-[#1e1f22]/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[#2b2d31] shadow mb-3">
              <span className="text-xs text-[#dbdee1] flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-[#5865f2]" />
                {activeScreenShares.length} transmissões simultâneas ativas
              </span>
              <button
                type="button"
                onClick={() => setViewMode('stage')}
                className="text-xs text-[#5865f2] hover:underline font-medium cursor-pointer"
              >
                Voltar ao Modo Palco
              </button>
            </div>
          )}

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 max-w-5xl w-full mx-auto gap-3 h-full overflow-y-auto">
            {/* Stream tiles for each active share */}
            {activeScreenShares.map((share) => {
              const isSelected = currentSelectedShare?.id === share.id;
              return (
                <div
                  key={`grid-stream-${share.id}`}
                  onClick={() => handleEnterStream(share.id, share.sessionId)}
                  className={`relative bg-black rounded-xl overflow-hidden flex items-center justify-center border transition-all cursor-pointer w-full h-full min-h-[160px] max-h-[360px] shadow-lg ${
                    isSelected
                      ? 'border-[#5865f2] ring-2 ring-[#5865f2]'
                      : 'border-[#1f2023] hover:border-[#5865f2]/70'
                  }`}
                >
                  <StreamMiniThumbnail stream={share.stream} />
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/75 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-white border border-white/10 pointer-events-none">
                    <span className="bg-[#ef4444] px-1 py-0.2 rounded text-[9px]">AO VIVO</span>
                    <span className="truncate max-w-[120px]">{share.title}</span>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-white/90 pointer-events-none">
                    Clique para focar
                  </div>
                </div>
              );
            })}

            {/* Non-sharing participants in grid */}
            {participants
              .filter((p) => !activeScreenShares.some((s) => s.id === p.user.id))
              .map((p) => renderParticipantCard(p, false, false))}
          </div>
        </div>
      ) : (
        /* ── MODO GRADE PADRÃO DISCORD (SEM TRANSMISSÃO) ── */
        <div
          className={`flex-1 flex items-center justify-center p-6 overflow-hidden relative ${
            isOled ? 'bg-black' : 'bg-[#313338]'
          } pb-24`}
        >
          {participants.length <= 1 ? (
            <div className="max-w-md w-full aspect-[4/3] sm:aspect-video flex items-center justify-center">
              {renderParticipantCard(participants[0], true, false)}
            </div>
          ) : (
            <div className={getGridClass(participants.length)}>
              {participants.map((p) => renderParticipantCard(p, false, false))}
            </div>
          )}
        </div>
      )}

      {/* 3. Floating Controls Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#111214]/95 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-2xl flex items-center gap-2 border border-[#232428] z-30">
        {/* Camera */}
        <button
          onClick={toggleVideo}
          title={isVideoOn ? 'Desligar Câmera' : 'Ligar Câmera'}
          className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
            isVideoOn
              ? 'bg-white text-black hover:bg-slate-200'
              : 'bg-[#1f2023] hover:bg-[#2b2d31]'
          }`}
        >
          <img
            src={getAssetUrl('brand/03_UI_Icons_SVG/btn_call_camera.svg')}
            alt="Câmera"
            className="w-5 h-5 object-contain"
          />
        </button>

        {/* Screen Share */}
        <button
          onClick={handleToggleScreenShare}
          title={screenStream ? 'Parar Compartilhamento de Tela' : 'Compartilhar Tela'}
          className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
            screenStream
              ? 'bg-[#8b5cf6] text-white hover:bg-[#7c3aed] shadow-md shadow-[#8b5cf6]/40'
              : 'bg-[#1f2023] hover:bg-[#2b2d31]'
          }`}
        >
          <img
            src={getAssetUrl('brand/03_UI_Icons_SVG/icon_compartilhar_tela.svg')}
            alt="Compartilhar Tela"
            className="w-5 h-5 object-contain"
          />
        </button>

        {/* Mic Mute */}
        <button
          onClick={toggleMute}
          title={isMicMuted ? 'Desmutar Microfone' : 'Mutar Microfone'}
          className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
            isMicMuted
              ? 'bg-[#ef4444] text-white hover:bg-[#dc2626]'
              : 'bg-[#1f2023] hover:bg-[#2b2d31]'
          }`}
        >
          <img
            src={getAssetUrl('brand/03_UI_Icons_SVG/btn_call_mic.svg')}
            alt="Microfone"
            className="w-5 h-5 object-contain"
          />
        </button>

        {/* Audio/Video Settings */}
        <button
          onClick={openSettingsModal}
          title="Configurações de Áudio e Vídeo"
          className="p-2 bg-[#1f2023] hover:bg-[#2b2d31] rounded-lg transition-colors cursor-pointer"
        >
          <img
            src={getAssetUrl('brand/03_UI_Icons_SVG/icon_configuracoes.svg')}
            alt="Configurações"
            className="w-5 h-5 object-contain"
          />
        </button>

        <div className="w-[1px] h-5 bg-[#35373c] mx-0.5" />

        {/* Disconnect Call */}
        <button
          onClick={disconnectAll}
          title="Desconectar da Chamada"
          className="px-3 py-2 bg-[#da373c] hover:bg-[#a12829] text-white font-medium text-xs rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <img
            src={getAssetUrl('brand/03_UI_Icons_SVG/btn_call_hangup.svg')}
            alt="Desconectar"
            className="w-4.5 h-4.5 object-contain"
          />
          <span className="hidden sm:inline">Desconectar</span>
        </button>
      </div>

      {/* WebRTC Diagnostics Modal */}
      <WebRTCDiagnosticsModal
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        videoEl={screenVideoRef.current}
        videoDebugInfo={videoDebugInfo}
        activePresenterId={currentSelectedShare && !currentSelectedShare.isLocal ? currentSelectedShare.id : null}
        onForceKeyframe={() => {
          if (currentSelectedShare && !currentSelectedShare.isLocal) {
            voiceService.enterStream(currentSelectedShare.id, currentSelectedShare.sessionId);
          }
        }}
        onForcePlay={() => {
          const el = screenVideoRef.current;
          if (el) {
            el.muted = true;
            el.play().catch((err) => {
              setVideoDebugInfo((prev) => ({ ...prev, playResult: `Erro: ${err.name || err.message}` }));
            });
          }
        }}
      />

      {/* Voice User Context Menu */}
      {voiceContextMenu && (
        <DiscordUserContextMenu
          user={voiceContextMenu.user}
          position={voiceContextMenu.position}
          context="voice"
          onClose={() => setVoiceContextMenu(null)}
          onOpenProfile={(u) => {
            setVoiceContextMenu(null);
            openMemberPopout(u, {
              top: voiceContextMenu.position.y,
              right: window.innerWidth - voiceContextMenu.position.x,
            });
          }}
        />
      )}
    </div>
  );
};
