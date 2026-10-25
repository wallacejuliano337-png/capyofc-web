import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getScreenSources: () => ipcRenderer.invoke("GET_SCREEN_SOURCES"),
});

contextBridge.exposeInMainWorld("arena", {
  window: (action: "minimize" | "maximize" | "close") =>
    ipcRenderer.invoke("window:action", action),
  sources: () => ipcRenderer.invoke("capture:sources"),
  selectSource: (id: string, audio: boolean) =>
    ipcRenderer.invoke("capture:select", id, audio),
  getScreenSources: () => ipcRenderer.invoke("GET_SCREEN_SOURCES"),
  notify: (title: string, body: string, payload?: Record<string, unknown>) =>
    ipcRenderer.invoke("notify", title, body, payload),
  onNotificationClick: (
    callback: (payload: Record<string, unknown>) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: Record<string, unknown>,
    ) => callback(payload);
    ipcRenderer.on("notification:click", handler);
    return () => {
      ipcRenderer.removeListener("notification:click", handler);
    };
  },
  setBadgeCount: (count: number) => ipcRenderer.invoke("window:badge", count),
  getNotificationsMuted: () => ipcRenderer.invoke("notifications:get-muted"),
  setNotificationsMuted: (muted: boolean) =>
    ipcRenderer.invoke("notifications:set-muted", muted),
  onTrayMuteToggle: (callback: (muted: boolean) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, muted: boolean) =>
      callback(muted);
    ipcRenderer.on("tray:mute-notifications", handler);
    return () => {
      ipcRenderer.removeListener("tray:mute-notifications", handler);
    };
  },
  getVersion: () => ipcRenderer.invoke("app:version"),
  getUpdateStatus: () => ipcRenderer.invoke("updater:status"),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  onUpdateStatus: (callback: (status: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) =>
      callback(status);
    ipcRenderer.on("updater:status-changed", handler);
    return () => {
      ipcRenderer.removeListener("updater:status-changed", handler);
    };
  },
  onVoiceToggleMute: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("voice:toggle-mute", handler);
    return () => {
      ipcRenderer.removeListener("voice:toggle-mute", handler);
    };
  },
  onVoicePtt: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("voice:ptt-toggle", handler);
    return () => {
      ipcRenderer.removeListener("voice:ptt-toggle", handler);
    };
  },
  onVoiceDisconnect: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("voice:disconnect", handler);
    return () => {
      ipcRenderer.removeListener("voice:disconnect", handler);
    };
  },
  openUpdateModal: () => ipcRenderer.invoke("updater:open-modal"),
  onShowUpdateModal: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on("updater:show-modal", handler);
    return () => {
      ipcRenderer.removeListener("updater:show-modal", handler);
    };
  },
});
