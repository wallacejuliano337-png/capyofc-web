import { describe, it, expect, beforeEach } from "vitest";
import {
  canViewAuditLog,
  getCommunityAuditLogs,
  recordAuditLogEntry,
  formatAuditActionVerb,
  formatAuditDate,
} from "../src/services/community-audit";

describe("community-audit service", () => {
  const commId = "test-comm-uuid";
  const actor = {
    id: "user-123",
    display_name: "Coronel",
    username: "coronel",
    avatar_url: null,
  };

  const store = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
  };

  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
    localStorage.clear();
  });

  it("checks audit log viewing permissions correctly", () => {
    expect(canViewAuditLog(true, [])).toBe(true);
    expect(canViewAuditLog(false, ["manage_community"])).toBe(true);
    expect(canViewAuditLog(false, ["manage_roles"])).toBe(true);
    expect(canViewAuditLog(false, ["manage_channels"])).toBe(true);
    expect(canViewAuditLog(false, ["moderate_members"])).toBe(true);
    expect(canViewAuditLog(false, ["send_messages", "speak"])).toBe(false);
  });

  it("returns empty array for unauthorized viewers", () => {
    recordAuditLogEntry(commId, actor, {
      action_type: "role_create",
      target_type: "role",
      target_name: "Moderador",
    });

    const logs = getCommunityAuditLogs(commId, {
      isOwner: false,
      permissions: ["send_messages"],
    });
    expect(logs).toEqual([]);
  });

  it("records and retrieves audit entries newest first", () => {
    recordAuditLogEntry(commId, actor, {
      action_type: "channel_create",
      target_type: "channel",
      target_name: "#geral",
    });

    recordAuditLogEntry(commId, actor, {
      action_type: "member_ban",
      target_type: "member",
      target_name: "Naori",
      metadata: { reason: "Spam" },
    });

    const logs = getCommunityAuditLogs(commId, {
      isOwner: true,
      permissions: [],
    });

    expect(logs).toHaveLength(2);
    expect(logs[0].action_type).toBe("member_ban");
    expect(logs[0].target_name).toBe("Naori");
    expect(logs[0].metadata?.reason).toBe("Spam");
    expect(logs[1].action_type).toBe("channel_create");
    expect(logs[1].target_name).toBe("#geral");
  });

  it("formats audit verbs properly", () => {
    expect(formatAuditActionVerb("member_ban")).toBe("baniu o membro");
    expect(formatAuditActionVerb("member_unban")).toBe("revogou o banimento de");
    expect(formatAuditActionVerb("role_create")).toBe("criou o cargo");
    expect(formatAuditActionVerb("channel_delete")).toBe("excluiu o canal");
    expect(formatAuditActionVerb("invite_create")).toBe("gerou um código de convite");
  });

  it("formats dates gracefully", () => {
    const today = new Date().toISOString();
    expect(formatAuditDate(today)).toContain("Hoje às");

    const invalid = "not-a-date";
    expect(formatAuditDate(invalid)).toBe("not-a-date");
  });
});
