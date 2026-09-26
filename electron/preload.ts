import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("arena", {
  window: (action: "minimize" | "maximize" | "close") =>
    ipcRenderer.invoke("window:action", action),
  sources: () => ipcRenderer.invoke("capture:sources"),
  selectSource: (id: string, audio: boolean) =>
    ipcRenderer.invoke("capture:select", id, audio),
  notify: (title: string, body: string) =>
    ipcRenderer.invoke("notify", title, body),
});
