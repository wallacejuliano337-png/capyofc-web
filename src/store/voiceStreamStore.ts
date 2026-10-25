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
  initMic: () => Promise<void>;
  stopMic: () => void;
  setSpeaking: (isSpeaking: boolean) => void;

  // Desconexão total
  disconnectAll: () => void;
}

let vadRafId = 0;
const VAD_THRESHOLD = 18;

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

  initMic: async () => {
    if (get().micStream) return; // já inicializado

    try {
      const savedDeviceId =
        typeof window !== 'undefined' && window.localStorage
          ? window.localStorage.getItem('lyc_selected_input_device')
          : null;

      const audioConstraints: any = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      if (savedDeviceId && savedDeviceId !== 'default') {
        audioConstraints.deviceId = { exact: savedDeviceId };
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: false,
        });
      } catch {
        // Fallback to default device if specific device failed
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
      }

      const audioCtx = new AudioContext();
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

      set({ micStream: stream, audioCtx });
    } catch (err) {
      console.warn('Microfone indisponível ou permissão recusada:', err);
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
