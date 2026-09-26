import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  Notification,
  nativeImage,
} from "electron";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validSource, validAction } from "./security";
const dataDirectory = app.commandLine.getSwitchValue("user-data-dir");
if (dataDirectory && path.isAbsolute(dataDirectory))
  app.setPath("userData", dataDirectory);
else if (!app.isPackaged)
  app.setPath("userData", path.join(app.getAppPath(), ".cache/user-data"));
app.setPath("sessionData", path.join(app.getPath("userData"), "session"));
app.setAppUserModelId("com.lyc.arena");
const dev =
  !app.isPackaged && process.env.LYC_DEV_URL === "http://127.0.0.1:5173";
let win: BrowserWindow;
let selection: { id: string; audio: boolean; expires: number } | undefined;
const page = pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
const trusted = (url: string) =>
  dev ? url === "http://127.0.0.1:5173/" : url === page;
app.whenReady().then(async () => {
  win = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: "#101114",
    frame: false,
    show: false,
    icon: nativeImage.createFromPath(
      path.join(__dirname, "../assets/icon.png"),
    ),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  const ses = win.webContents.session;
  const verify = (event: Electron.IpcMainInvokeEvent) => {
    if (
      event.sender !== win.webContents ||
      event.senderFrame !== win.webContents.mainFrame ||
      !trusted(event.senderFrame.url)
    )
      throw new Error("Origem IPC não autorizada");
  };
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  win.webContents.on("will-attach-webview", (e) => e.preventDefault());
  ses.setPermissionCheckHandler(
    (wc, permission) =>
      wc === win.webContents &&
      trusted(wc.getURL()) &&
      ["media", "display-capture"].includes(permission),
  );
  ses.setPermissionRequestHandler((wc, permission, callback) =>
    callback(
      wc === win.webContents &&
        trusted(wc.getURL()) &&
        ["media", "display-capture"].includes(permission),
    ),
  );
  ses.setDisplayMediaRequestHandler(async (request, callback) => {
    const chosen = selection;
    selection = undefined;
    if (
      !request.frame ||
      request.frame !== win.webContents.mainFrame ||
      !trusted(request.frame.url) ||
      !chosen ||
      chosen.expires < Date.now()
    ) {
      callback({});
      return;
    }
    try {
      const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
      });
      const source = sources.find((s) => s.id === chosen.id);
      if (!source) {
        callback({});
        return;
      }
      callback({
        video: source,
        ...(request.audioRequested &&
        chosen.audio &&
        process.platform === "win32"
          ? { audio: "loopback" }
          : {}),
      });
    } catch {
      callback({});
    }
  });
  ipcMain.handle("window:action", (e, action: unknown) => {
    verify(e);
    if (!validAction(action)) throw new Error("Ação inválida");
    if (action === "close") win.close();
    else if (action === "minimize") win.minimize();
    else if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle("capture:sources", async (e) => {
    verify(e);
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: false,
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
    }));
  });
  ipcMain.handle("capture:select", (e, id: unknown, audio: unknown) => {
    verify(e);
    if (!validSource(id) || typeof audio !== "boolean")
      throw new Error("Fonte inválida");
    selection = { id, audio, expires: Date.now() + 15000 };
  });
  let lastNotification = 0;
  ipcMain.handle("notify", (e, title: unknown, body: unknown) => {
    verify(e);
    if (
      typeof title !== "string" ||
      typeof body !== "string" ||
      title.length > 80 ||
      body.length > 200
    )
      throw new Error("Notificação inválida");
    if (Date.now() - lastNotification < 10000 || win.isFocused()) return;
    lastNotification = Date.now();
    new Notification({ title, body }).show();
  });
  win.once("ready-to-show", () => win.show());
  if (dev) await win.loadURL("http://127.0.0.1:5173/");
  else await win.loadFile(path.join(__dirname, "../dist/index.html"));
});
app.on("window-all-closed", () => app.quit());
