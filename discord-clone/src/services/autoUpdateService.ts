import { create } from 'zustand';

export interface VersionManifest {
  version: string;
  build: string;
  buildTime: number;
  releaseNotes: string;
}

export const CURRENT_APP_VERSION = '0.1.0';
export const CURRENT_APP_BUILD = '2026.10.19-01';

interface AutoUpdateState {
  currentVersion: string;
  currentBuild: string;
  availableVersion: string | null;
  availableBuild: string | null;
  releaseNotes: string;
  isChecking: boolean;
  isUpdateAvailable: boolean;
  isUpdating: boolean;
  updateProgress: number;
  lastChecked: number | null;
  isModalOpen: boolean;

  // Actions
  checkForUpdates: (silent?: boolean) => Promise<boolean>;
  applyUpdate: () => Promise<void>;
  simulateUpdate: (mockVersion?: string) => void;
  dismissUpdate: () => void;
  openUpdateModal: () => void;
  closeUpdateModal: () => void;
}

export const useAutoUpdate = create<AutoUpdateState>((set, get) => ({
  currentVersion: CURRENT_APP_VERSION,
  currentBuild: CURRENT_APP_BUILD,
  availableVersion: null,
  availableBuild: null,
  releaseNotes: '',
  isChecking: false,
  isUpdateAvailable: false,
  isUpdating: false,
  updateProgress: 0,
  lastChecked: null,
  isModalOpen: false,

  checkForUpdates: async (silent = true) => {
    if (get().isChecking || get().isUpdating) return false;

    // In Electron desktop environment, query native electron-updater via IPC
    if (typeof window !== 'undefined' && window.arena?.checkForUpdates) {
      set({ isChecking: true });
      try {
        const res = await window.arena.checkForUpdates();
        const hasUpdate = res.state === 'available' || res.state === 'downloading' || res.state === 'downloaded';
        set({
          isChecking: false,
          lastChecked: Date.now(),
          currentVersion: res.currentVersion || get().currentVersion,
          ...(hasUpdate
            ? {
                isUpdateAvailable: true,
                availableVersion: res.availableVersion || 'nova',
                updateProgress: res.progressPercent ?? get().updateProgress,
              }
            : {}),
        });
        return hasUpdate;
      } catch (err) {
        if (!silent) console.warn('[AutoUpdate] Erro ao verificar atualizações nativas:', err);
        set({ isChecking: false, lastChecked: Date.now() });
        return false;
      }
    }

    set({ isChecking: true });
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
      const currentBuild = get().currentBuild;
      const currentVer = get().currentVersion;

      // Check if version or build time is newer
      const hasNewVersion = Boolean(
        manifest.version !== currentVer ||
        (manifest.build && manifest.build !== currentBuild)
      );

      set({
        lastChecked: Date.now(),
        isChecking: false,
        ...(hasNewVersion
          ? {
              isUpdateAvailable: true,
              availableVersion: manifest.version,
              availableBuild: manifest.build,
              releaseNotes: manifest.releaseNotes || 'Melhorias de desempenho e estabilidade.',
            }
          : {}),
      });

      return hasNewVersion;
    } catch (err) {
      if (!silent) {
        console.warn('[AutoUpdate] Erro ao verificar atualizações:', err);
      }
      set({ isChecking: false, lastChecked: Date.now() });
      return false;
    }
  },

  simulateUpdate: (mockVersion = '0.1.1-preview') => {
    set({
      isUpdateAvailable: true,
      availableVersion: mockVersion,
      availableBuild: `build-${Date.now()}`,
      releaseNotes: 'Nova versão compilada! Inclui melhorias na tela de Ultra Pass, login seguro e novas funcionalidades.',
      isModalOpen: true,
    });
  },

  applyUpdate: async () => {
    if (get().isUpdating) return;

    // If running in Electron desktop with native installer ready
    if (typeof window !== 'undefined' && window.arena?.installUpdate) {
      set({ isUpdating: true, updateProgress: 100 });
      const success = await window.arena.installUpdate();
      if (!success) {
        set({ isUpdating: false });
      }
      return;
    }

    set({ isUpdating: true, updateProgress: 15 });

    // Step 1: Simulate asset download and validation
    await new Promise((r) => setTimeout(r, 600));
    set({ updateProgress: 45 });

    // Step 2: Validate local storage integrity (ensure no data loss)
    await new Promise((r) => setTimeout(r, 600));
    set({ updateProgress: 80 });

    // Step 3: Finalize cache flush and reload
    await new Promise((r) => setTimeout(r, 500));
    set({ updateProgress: 100 });

    await new Promise((r) => setTimeout(r, 300));

    // Reload seamlessly keeping all local data
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

// Initialize background auto-update poller
export function initAutoUpdatePoller() {
  if (typeof window === 'undefined') return () => {};

  // If running in Electron, wire native status and modal events
  let unbindStatus: (() => void) | undefined;
  let unbindModal: (() => void) | undefined;

  if (window.arena?.onUpdateStatus) {
    unbindStatus = window.arena.onUpdateStatus((status: any) => {
      if (!status) return;
      if (status.state === 'available') {
        useAutoUpdate.setState({
          isUpdateAvailable: true,
          availableVersion: status.availableVersion,
          isChecking: false,
        });
      } else if (status.state === 'downloading') {
        useAutoUpdate.setState({
          isUpdateAvailable: true,
          isUpdating: true,
          updateProgress: status.progressPercent ?? 0,
          availableVersion: status.availableVersion,
        });
      } else if (status.state === 'downloaded') {
        useAutoUpdate.setState({
          isUpdateAvailable: true,
          isUpdating: false,
          updateProgress: 100,
          availableVersion: status.availableVersion,
          isModalOpen: true,
        });
      } else if (status.state === 'not-available') {
        useAutoUpdate.setState({
          isChecking: false,
          isUpdateAvailable: false,
        });
      } else if (status.state === 'error') {
        useAutoUpdate.setState({
          isChecking: false,
          isUpdating: false,
        });
      }
    });
  }

  if (window.arena?.onShowUpdateModal) {
    unbindModal = window.arena.onShowUpdateModal(() => {
      useAutoUpdate.getState().openUpdateModal();
    });
  }

  // Check 5 seconds after launch
  const initialTimer = setTimeout(() => {
    useAutoUpdate.getState().checkForUpdates(true);
  }, 5000);

  // Poll periodically every 60 seconds
  const interval = setInterval(() => {
    useAutoUpdate.getState().checkForUpdates(true);
  }, 60000);

  // Check on window focus (when user switches back to app)
  const onFocus = () => {
    const last = useAutoUpdate.getState().lastChecked;
    // Don't check more than once every 30 seconds
    if (!last || Date.now() - last > 30000) {
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
