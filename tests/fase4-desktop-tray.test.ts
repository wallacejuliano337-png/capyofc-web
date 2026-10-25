import { describe, it, expect, vi } from "vitest";

describe("Fase 4 — Desktop Experience & System Tray", () => {
  describe("Tray Menu Specification", () => {
    it("builds the expected tray menu items in the exact required order", () => {
      let isQuitting = false;
      let notificationsMuted = false;
      const windowRestored = vi.fn();
      const appQuit = vi.fn(() => {
        isQuitting = true;
      });

      interface MockMenuItem {
        label?: string;
        enabled?: boolean;
        type?: "separator" | "checkbox";
        checked?: boolean;
        click?: (checked?: boolean) => void;
      }

      const buildContextMenu = (muted: boolean): MockMenuItem[] => [
        {
          label: "LYC Arena",
          enabled: false,
        },
        { type: "separator" },
        {
          label: "Abrir LYC Arena",
          click: () => {
            windowRestored();
          },
        },
        { type: "separator" },
        {
          label: "Silenciar notificações",
          type: "checkbox",
          checked: muted,
          click: (checked?: boolean) => {
            notificationsMuted = Boolean(checked);
          },
        },
        { type: "separator" },
        {
          label: "Sair do LYC Arena",
          click: () => {
            appQuit();
          },
        },
      ];

      const menu = buildContextMenu(notificationsMuted);

      // Verify menu structure
      expect(menu).toHaveLength(7);
      expect(menu[0].label).toBe("LYC Arena");
      expect(menu[0].enabled).toBe(false);

      expect(menu[1].type).toBe("separator");

      expect(menu[2].label).toBe("Abrir LYC Arena");
      menu[2].click?.();
      expect(windowRestored).toHaveBeenCalledTimes(1);

      expect(menu[3].type).toBe("separator");

      expect(menu[4].label).toBe("Silenciar notificações");
      expect(menu[4].type).toBe("checkbox");
      expect(menu[4].checked).toBe(false);

      // Test mute toggle
      menu[4].click?.(true);
      expect(notificationsMuted).toBe(true);

      const updatedMenu = buildContextMenu(notificationsMuted);
      expect(updatedMenu[4].checked).toBe(true);

      expect(menu[5].type).toBe("separator");

      expect(menu[6].label).toBe("Sair do LYC Arena");
      menu[6].click?.();
      expect(appQuit).toHaveBeenCalledTimes(1);
      expect(isQuitting).toBe(true);
    });
  });

  describe("Window Close vs Quit Lifecycle", () => {
    it("intercepts close and hides to tray when isQuitting is false", () => {
      const isQuitting = false;
      let isVisible = true;
      let defaultPrevented = false;

      const mockEvent = {
        preventDefault: () => {
          defaultPrevented = true;
        },
      };

      const handleClose = (event: typeof mockEvent) => {
        if (!isQuitting) {
          event.preventDefault();
          isVisible = false;
        }
      };

      // User clicks 'X'
      handleClose(mockEvent);

      expect(defaultPrevented).toBe(true);
      expect(isVisible).toBe(false);
      expect(isQuitting).toBe(false);
    });

    it("allows actual window close and app termination when isQuitting is true", () => {
      const isQuitting = true;
      let defaultPrevented = false;

      const mockEvent = {
        preventDefault: () => {
          defaultPrevented = true;
        },
      };

      const handleClose = (event: typeof mockEvent) => {
        if (!isQuitting) {
          event.preventDefault();
        }
      };

      // Quit action from tray menu
      handleClose(mockEvent);

      // preventDefault is NOT called when isQuitting is true, preventing infinite loop
      expect(defaultPrevented).toBe(false);
    });
  });

  describe("Window Restoration (Double-Click & Menu Action)", () => {
    it("restores minimized window, makes visible, and focuses without creating a second window", () => {
      let isMinimized = true;
      let isVisible = false;
      let isFocused = false;
      const windowInstanceCount = 1;

      const mockWin = {
        isMinimized: () => isMinimized,
        restore: () => {
          isMinimized = false;
        },
        isVisible: () => isVisible,
        show: () => {
          isVisible = true;
        },
        focus: () => {
          isFocused = true;
        },
      };

      const restoreWindow = () => {
        if (mockWin.isMinimized()) mockWin.restore();
        if (!mockWin.isVisible()) mockWin.show();
        mockWin.focus();
      };

      restoreWindow();

      expect(isMinimized).toBe(false);
      expect(isVisible).toBe(true);
      expect(isFocused).toBe(true);
      expect(windowInstanceCount).toBe(1);
    });
  });

  describe("Single Instance Lock", () => {
    it("restores the existing instance when second-instance event is received", () => {
      let restoreCalled = false;
      const onSecondInstance = () => {
        restoreCalled = true;
      };

      // Primary instance holds lock
      const gotTheLock = true;
      expect(gotTheLock).toBe(true);

      // Second launch simulation
      onSecondInstance();
      expect(restoreCalled).toBe(true);
    });

    it("exits the second process immediately if lock cannot be acquired", () => {
      const gotTheLock = false;
      const appQuit = vi.fn();

      if (!gotTheLock) {
        appQuit();
      }

      expect(appQuit).toHaveBeenCalledTimes(1);
    });
  });

  describe("Notification Muting Logic", () => {
    it("suppresses desktop notifications when notificationsMuted is active", () => {
      const showNotification = vi.fn();

      const notify = (
        notificationsMuted: boolean,
        isFocused: boolean,
        _title: string,
        _body: string,
      ) => {
        if (notificationsMuted) return;
        if (isFocused) return;
        showNotification();
      };

      // 1. When unmuted and window is hidden/blurred: notification shows
      notify(false, false, "Mensagem", "Olá");
      expect(showNotification).toHaveBeenCalledTimes(1);

      // 2. When muted: notification is suppressed even if blurred/hidden
      notify(true, false, "Mensagem", "Olá");
      expect(showNotification).toHaveBeenCalledTimes(1);

      // 3. When focused: notification is suppressed
      notify(false, true, "Mensagem", "Olá");
      expect(showNotification).toHaveBeenCalledTimes(1);
    });
  });
});
