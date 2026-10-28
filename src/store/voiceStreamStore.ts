import { create } from 'zustand';
import { ElectronScreenSource } from '../types/discord';
import { useDiscord } from './discordStore';

export type VideoResolution = '144p' | '240p' | '360p' | '480p' | '720p' | '1080p';
export type VideoFrameRate = 10 | 15 | 24 | 30 | 60;
export type QualityPreset = 'economy' | 'low_internet' | 'balanced' | 'high' | 'ultra' | 'custom';
export type BitrateMode = 'auto' | 200 | 500 | 1000 | 2500 | 5000;

export interface StreamQuality {
  resolution: VideoResolution;
  frameRate: VideoFrameRate;
  preset: QualityPreset;
  optimizeForText: boolean;
  bitrateKbps: BitrateMode;
  includeAudio: boolean;
}

export const RESOLUTION_DIMENSIONS: Record<
  VideoResolution,
  { width: number; height: number; minWidth: number; minHeight: number }
> = {
  '144p': { width: 256, height: 144, minWidth: 128, minHeight: 72 },
  '240p': { width: 426, height: 240, minWidth: 213, minHeight: 120 },
  '360p': { width: 640, height: 360, minWidth: 320, minHeight: 180 },
  '480p': { width: 854, height: 480, minWidth: 426, minHeight: 240 },
  '720p': { width: 1280, height: 720, minWidth: 640, minHeight: 360 },
  '1080p': { width: 1920, height: 1080, minWidth: 960, minHeight: 540 },
};

export const DEFAULT_STREAM_QUALITY: StreamQuality = {
  resolution: '720p',
  frameRate: 30,
  preset: 'high',
  optimizeForText: false,
  bitrateKbps: 'auto',
  includeAudio: false,
};

interface VoiceStreamStore {
  // Streams e áudio
  screenStream: MediaStream | null;
  micStream: MediaStream | null;
  audioCtx: AudioContext | null;
  isSpeaking: boolean;
  activeSourceName: string;
  quality: StreamQuality;

  // Estado do Modal de compartilhamento
  isShareModalOpen: boolean;
  availableSources: ElectronScreenSource[];
  selectedSource: ElectronScreenSource | null;

  // Ações do Modal
  openShareModal: () => Promise<void>;
  closeShareModal: () => void;
  refreshSources: () => Promise<void>;
  setSelectedSource: (source: ElectronScreenSource) => void;
  setQuality: (quality: StreamQuality | ((prev: StreamQuality) => StreamQuality)) => void;

  // Controle de Transmissão de Tela
  startScreenShare: (source?: ElectronScreenSource, qualityOverride?: StreamQuality) => Promise<void>;
  stopScreenShare: () => void;

  // Controle de Microfone e VAD
  initMic: (overrideDeviceId?: string) => Promise<void>;
  applyAudioConstraints: (overrideDeviceId?: string) => Promise<void>;
  stopMic: () => void;
  setSpeaking: (isSpeaking: boolean) => void;

  // Desconexão total
  disconnectAll: () => void;
}

let vadRafId = 0;
const VAD_THRESHOLD = 18;

/**
 * Retorna as restrições de áudio calibradas para voz limpa com fidelidade de estúdio.
 * Harmoniza perfis de áudio (Isolamento de Voz, Estúdio, Personalizado) e preferências salvas.
 */
export function getVoiceAudioConstraints(overrideDeviceId?: string): MediaTrackConstraints {
  const hasWindow = typeof window !== 'undefined';
  const savedDeviceId =
    overrideDeviceId !== undefined
      ? overrideDeviceId
      : hasWindow && window.localStorage
      ? window.localStorage.getItem('lyc_selected_input_device')
      : null;

  const profile =
    hasWindow && window.localStorage
      ? window.localStorage.getItem('lyc_audio_profile') || 'voice-isolation'
      : 'voice-isolation';

  const noiseSetting =
    hasWindow && window.localStorage
      ? window.localStorage.getItem('lyc_noise_suppression') || 'krisp'
      : 'krisp';

  const echoSetting =
    hasWindow && window.localStorage
      ? window.localStorage.getItem('lyc_echo_cancellation') !== 'false'
      : true;

  const autoGainSetting =
    hasWindow && window.localStorage
      ? window.localStorage.getItem('lyc_auto_gain') !== 'false'
      : true;

  let echoCancellation = echoSetting;
  let noiseSuppression = noiseSetting !== 'none';
  let autoGainControl = autoGainSetting;

  if (profile === 'studio') {
    // Modo estúdio: microfone aberto sem filtragem ou corte de frequências
    echoCancellation = false;
    noiseSuppression = false;
    autoGainControl = false;
  } else if (profile === 'voice-isolation') {
    // Isolamento de voz: processamento equilibrado
    echoCancellation = true;
    noiseSuppression = true;
    autoGainControl = true;
  }

  const constraints: any = {
    echoCancellation,
    noiseSuppression,
    autoGainControl,
    sampleRate: { ideal: 48000 },
    channelCount: { ideal: 1 },
    // Parâmetros Chromium/WebRTC para nitidez e ausência de ruídos mecânicos
    googEchoCancellation: echoCancellation,
    googAutoGainControl: autoGainControl,
    googNoiseSuppression: noiseSuppression,
    googHighpassFilter: true, // Filtra sub-rumble mecânico abaixo de 80Hz para não abafar a voz
    googTypingNoiseDetection: noiseSuppression,
    googAudioMirroring: false,
  };

  if (savedDeviceId && savedDeviceId !== 'default' && savedDeviceId !== '') {
    constraints.deviceId = { ideal: savedDeviceId };
  }

  return constraints;
}

export const useVoiceStreamStore = create<VoiceStreamStore>((set, get) => ({
  screenStream: null,
  micStream: null,
  audioCtx: null,
  isSpeaking: false,
  activeSourceName: 'Tela Principal',
  quality: DEFAULT_STREAM_QUALITY,

  isShareModalOpen: false,
  availableSources: [],
  selectedSource: null,

  openShareModal: async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getScreenSources) {
        const sources = await window.electronAPI.getScreenSources();
        const initialSelected =
          sources.find(
            (s) =>
              s.id.startsWith('screen:') ||
              s.name.toLowerCase().includes('tela 1') ||
              s.name.toLowerCase().includes('screen') ||
              s.name.toLowerCase().includes('entire'),
          ) ||
          sources[0] ||
          null;

        set({
          availableSources: sources,
          selectedSource: initialSelected,
          isShareModalOpen: true,
        });
      } else {
        // Fallback navegador comum / web: sem Electron desktopCapturer, abre direto getDisplayMedia
        await get().startScreenShare();
      }
    } catch (err) {
      console.error('Erro ao listar telas no Electron:', err);
    }
  },

  closeShareModal: () => {
    set({ isShareModalOpen: false });
  },

  refreshSources: async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getScreenSources) {
        const sources = await window.electronAPI.getScreenSources();
        set((state) => {
          const stillExists = sources.some((s) => s.id === state.selectedSource?.id);
          const newSelected = stillExists
            ? state.selectedSource
            : sources[0] || null;
          return { availableSources: sources, selectedSource: newSelected };
        });
      }
    } catch (err) {
      console.warn('Erro ao atualizar fontes de tela:', err);
    }
  },

  setSelectedSource: (source) => {
    set({ selectedSource: source });
  },

  setQuality: (qualityOrFn) => {
    set((state) => ({
      quality: typeof qualityOrFn === 'function' ? qualityOrFn(state.quality) : qualityOrFn,
    }));
  },

  startScreenShare: async (sourceOverride, qualityOverride) => {
    const { selectedSource, quality } = get();
    const source = sourceOverride || selectedSource;
    const streamQuality = qualityOverride || quality;

    try {
      // 1. Caso Electron (desktopCapturer ativo)
      if (source && typeof window !== 'undefined' && window.electronAPI) {
        // Se já houver stream ativa, pare as tracks antigas
        const currentStream = get().screenStream;
        if (currentStream) {
          currentStream.getTracks().forEach((t) => t.stop());
        }

        const dims = RESOLUTION_DIMENSIONS[streamQuality.resolution] || RESOLUTION_DIMENSIONS['720p'];
        const fps = streamQuality.frameRate || 30;

        const videoConstraints: any = {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: source.id,
            maxWidth: dims.width,
            maxHeight: dims.height,
            maxFrameRate: fps,
          },
        };

        const audioConstraints: any = streamQuality.includeAudio
          ? {
              mandatory: {
                chromeMediaSource: 'desktop',
              },
            }
          : false;

        const stream = await (navigator.mediaDevices as any).getUserMedia({
          audio: audioConstraints,
          video: videoConstraints,
        });

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          if ('contentHint' in videoTrack) {
            videoTrack.contentHint = streamQuality.optimizeForText ? 'detail' : 'motion';
          }
          videoTrack.onended = () => {
            get().stopScreenShare();
          };
        }

        set({
          screenStream: stream,
          activeSourceName: source.name,
          isShareModalOpen: false,
        });

        // Atualiza estado do discordStore
        useDiscord.setState({ isScreenSharing: true });
        return;
      }

      // 2. Fallback Web Browser / Next.js comum
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getDisplayMedia) {
        const dims = RESOLUTION_DIMENSIONS[streamQuality.resolution] || RESOLUTION_DIMENSIONS['720p'];
        const fps = streamQuality.frameRate || 30;

        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { max: dims.width },
            height: { max: dims.height },
            frameRate: { max: fps },
          },
          audio: Boolean(streamQuality.includeAudio),
        });

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          if ('contentHint' in videoTrack) {
            videoTrack.contentHint = streamQuality.optimizeForText ? 'detail' : 'motion';
          }
          videoTrack.onended = () => {
            get().stopScreenShare();
          };
        }

        set({
          screenStream: stream,
          activeSourceName: 'Sua Tela',
          isShareModalOpen: false,
        });

        useDiscord.setState({ isScreenSharing: true });
      }
    } catch (err) {
      console.warn('Compartilhamento de tela cancelado ou falhou:', err);
    }
  },

  stopScreenShare: () => {
    const { screenStream } = get();
    if (screenStream) {
      screenStream.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
    }
    set({ screenStream: null });
    useDiscord.setState({ isScreenSharing: false });
  },

  initMic: async (overrideDeviceId?: string) => {
    if (get().micStream) return; // já inicializado

    try {
      const audioConstraints = getVoiceAudioConstraints(overrideDeviceId);

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch (firstErr) {
        console.warn('[voiceStreamStore] Captura com restrições ideais falhou, tentando fallback W3C:', firstErr);
        try {
          const profile =
            typeof window !== 'undefined' && window.localStorage
              ? window.localStorage.getItem('lyc_audio_profile') || 'voice-isolation'
              : 'voice-isolation';
          const echoCancellation = profile !== 'studio';
          const noiseSuppression = profile !== 'studio';

          stream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation,
              noiseSuppression,
            },
            video: false,
          });
        } catch (secondErr) {
          console.warn('[voiceStreamStore] Fallback W3C falhou, tentando fallback audio: true:', secondErr);
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        }
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !useDiscord.getState().isMicMuted;
      }

      let audioCtx: AudioContext | null = null;
      try {
        const AudioCtxClass = typeof window !== 'undefined' ? (window.AudioContext || (window as any).webkitAudioContext) : null;
        if (AudioCtxClass) {
          audioCtx = new AudioCtxClass();
          if (audioCtx.state === 'suspended') {
            void audioCtx.resume();
          }
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          const source = audioCtx.createMediaStreamSource(stream);
          source.connect(analyser);

          const data = new Uint8Array(analyser.frequencyBinCount);

          const checkVolume = () => {
            const { isMicMuted } = useDiscord.getState();
            analyser.getByteFrequencyData(data);
            const avg = data.reduce((a, b) => a + b, 0) / data.length;
            set({ isSpeaking: !isMicMuted && avg > VAD_THRESHOLD });
            vadRafId = requestAnimationFrame(checkVolume);
          };

          vadRafId = requestAnimationFrame(checkVolume);
        }
      } catch (audioErr) {
        console.warn('AudioContext VAD initialization notice:', audioErr);
      }

      useDiscord.setState((prev) => ({
        voiceState: { ...prev.voiceState, error: undefined },
      }));

      set({ micStream: stream, audioCtx });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('Microfone indisponível ou permissão recusada:', errMsg);
      useDiscord.setState((prev) => ({
        voiceState: {
          ...prev.voiceState,
          error: 'Permissão de microfone negada ou nenhum dispositivo de entrada detectado.',
        },
      }));
    }
  },

  applyAudioConstraints: async (overrideDeviceId?: string) => {
    const { micStream } = get();
    if (!micStream) return;

    const currentTrack = micStream.getAudioTracks()[0];
    const isMuted = useDiscord.getState().isMicMuted;

    const savedDeviceId =
      overrideDeviceId !== undefined
        ? overrideDeviceId
        : typeof window !== 'undefined' && window.localStorage
        ? window.localStorage.getItem('lyc_selected_input_device')
        : null;

    const currentDeviceId =
      currentTrack && typeof currentTrack.getSettings === 'function'
        ? currentTrack.getSettings().deviceId
        : null;

    // Se o dispositivo foi explicitamente alterado e difere do atual, comuta via getUserMedia
    const isDeviceSwitch =
      overrideDeviceId !== undefined ||
      (Boolean(savedDeviceId) && Boolean(currentDeviceId) && savedDeviceId !== currentDeviceId);

    if (isDeviceSwitch) {
      try {
        const newConstraints = getVoiceAudioConstraints(overrideDeviceId);
        let newStream: MediaStream;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: newConstraints,
            video: false,
          });
        } catch (firstErr) {
          console.warn('[voiceStreamStore] Captura com restrições ideais falhou no switch, tentando fallback W3C:', firstErr);
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
            },
            video: false,
          });
        }

        const newTrack = newStream.getAudioTracks()[0];
        if (newTrack) {
          newTrack.enabled = !isMuted;
        }

        // Para a faixa antiga de forma segura
        if (currentTrack) {
          currentTrack.stop();
          currentTrack.enabled = false;
        }

        // Atualiza a stream ativa no store (o subscriber em voiceService anexará a nova faixa aos peers)
        set({ micStream: newStream });
        return;
      } catch (err) {
        console.warn('[voiceStreamStore] Falha ao comutar dispositivo físico de microfone:', err);
      }
    }

    // Se apenas filtros/perfis foram alterados no mesmo dispositivo, aplica de forma suave e não-bloqueante
    if (currentTrack && typeof currentTrack.applyConstraints === 'function') {
      try {
        const fullConstraints = getVoiceAudioConstraints(overrideDeviceId);
        const { deviceId, ...trackConstraints } = fullConstraints as any;
        await currentTrack.applyConstraints(trackConstraints);
      } catch (applyErr) {
        console.debug('[voiceStreamStore] applyConstraints suave não suportado pelo driver de áudio:', applyErr);
      }
    }
  },

  stopMic: () => {
    if (vadRafId) cancelAnimationFrame(vadRafId);
    const { micStream, audioCtx } = get();
    if (micStream) {
      micStream.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
    }
    set({ micStream: null, audioCtx: null, isSpeaking: false });
  },

  setSpeaking: (isSpeaking) => set({ isSpeaking }),

  disconnectAll: () => {
    get().stopScreenShare();
    get().stopMic();
    useDiscord.getState().disconnectFromVoice();
  },
}));

// Listener para mudanças nos dispositivos de áudio/vídeo do sistema (fone conectado/desconectado)
if (typeof navigator !== 'undefined' && navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', async () => {
    const store = useVoiceStreamStore.getState();
    if (store.micStream) {
      store.stopMic();
      await store.initMic();
    }
  });
}
