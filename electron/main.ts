import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  Notification,
  nativeImage,
  Tray,
  Menu,
  screen,
  globalShortcut,
} from "electron";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { validSource, validAction } from "./security";
import { initAutoUpdater, destroyAutoUpdater } from "./updater";

app.disableHardwareAcceleration();
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

function logDebug(msg: string) {
  try {
    const logDir = app.isPackaged
      ? path.join(app.getPath("userData"), "logs")
      : path.join(app.getAppPath(), ".cache");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
      path.join(logDir, "electron-debug.log"),
      `[${new Date().toISOString()}] ${msg}\n`,
    );
  } catch {
    // Ignore file write errors
  }
}

  const dataDirectory = app.commandLine.getSwitchValue("user-data-dir");
  if (dataDirectory && path.isAbsolute(dataDirectory))
    app.setPath("userData", dataDirectory);
  else if (!app.isPackaged)
    app.setPath("userData", path.join(app.getAppPath(), ".cache/user-data"));
  app.setPath("sessionData", path.join(app.getPath("userData"), "session"));
  app.setAppUserModelId("com.capyofc.app");

  process.on("uncaughtException", (err) => {
    logDebug("UNCAUGHT EXCEPTION: " + String(err) + "\n" + (err instanceof Error ? err.stack : ""));
  });
  process.on("unhandledRejection", (reason) => {
    logDebug("UNHANDLED REJECTION: " + String(reason));
  });
  app.on("quit", (_event, exitCode) => {
    logDebug("APP QUIT with code: " + exitCode);
  });

  logDebug("Electron starting. argv: " + JSON.stringify(process.argv));

  // Single Instance Lock
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    logDebug("Did not get single instance lock! Quitting...");
    app.quit();
  } else {

  const dev =
    !app.isPackaged && process.env.LYC_DEV_URL === "http://127.0.0.1:5173";
  let win: BrowserWindow | null = null;
  let tray: Tray | null = null;
  let isQuitting = false;
  let notificationsMuted = false;
  let updateTrayMenu: (() => void) | null = null;

  let selection: { id: string; audio: boolean; expires: number } | undefined;
  const page = pathToFileURL(path.join(__dirname, "../dist/index.html")).href;
  const trusted = (url: string) => {
    try {
      const u = new URL(url);
      if (dev) return u.origin === "http://127.0.0.1:5173" || u.origin === "http://localhost:5173";
      const target = new URL(page);
      return (
        u.protocol === "file:" &&
        u.pathname.toLowerCase() === target.pathname.toLowerCase()
      );
    } catch {
      return false;
    }
  };

  const startMinimized =
    process.argv.includes("--minimized") || process.argv.includes("--hidden");

  function restoreWindow() {
    if (!win || win.isDestroyed()) return;
    if (win.isMinimized()) {
      win.restore();
    }
    if (!win.isVisible()) {
      win.show();
    }
    win.focus();
    win.moveTop();
  }

  function getAppIcon() {
    const isWin = process.platform === "win32";
    const candidates = [
      path.join(process.resourcesPath || "", "assets/icon.ico"),
      path.join(process.resourcesPath || "", "assets/icon.png"),
      path.join(__dirname, isWin ? "../assets/icon.ico" : "../assets/icon.png"),
      path.join(__dirname, "../assets/icon.png"),
      path.join(app.getAppPath(), isWin ? "assets/icon.ico" : "assets/icon.png"),
      path.join(app.getAppPath(), "assets/icon.png"),
      path.join(__dirname, "../public/logos/logo-circular.png"),
      path.join(__dirname, "../public/logos/logo-3d.png"),
      path.join(__dirname, "../public/logos/capy-3d.png"),
      path.join(app.getAppPath(), "public/logos/logo-circular.png"),
      path.join(app.getAppPath(), "public/logos/logo-3d.png"),
      path.join(app.getAppPath(), "public/logos/capy-3d.png"),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) {
          logDebug(`Resolved icon from: ${p} (size: ${JSON.stringify(img.getSize())})`);
          return { image: img, path: p };
        }
      }
    }

    logDebug("Warning: No icon could be loaded from candidate paths");
    return { image: nativeImage.createEmpty(), path: "" };
  }

  function createTray() {
    if (tray) return;

    const { image: trayIcon } = getAppIcon();
    tray = new Tray(trayIcon.isEmpty() ? nativeImage.createEmpty() : trayIcon);
    tray.setToolTip("Capy.ofc");

    const buildContextMenu = () =>
      Menu.buildFromTemplate([
        {
          label: "Capy.ofc",
          enabled: false,
        },
        { type: "separator" },
        {
          label: "Abrir Capy.ofc",
          click: () => {
            restoreWindow();
          },
        },
        {
          label: "Mutar/Desmutar Microfone",
          accelerator: "CommandOrControl+Shift+M",
          click: () => {
            if (win && !win.isDestroyed()) {
              win.webContents.send("voice:toggle-mute");
            }
          },
        },
        {
          label: "Desconectar Voz",
          click: () => {
            if (win && !win.isDestroyed()) {
              win.webContents.send("voice:disconnect");
            }
          },
        },
        { type: "separator" },
        {
          label: "Silenciar notificações",
          type: "checkbox",
          checked: notificationsMuted,
          click: (item) => {
            notificationsMuted = item.checked;
            if (win && !win.isDestroyed()) {
              win.webContents.send("tray:mute-notifications", notificationsMuted);
            }
            if (updateTrayMenu) updateTrayMenu();
          },
        },
        { type: "separator" },
        {
          label: "Encerrar Aplicativo",
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ]);

    updateTrayMenu = () => {
      if (tray && !tray.isDestroyed()) {
        tray.setContextMenu(buildContextMenu());
      }
    };

    updateTrayMenu();

    tray.on("double-click", () => {
      restoreWindow();
    });

    tray.on("click", () => {
      restoreWindow();
    });
  }

  app.on("second-instance", () => {
    restoreWindow();
  });

  app.whenReady().then(async () => {
    createTray();

    const allDisplays = screen.getAllDisplays();
    const primaryDisplay = screen.getPrimaryDisplay();
    const { workArea, bounds: displayBounds } = primaryDisplay;

    logDebug(`Displays detected count: ${allDisplays.length}`);
    allDisplays.forEach((d, i) => {
      logDebug(`Display [${i}]: id=${d.id}, bounds=${JSON.stringify(d.bounds)}, workArea=${JSON.stringify(d.workArea)}`);
    });
    logDebug(`Primary Display: bounds=${JSON.stringify(displayBounds)}, workArea=${JSON.stringify(workArea)}`);

    const width = Math.min(1440, Math.max(1080, workArea.width - 40));
    const height = Math.min(940, Math.max(700, workArea.height - 40));
    const x = Math.round(workArea.x + (workArea.width - width) / 2);
    const y = Math.round(workArea.y + (workArea.height - height) / 2);
    logDebug(`Computed initial window geometry: x=${x}, y=${y}, width=${width}, height=${height}`);

    const { image: appIcon } = getAppIcon();

    win = new BrowserWindow({
      title: "Capy.ofc",
      x,
      y,
      width,
      height,
      minWidth: 1080,
      minHeight: 700,
      center: true,
      backgroundColor: "#101114",
      frame: false,
      show: !startMinimized,
      icon: appIcon.isEmpty() ? undefined : appIcon,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        webSecurity: true,
      },
    });

    if (!appIcon.isEmpty()) {
      win.setIcon(appIcon);
    }

    logDebug(`MAIN WINDOW CREATED: bounds=${JSON.stringify(win.getBounds())}, isVisible=${win.isVisible()}, isMinimized=${win.isMinimized()}, isDestroyed=${win.isDestroyed()}`);
    initAutoUpdater(win, logDebug);

    const ses = win.webContents.session;
    const verify = (event: Electron.IpcMainInvokeEvent) => {
      if (
        !win ||
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame ||
        !trusted(event.senderFrame.url)
      )
        throw new Error("Origem IPC não autorizada");
    };

    win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    win.webContents.on("will-navigate", (e) => e.preventDefault());
    win.webContents.on("will-attach-webview", (e) => e.preventDefault());

    // Interceptor de segurança no protocolo file:// para redirecionar requisições de assets
    // com barra inicial (ex: file:///D:/assets/...) diretamente para dentro da pasta dist do app.asar
    if (!dev) {
      const distDir = path.join(__dirname, "../dist");
      ses.webRequest.onBeforeRequest({ urls: ["file://*"] }, (details, callback) => {
        const rawUrl = details.url;
        const match = rawUrl.match(
          /^file:\/\/\/(?:[a-zA-Z]:\/)?(assets\/|logos\/|brand\/|[a-zA-Z0-9_\-\.]+\.(?:png|svg|ico|webp|jpg|jpeg|gif|json|webmanifest)$)(.*)$/i
        );
        if (match && !rawUrl.includes("/dist/")) {
          const subPath = (match[1] + (match[2] || "")).replace(/^\//, "");
          const redirectedPath = path.join(distDir, subPath);
          const redirectURL = pathToFileURL(redirectedPath).href;
          logDebug(`Asset redirect in session: ${rawUrl} -> ${redirectURL}`);
          return callback({ redirectURL });
        }
        callback({});
      });
    }

    ses.setPermissionCheckHandler(
      (wc, permission) =>
        win !== null &&
        wc === win.webContents &&
        ["media", "display-capture", "screen", "mediaKeySystem"].includes(permission),
    );
    ses.setPermissionRequestHandler((wc, permission, callback) =>
      callback(
        win !== null &&
          wc === win.webContents &&
          ["media", "display-capture", "screen", "mediaKeySystem"].includes(permission),
      ),
    );
    ses.setDisplayMediaRequestHandler(async (request, callback) => {
      if (!win) {
        callback({});
        return;
      }
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
      if (!win) return;
      if (!validAction(action)) throw new Error("Ação inválida");
      if (action === "close") win.close();
      else if (action === "minimize") win.minimize();
      else if (win.isMaximized()) win.unmaximize();
      else win.maximize();
    });

    ipcMain.handle("GET_SCREEN_SOURCES", async () => {
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: { width: 300, height: 200 },
      });
      return sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
      }));
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

    ipcMain.handle(
      "notify",
      (e, title: unknown, body: unknown, payload?: unknown) => {
        verify(e);
        if (
          typeof title !== "string" ||
          typeof body !== "string" ||
          title.length > 80 ||
          body.length > 250
        )
          throw new Error("Notificação inválida");

        if (notificationsMuted) return;
        if (win && win.isFocused()) return;

        const { image: notifIcon } = getAppIcon();
        const notif = new Notification({
          title,
          body,
          icon: notifIcon.isEmpty() ? undefined : notifIcon,
        });

        notif.on("click", () => {
          restoreWindow();
          if (
            payload &&
            typeof payload === "object" &&
            win &&
            !win.isDestroyed()
          ) {
            win.webContents.send("notification:click", payload);
          }
        });

        notif.show();
        if (win && !win.isDestroyed()) {
          win.flashFrame(true);
        }
      },
    );

    ipcMain.handle("window:badge", (e, count: unknown) => {
      verify(e);
      const n = typeof count === "number" ? Math.max(0, Math.floor(count)) : 0;
      if (app.setBadgeCount) {
        app.setBadgeCount(n);
      }
    });

    ipcMain.handle("notifications:get-muted", () => notificationsMuted);
    ipcMain.handle("notifications:set-muted", (_e, muted: unknown) => {
      if (typeof muted === "boolean") {
        notificationsMuted = muted;
        if (updateTrayMenu) updateTrayMenu();
      }
    });

    win.on("focus", () => {
      if (win && !win.isDestroyed()) {
        win.flashFrame(false);
      }
    });

    // Global Shortcuts for Voice (Mute & Push-to-Talk)
    try {
      globalShortcut.register("CommandOrControl+Shift+M", () => {
        if (win && !win.isDestroyed()) {
          win.webContents.send("voice:toggle-mute");
        }
      });
      globalShortcut.register("CommandOrControl+Shift+P", () => {
        if (win && !win.isDestroyed()) {
          win.webContents.send("voice:ptt-toggle");
        }
      });
      logDebug("Registered global shortcuts for voice (Ctrl+Shift+M, Ctrl+Shift+P)");
    } catch (err) {
      logDebug("Error registering global shortcuts: " + String(err));
    }

    // Close handler: minimize to tray when clicking X so calls remain active in background
    win.on("close", (event) => {
      if (!isQuitting) {
        event.preventDefault();
        win?.hide();
        logDebug("win closed -> minimized to system tray (voice calls stay active)");
      } else {
        logDebug("win close event with isQuitting=true, proceeding with app quit");
      }
    });

    win.once("ready-to-show", () => {
      logDebug(`READY TO SHOW event: bounds=${JSON.stringify(win?.getBounds())}, isVisible=${win?.isVisible()}, isMinimized=${win?.isMinimized()}`);
      if (win && !win.isDestroyed()) {
        win.show();
        logDebug("SHOW CALLED (ready-to-show)");
        win.focus();
        logDebug("FOCUS CALLED (ready-to-show)");
        win.restore();
        win.moveTop();
      }
    });

    win.webContents.on("did-finish-load", () => {
      logDebug(`DID FINISH LOAD: currentURL=${win?.webContents.getURL()}, title=${win?.webContents.getTitle()}`);
      if (win && !win.isDestroyed()) {
        win.webContents.setZoomFactor(1.0);
        win.webContents.setVisualZoomLevelLimits(1, 1);
        win.show();
        logDebug("SHOW CALLED (did-finish-load)");
        win.focus();
        logDebug("FOCUS CALLED (did-finish-load)");
        win.restore();
        win.moveTop();
        win.setAlwaysOnTop(true);
        win.setAlwaysOnTop(false);
        logDebug(`WINDOW STATUS AFTER LOAD: bounds=${JSON.stringify(win.getBounds())}, isVisible=${win.isVisible()}, isMinimized=${win.isMinimized()}`);
      }
    });

    win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
      logDebug(`DID FAIL LOAD: code=${errorCode}, desc=${errorDescription}, url=${validatedURL}`);
    });

    win.webContents.on("render-process-gone", (_event, details) => {
      logDebug(`RENDER PROCESS GONE: reason=${details.reason}, exitCode=${details.exitCode}`);
    });

    win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      logDebug(`RENDERER CONSOLE [lvl=${level}]: ${message} (${sourceId}:${line})`);
    });

    win.on("unresponsive", () => {
      logDebug("WINDOW UNRESPONSIVE event triggered");
    });
    win.on("responsive", () => {
      logDebug("WINDOW RESPONSIVE event triggered");
    });

    const previewLogin =
      process.argv.includes("--preview-login") ||
      process.argv.includes("--login");

    const openRoles =
      process.argv.includes("--roles") ||
      process.env.LYC_OPEN_ROLES === "1";

    if (dev) {
      const devUrl = previewLogin
        ? "http://127.0.0.1:5173/?preview=login"
        : openRoles
        ? "http://127.0.0.1:5173/?panel=settings&section=roles"
        : "http://127.0.0.1:5173/";
      logDebug(`Loading dev URL: ${devUrl}`);
      await win.loadURL(devUrl);
    } else {
      const indexPath = path.join(__dirname, "../dist/index.html");
      const targetUrl = previewLogin
        ? `${pathToFileURL(indexPath).href}?preview=login`
        : openRoles
        ? `${pathToFileURL(indexPath).href}?panel=settings&section=roles`
        : pathToFileURL(indexPath).href;
      logDebug(`Loading target URL: ${targetUrl}`);
      await win.loadURL(targetUrl);
    }

    logDebug("loadURL call returned");
    if (win && !win.isDestroyed()) {
      win.setPosition(x, y);
      win.show();
      logDebug("SHOW CALLED (post-load)");
      win.focus();
      logDebug("FOCUS CALLED (post-load)");
      win.restore();
      logDebug("RESTORE CALLED (post-load)");
      win.moveTop();
      win.setAlwaysOnTop(true);
      win.setAlwaysOnTop(false);
      const hwnd = win.getNativeWindowHandle().readInt32LE(0);
      logDebug(`FINAL VERIFIED WINDOW STATUS: visible=${win.isVisible()}, minimized=${win.isMinimized()}, destroyed=${win.isDestroyed()}, bounds=${JSON.stringify(win.getBounds())}, HWND=${hwnd}`);

      if (process.argv.includes("--snapshot")) {
        setTimeout(async () => {
          try {
            if (win && !win.isDestroyed()) {
              await win.webContents.executeJavaScript(`
                const dmBtn = document.querySelector('.social-dm-item');
                if (dmBtn) dmBtn.click();
              `).catch(() => {});

              setTimeout(async () => {
                try {
                  if (win && !win.isDestroyed()) {
                    const image = await win.webContents.capturePage();
                    const snapPath = path.join(app.getAppPath(), ".cache/app-snapshot.png");
                    fs.writeFileSync(snapPath, image.toPNG());
                    logDebug(`SNAPSHOT WRITTEN: ${snapPath}`);

                    if (process.argv.includes("--test-call")) {
                      logDebug("Triggering test call click on .voice-call-btn...");
                      await win.webContents.executeJavaScript(`
                        const callBtn = document.querySelector('.voice-call-btn');
                        if (callBtn) {
                          console.log('[TEST] Clicking .voice-call-btn');
                          callBtn.click();
                        } else {
                          console.error('[TEST] .voice-call-btn not found');
                        }
                      `).catch((err) => logDebug("TEST CALL CLICK ERROR: " + String(err)));

                      setTimeout(async () => {
                        try {
                          if (win && !win.isDestroyed()) {
                            const callImage = await win.webContents.capturePage();
                            const callSnapPath = path.join(app.getAppPath(), ".cache/app-snapshot-call.png");
                            fs.writeFileSync(callSnapPath, callImage.toPNG());
                            logDebug(`CALL SNAPSHOT WRITTEN: ${callSnapPath}`);
                          }
                        } catch (e) {
                          logDebug(`CALL SNAPSHOT ERROR: ${String(e)}`);
                        }
                      }, 1000);
                    }
                  }
                } catch (e) {
                  logDebug(`SNAPSHOT ERROR: ${String(e)}`);
                }
              }, 2000);
            }
          } catch (e) {
            logDebug(`SNAPSHOT ERROR: ${String(e)}`);
          }
        }, 3500);
      }
    }
  });

  app.on("before-quit", () => {
    logDebug("before-quit event");
    isQuitting = true;
  });

  app.on("activate", () => {
    logDebug("activate event");
    restoreWindow();
  });

  app.on("will-quit", () => {
    logDebug("will-quit event");
    try {
      globalShortcut.unregisterAll();
    } catch {
      // Ignore
    }
    destroyAutoUpdater();
    if (tray && !tray.isDestroyed()) {
      tray.destroy();
      tray = null;
    }
  });

  app.on("window-all-closed", () => {
    logDebug("window-all-closed event, isQuitting=" + isQuitting);
    if (isQuitting || process.platform !== "win32") {
      app.quit();
    }
  });
}
