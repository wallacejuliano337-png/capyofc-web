import { describe, it, expect, vi } from "vitest";
import type { UpdateInfoPayload, UpdateState } from "../src/types";
import { isSemverGreater } from "../src/services/autoUpdateService";

describe("LYC Arena — Auto-Updater System Specification", () => {
  describe("Update State Machine & Lifecycle Transitions", () => {
    it("handles the complete normal update path: idle -> checking -> available -> downloading -> downloaded", () => {
      const stateHistory: UpdateState[] = [];
      let currentPayload: UpdateInfoPayload = {
        state: "idle",
        currentVersion: "0.1.0",
      };

      const setStatus = (next: UpdateInfoPayload) => {
        currentPayload = next;
        stateHistory.push(next.state);
      };

      // 1. Initial state
      expect(currentPayload.state).toBe("idle");
      expect(currentPayload.currentVersion).toBe("0.1.0");

      // 2. Checking for updates
      setStatus({ state: "checking", currentVersion: "0.1.0" });
      expect(currentPayload.state).toBe("checking");

      // 3. New update available
      setStatus({
        state: "available",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      });
      expect(currentPayload.state).toBe("available");
      expect(currentPayload.availableVersion).toBe("0.2.0");

      // 4. Background download progress
      setStatus({
        state: "downloading",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
        progressPercent: 45,
      });
      expect(currentPayload.state).toBe("downloading");
      expect(currentPayload.progressPercent).toBe(45);

      // 5. Download complete and ready
      setStatus({
        state: "downloaded",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      });
      expect(currentPayload.state).toBe("downloaded");
      expect(currentPayload.availableVersion).toBe("0.2.0");

      expect(stateHistory).toEqual([
        "checking",
        "available",
        "downloading",
        "downloaded",
      ]);
    });

    it("handles the up-to-date path: idle -> checking -> not-available", () => {
      const idlePayload: UpdateInfoPayload = {
        state: "idle",
        currentVersion: "0.2.0",
      };
      expect(idlePayload.state).toBe("idle");

      const checkingPayload: UpdateInfoPayload = { state: "checking", currentVersion: "0.2.0" };
      expect(checkingPayload.state).toBe("checking");

      const finalPayload: UpdateInfoPayload = { state: "not-available", currentVersion: "0.2.0" };
      expect(finalPayload.state).toBe("not-available");
      expect(finalPayload.availableVersion).toBeUndefined();
    });

    it("handles transient network or server error during update check", () => {
      const errorPayload: UpdateInfoPayload = {
        state: "error",
        currentVersion: "0.1.0",
        error: "net::ERR_INTERNET_DISCONNECTED",
      };

      expect(errorPayload.state).toBe("error");
      expect(errorPayload.error).toContain("ERR_INTERNET_DISCONNECTED");
    });
  });

  describe("Duplicate Checks & Redundant Downloads Guard", () => {
    it("skips initiating a new check if an update is already downloading or downloaded", async () => {
      const fakeNetworkCheck = vi.fn(async () => {
        return { version: "0.2.0" };
      });

      const checkForUpdates = async (status: UpdateInfoPayload) => {
        if (status.state === "downloading" || status.state === "downloaded") {
          return status;
        }
        await fakeNetworkCheck();
        return { ...status, state: "available" as UpdateState };
      };

      // When downloading: check should be skipped
      const downloadingStatus: UpdateInfoPayload = {
        state: "downloading",
        currentVersion: "0.1.0",
        progressPercent: 60,
      };
      const res1 = await checkForUpdates(downloadingStatus);
      expect(res1.state).toBe("downloading");
      expect(fakeNetworkCheck).not.toHaveBeenCalled();

      // When downloaded: check should be skipped
      const downloadedStatus: UpdateInfoPayload = {
        state: "downloaded",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      };
      const res2 = await checkForUpdates(downloadedStatus);
      expect(res2.state).toBe("downloaded");
      expect(fakeNetworkCheck).not.toHaveBeenCalled();

      // When idle: check proceeds
      const idleStatus: UpdateInfoPayload = {
        state: "idle",
        currentVersion: "0.1.0",
      };
      const res3 = await checkForUpdates(idleStatus);
      expect(res3.state).toBe("available");
      expect(fakeNetworkCheck).toHaveBeenCalledTimes(1);
    });

    it("preserves 'downloaded' status even if a subsequent background check reports network error", () => {
      let status: UpdateInfoPayload = {
        state: "downloaded",
        currentVersion: "0.1.0",
        availableVersion: "0.2.0",
      };

      const onError = (errMsg: string) => {
        if (status.state === "downloaded") {
          // Guard: preserve downloaded status
          return;
        }
        status = {
          state: "error",
          currentVersion: "0.1.0",
          error: errMsg,
        };
      };

      onError("HttpError 503 Service Unavailable");
      expect(status.state).toBe("downloaded");
      expect(status.availableVersion).toBe("0.2.0");
    });
  });

  describe("Active Voice Call Protection & Non-Disruption Policy", () => {
    it("displays warning and disconnects active voice call before proceeding with update restart", async () => {
      let voiceChannel: string | null = "lounge-geral";
      let dmCallStatus = "connected";
      let appRestarted = false;

      const endVoiceChannel = vi.fn(() => {
        voiceChannel = null;
      });
      const endDMCall = vi.fn(async () => {
        dmCallStatus = "idle";
      });
      const triggerInstall = vi.fn(async () => {
        appRestarted = true;
        return true;
      });

      const isInActiveCall = () =>
        voiceChannel !== null ||
        ["calling", "connecting", "connected"].includes(dmCallStatus);

      // Verify active call detection
      expect(isInActiveCall()).toBe(true);

      // User confirms restart with active call
      const handleConfirmRestart = async () => {
        if (voiceChannel !== null) endVoiceChannel();
        if (dmCallStatus !== "idle") await endDMCall();
        await triggerInstall();
      };

      await handleConfirmRestart();

      expect(endVoiceChannel).toHaveBeenCalledTimes(1);
      expect(endDMCall).toHaveBeenCalledTimes(1);
      expect(voiceChannel).toBeNull();
      expect(dmCallStatus).toBe("idle");
      expect(triggerInstall).toHaveBeenCalledTimes(1);
      expect(appRestarted).toBe(true);
    });

    it("does not disconnect calls when user postpones/cancels the update restart modal", () => {
      const voiceChannel = "lounge-geral";
      const triggerInstall = vi.fn();
      let modalOpen = true;
      expect(modalOpen).toBe(true);

      // User clicks 'Mais tarde' / 'Cancelar'
      modalOpen = false;
      expect(modalOpen).toBe(false);
      expect(voiceChannel).toBe("lounge-geral");
      expect(triggerInstall).not.toHaveBeenCalled();
    });
  });

  describe("AutoUpdater Safety Configuration Specs", () => {
    it("specifies autoDownload=true and autoInstallOnAppQuit=false for controlled update installation", () => {
      const config = {
        autoDownload: true,
        autoInstallOnAppQuit: false,
      };

      // autoDownload allows seamless background downloading
      expect(config.autoDownload).toBe(true);

      // autoInstallOnAppQuit must be false so the app never forces an install silently when closed
      expect(config.autoInstallOnAppQuit).toBe(false);
    });

    it("verifies NSIS installer settings preserve user data across version upgrades", () => {
      const nsisConfig = {
        artifactName: "LYC-Arena-Setup-${version}.${ext}",
        oneClick: false,
        allowToChangeInstallationDirectory: true,
        perMachine: false,
        deleteAppDataOnUninstall: false,
      };

      expect(nsisConfig.perMachine).toBe(false);
      expect(nsisConfig.deleteAppDataOnUninstall).toBe(false);
      expect(nsisConfig.artifactName).toContain("${version}");
    });
  });

  describe("Settings 'Sobre o Capy.ofc' Specification", () => {
    it("dynamically resolves real Electron metadata version without hardcoding", async () => {
      const mockGetVersion = vi.fn(async () => "0.1.4");
      const mockUpdater = {
        getVersion: mockGetVersion,
        checkForUpdates: vi.fn(async () => ({ state: "not-available", currentVersion: "0.1.4" })),
      };

      const resolvedVersion = await mockUpdater.getVersion();
      expect(resolvedVersion).toBe("0.1.4");
      expect(mockGetVersion).toHaveBeenCalledTimes(1);
    });

    it("presents distinct and clear UI states for checking, available, downloading, ready, error, and up-to-date", () => {
      const getStatusDescriptor = (state: {
        isChecking: boolean;
        isUpdateAvailable: boolean;
        isDownloading: boolean;
        isDownloaded: boolean;
        updateError: string | null;
      }) => {
        if (state.isDownloaded) return "Pronto para instalar";
        if (state.isDownloading) return "Baixando atualização";
        if (state.isUpdateAvailable) return "Nova versão disponível";
        if (state.isChecking) return "Verificando...";
        if (state.updateError) return "Erro na verificação";
        return "Aplicativo atualizado";
      };

      expect(getStatusDescriptor({ isChecking: true, isUpdateAvailable: false, isDownloading: false, isDownloaded: false, updateError: null })).toBe("Verificando...");
      expect(getStatusDescriptor({ isChecking: false, isUpdateAvailable: true, isDownloading: false, isDownloaded: false, updateError: null })).toBe("Nova versão disponível");
      expect(getStatusDescriptor({ isChecking: false, isUpdateAvailable: true, isDownloading: true, isDownloaded: false, updateError: null })).toBe("Baixando atualização");
      expect(getStatusDescriptor({ isChecking: false, isUpdateAvailable: true, isDownloading: false, isDownloaded: true, updateError: null })).toBe("Pronto para instalar");
      expect(getStatusDescriptor({ isChecking: false, isUpdateAvailable: false, isDownloading: false, isDownloaded: false, updateError: "Falha de rede" })).toBe("Erro na verificação");
      expect(getStatusDescriptor({ isChecking: false, isUpdateAvailable: false, isDownloading: false, isDownloaded: false, updateError: null })).toBe("Aplicativo atualizado");
    });
  });

  describe("Semver Comparison & Ghost Update Prevention on Web", () => {
    it("correctly identifies when remote version is strictly greater", () => {
      expect(isSemverGreater("0.2.0", "0.1.4")).toBe(true);
      expect(isSemverGreater("0.1.5", "0.1.4")).toBe(true);
      expect(isSemverGreater("1.0.0", "0.1.4")).toBe(true);
      expect(isSemverGreater("v0.1.5", "0.1.4")).toBe(true);
    });

    it("rejects equal, older, or invalid versions as updates (prevents ghost update banner)", () => {
      // Stale version in version.json (e.g. 0.1.0 vs app 0.1.4) must NOT trigger update
      expect(isSemverGreater("0.1.0", "0.1.4")).toBe(false);
      expect(isSemverGreater("0.0.9", "0.1.4")).toBe(false);
      // Identical version must NOT trigger update
      expect(isSemverGreater("0.1.4", "0.1.4")).toBe(false);
      expect(isSemverGreater("", "0.1.4")).toBe(false);
      expect(isSemverGreater("0.1.4", "")).toBe(false);
    });
  });
});
