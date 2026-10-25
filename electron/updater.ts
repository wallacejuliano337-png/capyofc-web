import { app, BrowserWindow, ipcMain, Notification } from "electron";
import { autoUpdater } from "electron-updater";

export type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateInfoPayload {
  state: UpdateState;
  currentVersion: string;
  availableVersion?: string;
  progressPercent?: number;
  error?: string;
}

let currentStatus: UpdateInfoPayload = {
  state: "idle",
  currentVersion: app.getVersion(),
};

let mainWindow: BrowserWindow | null = null;
let loggerFn: ((msg: string) => void) | null = null;
let periodicCheckTimer: NodeJS.Timeout | null = null;
let isChecking = false;

// Periodic check interval: every 4 hours when running in production
const PERIODIC_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

function log(msg: string) {
  if (loggerFn) {
    loggerFn(`[UPDATER] ${msg}`);
  }
}

function broadcastStatus(status: UpdateInfoPayload) {
  currentStatus = status;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("updater:status-changed", currentStatus);
  }
}

export function initAutoUpdater(
  win: BrowserWindow,
  logDebug: (msg: string) => void,
) {
  mainWindow = win;
  loggerFn = logDebug;

  // Set current version from app metadata
  currentStatus.currentVersion = app.getVersion();

  // Configure electron-updater logger
  autoUpdater.logger = {
    info: (msg: string) => log(`INFO: ${msg}`),
    warn: (msg: string) => log(`WARN: ${msg}`),
    error: (msg: string) => log(`ERROR: ${msg}`),
    debug: (msg: string) => log(`DEBUG: ${msg}`),
  };

  // Important options for safety and user experience:
  // - Download updates automatically in the background
  // - Do NOT automatically quit and install when app closes (avoids unexpected installs during calls)
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;

  // Event handlers
  autoUpdater.on("checking-for-update", () => {
    log("Checking for updates...");
    broadcastStatus({
      state: "checking",
      currentVersion: app.getVersion(),
    });
  });

  autoUpdater.on("update-available", (info) => {
    log(`Update available: version ${info.version}`);
    broadcastStatus({
      state: "available",
      currentVersion: app.getVersion(),
      availableVersion: info.version,
    });
  });

  autoUpdater.on("update-not-available", () => {
    log("No update available. Current version is up-to-date.");
    broadcastStatus({
      state: "not-available",
      currentVersion: app.getVersion(),
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.round(progress.percent);
    log(`Download progress: ${percent}% (${progress.bytesPerSecond} B/s)`);
    broadcastStatus({
      state: "downloading",
      currentVersion: app.getVersion(),
      progressPercent: percent,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    log(`Update downloaded: version ${info.version}. Ready for controlled install.`);
    broadcastStatus({
      state: "downloaded",
      currentVersion: app.getVersion(),
      availableVersion: info.version,
    });

    // Native notification to alert user without disrupting active tasks
    try {
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: "CapyChat — Atualização Pronta",
          body: `A versão ${info.version} foi baixada e está pronta para instalar. Clique para reiniciar.`,
        });
        notif.on("click", () => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
            mainWindow.webContents.send("updater:show-modal");
          }
        });
        notif.show();
      }
    } catch (notifErr) {
      log(`Notification warning: ${String(notifErr)}`);
    }
  });

  autoUpdater.on("error", (err) => {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`Handled error in autoUpdater: ${errMsg}`);

    // If an update is already downloaded, do not override its state with a transient network error
    if (currentStatus.state === "downloaded") {
      log("Preserving 'downloaded' state despite transient network error.");
      return;
    }

    broadcastStatus({
      state: "error",
      currentVersion: app.getVersion(),
      error: errMsg,
    });
  });

  // Register IPC handlers (safe re-registration guard)
  try {
    ipcMain.removeHandler("app:version");
    ipcMain.removeHandler("updater:status");
    ipcMain.removeHandler("updater:check");
    ipcMain.removeHandler("updater:install");
    ipcMain.removeHandler("updater:open-modal");
  } catch {
    // Ignore if not previously registered
  }

  ipcMain.handle("app:version", () => app.getVersion());

  ipcMain.handle("updater:status", () => currentStatus);

  ipcMain.handle("updater:check", async () => {
    return await checkForUpdates(true);
  });

  ipcMain.handle("updater:install", () => {
    return installUpdateNow();
  });

  ipcMain.handle("updater:open-modal", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("updater:show-modal");
    }
    return true;
  });

  // Scheduled checks in production (packaged) mode
  if (app.isPackaged) {
    // Initial check 6 seconds after launch (lets UI and connections stabilize)
    setTimeout(() => {
      void checkForUpdates(false);
    }, 6000);

    // Periodic check every 4 hours while app is kept open
    if (!periodicCheckTimer) {
      periodicCheckTimer = setInterval(() => {
        log("Running periodic background check for updates...");
        void checkForUpdates(false);
      }, PERIODIC_CHECK_INTERVAL_MS);
    }
  } else {
    log("Running in development mode (app not packaged). Automatic check skipped.");
  }
}

export function destroyAutoUpdater() {
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer);
    periodicCheckTimer = null;
  }
  mainWindow = null;
  loggerFn = null;
}

export async function checkForUpdates(
  manual = false,
): Promise<UpdateInfoPayload> {
  // Prevent duplicate concurrent checks or re-downloading when already ready
  if (isChecking) {
    log("checkForUpdates: already checking, returning current status.");
    return currentStatus;
  }

  if (currentStatus.state === "downloading" || currentStatus.state === "downloaded") {
    log(`checkForUpdates: update is already in state '${currentStatus.state}', skipping check.`);
    return currentStatus;
  }

  if (!app.isPackaged) {
    log(`Dev mode: checkForUpdates (manual=${manual}) skipped.`);
    return {
      state: "not-available",
      currentVersion: app.getVersion(),
    };
  }

  isChecking = true;
  try {
    log(`Initiating checkForUpdates (manual=${manual})...`);
    await autoUpdater.checkForUpdates();
    return currentStatus;
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log(`checkForUpdates caught safe error: ${errMsg}`);

    // If already downloaded, do not degrade state
    if ((currentStatus as UpdateInfoPayload).state === "downloaded") {
      return currentStatus;
    }

    const errorPayload: UpdateInfoPayload = {
      state: "error",
      currentVersion: app.getVersion(),
      error: errMsg,
    };
    broadcastStatus(errorPayload);
    return errorPayload;
  } finally {
    isChecking = false;
  }
}

export function installUpdateNow(): boolean {
  if (currentStatus.state !== "downloaded") {
    log("Cannot install update: status is not 'downloaded'.");
    return false;
  }

  log("Triggering quitAndInstall(false, true)...");
  try {
    // isSilent: false (displays installer UI), isForceRunAfter: true (re-launches application)
    autoUpdater.quitAndInstall(false, true);
    return true;
  } catch (err) {
    log(`Error calling quitAndInstall: ${String(err)}`);
    return false;
  }
}
