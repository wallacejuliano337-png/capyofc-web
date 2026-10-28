import { create } from 'zustand';

export interface VersionManifest {
  version: string;
  build: string;
  buildTime: number;
  releaseNotes: string;
}

export const CURRENT_APP_VERSION = '0.1.5';
export const CURRENT_APP_BUILD = '2026.10.28-04';

interface AutoUpdateState {
  currentVersion: string;
  currentBuild: string;
  availableVersion: string | null;
  availableBuild: string | null;
  releaseNotes: string;
  isChecking: boolean;
  isUpdateAvailable: boolean;
  isDownloading: boolean;
  isDownloaded: boolean;
  isUpdating: boolean;
  updateProgress: number;
  updateError: string | null;
  lastChecked: number | null;
  isModalOpen: boolean;

  // Actions
  checkForUpdates: (silent?: boolean) => Promise<boolean>;
  downloadUpdate: () => Promise<boolean>;
  applyUpdate: () => Promise<void>;
  simulateUpdate: (mockVersion?: string) => void;
  dismissUpdate: () => void;
  openUpdateModal: () => void;
  closeUpdateModal: () => void;
}

/**
 * Compara duas versões em formato semver (ex: "0.1.4" vs "0.1.0").
 * Retorna true APENAS se remote for estritamente superior a local.
 */
export function isSemverGreater(remote: string, local: string): boolean {
  if (!remote || !local) return false;
  const parse = (v: string) =>
    v.replace(/^[^\d]*/, '').split('.').map((p) => parseInt(p, 10) || 0);
  const r = parse(remote);
  const l = parse(local);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rPart = r[i] ?? 0;
    const lPart = l[i] ?? 0;
    if (rPart > lPart) return true;
    if (rPart < lPart) return false;
  }
  return false;
}

export const useAutoUpdate = create<AutoUpdateState>((set, get) => ({
  currentVersion: CURRENT_APP_VERSION,
  currentBuild: CURRENT_APP_BUILD,
  availableVersion: null,
  availableBuild: null,
  releaseNotes: '',
  isChecking: false,
  isUpdateAvailable: false,
  isDownloading: false,
  isDownloaded: false,
  isUpdating: false,
  updateProgress: 0,
  updateError: null,
  lastChecked: null,
  isModalOpen: false,

  checkForUpdates: async (silent = true) => {
    if (get().isChecking || get().isDownloading || get().isUpdating) return false;

    const updater = typeof window !== 'undefined' ? (window.arena || window.electronAPI) : undefined;

    // In Electron desktop environment, query native electron-updater via IPC
    if (updater?.checkForUpdates) {
      set({ isChecking: true, updateError: null });
      try {
        const res = await updater.checkForUpdates();
        const hasUpdate = res.state === 'available' || res.state === 'downloading' || res.state === 'downloaded';
        set({
          isChecking: false,
          lastChecked: Date.now(),
          currentVersion: res.currentVersion || get().currentVersion,
          ...(hasUpdate
            ? {
                isUpdateAvailable: true,
                isDownloading: res.state === 'downloading',
                isDownloaded: res.state === 'downloaded',
                availableVersion: res.availableVersion || 'nova',
                updateProgress: res.progressPercent ?? get().updateProgress,
                updateError: null,
              }
            : {
                isUpdateAvailable: false,
                isDownloading: false,
                isDownloaded: false,
              }),
        });
        return hasUpdate;
      } catch (err: any) {
        if (!silent) console.warn('[AutoUpdate] Erro ao verificar atualizações nativas:', err);
        set({
          isChecking: false,
          lastChecked: Date.now(),
          updateError: err?.message || 'Falha ao verificar atualizações.',
        });
        return false;
      }
    }

    set({ isChecking: true, updateError: null });
    try {
      // Fetch latest version manifest with cache-buster
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });

      if (!response.ok) {
        throw new Error('Falha ao verificar atualizações');
      }

      const manifest: VersionManifest = await response.json();
      const currentVer = get().currentVersion;

      // Na Web/PWA, só marca atualização se o manifesto trouxer versão estritamente mais recente
      const hasNewVersion = Boolean(
        manifest &&
        manifest.version &&
        isSemverGreater(manifest.version, currentVer)
      );

      set({
        lastChecked: Date.now(),
        isChecking: false,
        updateError: null,
        ...(hasNewVersion
          ? {
              isUpdateAvailable: true,
              isDownloading: false,
              isDownloaded: false,
              availableVersion: manifest.version,
              availableBuild: manifest.build,
              releaseNotes: manifest.releaseNotes || 'Melhorias de desempenho e estabilidade.',
            }
          : {
              isUpdateAvailable: false,
              isDownloading: false,
              isDownloaded: false,
            }),
      });

      return hasNewVersion;
    } catch (err: any) {
      if (!silent) {
        console.warn('[AutoUpdate] Erro ao verificar atualizações:', err);
      }
      set({
        isChecking: false,
        lastChecked: Date.now(),
        updateError: err?.message || 'Falha na conexão.',
      });
      return false;
    }
  },

  downloadUpdate: async () => {
    if (get().isDownloading || get().isDownloaded) return false;
    set({ isDownloading: true, updateError: null, updateProgress: 0 });

    const updater = typeof window !== 'undefined' ? (window.arena || window.electronAPI) : undefined;

    if (updater?.downloadUpdate) {
      try {
        const success = await updater.downloadUpdate();
        return success;
      } catch (err: any) {
        set({
          isDownloading: false,
          updateError: err?.message || 'Falha no download da atualização.',
        });
        return false;
      }
    }

    // Web simulation fallback for testing progress
    for (let p = 15; p <= 100; p += 20) {
      await new Promise((r) => setTimeout(r, 400));
      set({ updateProgress: p });
    }
    set({ isDownloading: false, isDownloaded: true, updateProgress: 100 });
    return true;
  },

  simulateUpdate: (mockVersion = '0.1.3') => {
    set({
      isUpdateAvailable: true,
      isDownloading: false,
      isDownloaded: false,
      availableVersion: mockVersion,
      availableBuild: `build-${Date.now()}`,
      releaseNotes: 'Versão 0.1.3 com otimizações de áudio WebRTC, calibração do codec Opus, teste de microfone aprimorado e correções de estabilidade.',
      isModalOpen: true,
      updateError: null,
      updateProgress: 0,
    });
  },

  applyUpdate: async () => {
    if (get().isUpdating) return;

    // Active voice call protection: cleanly disconnect before restarting
    try {
      const { useDiscord } = await import('../store/discordStore');
      if (useDiscord.getState().voiceState.isConnected) {
        useDiscord.getState().disconnectFromVoice();
      }
    } catch {}

    const updater = typeof window !== 'undefined' ? (window.arena || window.electronAPI) : undefined;

    if (updater?.installUpdate) {
      set({ isUpdating: true, updateProgress: 100 });
      const success = await updater.installUpdate();
      if (!success) {
        set({
          isUpdating: false,
          updateError: 'Não foi possível iniciar o instalador da atualização.',
        });
      }
      return;
    }

    set({ isUpdating: true, updateProgress: 15 });
    await new Promise((r) => setTimeout(r, 500));
    set({ updateProgress: 60 });
    await new Promise((r) => setTimeout(r, 400));
    set({ updateProgress: 100 });
    await new Promise((r) => setTimeout(r, 300));

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  },

  dismissUpdate: () => {
    set({ isModalOpen: false });
  },

  openUpdateModal: () => {
    set({ isModalOpen: true });
  },

  closeUpdateModal: () => {
    set({ isModalOpen: false });
  },
}));

// Resolve real Electron metadata version as early as possible
if (typeof window !== 'undefined') {
  try {
    const earlyUpdater = (window as any).arena || (window as any).electronAPI;
    if (earlyUpdater?.getVersion) {
      earlyUpdater.getVersion().then((v: string) => {
        if (v) useAutoUpdate.setState({ currentVersion: v });
      }).catch(() => {});
    }
  } catch {}
}

// Initialize background auto-update poller
export function initAutoUpdatePoller() {
  if (typeof window === 'undefined') return () => {};

  const updater = window.arena || window.electronAPI;
  let unbindStatus: (() => void) | undefined;
  let unbindModal: (() => void) | undefined;

  // Immediate query of true Electron package version on poller start
  if (updater?.getVersion) {
    updater.getVersion().then((v: string) => {
      if (v) useAutoUpdate.setState({ currentVersion: v });
    }).catch(() => {});
  }
  if (updater?.getUpdateStatus) {
    updater.getUpdateStatus().then((status: any) => {
      if (status?.currentVersion) {
        useAutoUpdate.setState({ currentVersion: status.currentVersion });
      }
    }).catch(() => {});
  }

  if (updater?.onUpdateStatus) {
    unbindStatus = updater.onUpdateStatus((status: any) => {
      if (!status) return;

      if (status.currentVersion) {
        useAutoUpdate.setState({ currentVersion: status.currentVersion });
      }

      if (status.state === 'available') {
        useAutoUpdate.setState({
          isUpdateAvailable: true,
          isDownloading: false,
          isDownloaded: false,
          availableVersion: status.availableVersion,
          isChecking: false,
          updateError: null,
        });
      } else if (status.state === 'downloading') {
        useAutoUpdate.setState({
          isUpdateAvailable: true,
          isDownloading: true,
          isDownloaded: false,
          updateProgress: status.progressPercent ?? 0,
          availableVersion: status.availableVersion,
          updateError: null,
        });
      } else if (status.state === 'downloaded') {
        useAutoUpdate.setState({
          isUpdateAvailable: true,
          isDownloading: false,
          isDownloaded: true,
          updateProgress: 100,
          availableVersion: status.availableVersion,
          updateError: null,
          isModalOpen: true,
        });
      } else if (status.state === 'not-available') {
        useAutoUpdate.setState({
          isChecking: false,
          isUpdateAvailable: false,
          isDownloading: false,
          isDownloaded: false,
          updateError: null,
        });
      } else if (status.state === 'error') {
        useAutoUpdate.setState({
          isChecking: false,
          isDownloading: false,
          updateError: status.error || 'Erro ao processar atualização.',
        });
      }
    });
  }

  if (updater?.onShowUpdateModal) {
    unbindModal = updater.onShowUpdateModal(() => {
      useAutoUpdate.getState().openUpdateModal();
    });
  }

  // Check 6 seconds after launch (background, non-blocking)
  const initialTimer = setTimeout(() => {
    useAutoUpdate.getState().checkForUpdates(true);
  }, 6000);

  // Poll periodically every 2 hours
  const interval = setInterval(() => {
    useAutoUpdate.getState().checkForUpdates(true);
  }, 2 * 60 * 60 * 1000);

  // Check on window focus (don't check more than once every 2 minutes)
  const onFocus = () => {
    const last = useAutoUpdate.getState().lastChecked;
    if (!last || Date.now() - last > 120000) {
      useAutoUpdate.getState().checkForUpdates(true);
    }
  };

  window.addEventListener('focus', onFocus);

  return () => {
    clearTimeout(initialTimer);
    clearInterval(interval);
    window.removeEventListener('focus', onFocus);
    unbindStatus?.();
    unbindModal?.();
  };
}
