import { describe, it, expect, beforeEach } from "vitest";
import {
  createCommunityWebhook,
  loadCommunityWebhooks,
  updateCommunityWebhook,
  regenerateCommunityWebhookToken,
  deleteCommunityWebhook,
  executeWebhookMessage,
  validateWebhookName,
  validateWebhookMessage,
  generateSecureWebhookToken,
  buildWebhookUrl,
  clearWebhooksMemoryStore,
  loadCommunityIntegrations,
  connectCommunityIntegration,
  toggleCommunityIntegration,
  disconnectCommunityIntegration,
} from "../src/services/community-webhooks";
import {
  recordAuditLogEntry,
  getCommunityAuditLogs,
} from "../src/services/community-audit";

describe("Community Webhooks and Integrations Service", () => {
  const communityIdA = "11111111-2222-3333-4444-555555555555";
  const communityIdB = "99999999-8888-7777-6666-555555555555";
  const channelId1 = "aaaa0000-bbbb-cccc-dddd-eeee11112222";
  const channelId2 = "ffff0000-bbbb-cccc-dddd-eeee11113333";
  const testActor = {
    id: "admin-actor-1",
    display_name: "Admin Tester",
    username: "admintester",
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
    clearWebhooksMemoryStore();
  });

  describe("Token & Input Validation", () => {
    it("generates a cryptographically strong token starting with lyc_wh_", () => {
      const token1 = generateSecureWebhookToken();
      const token2 = generateSecureWebhookToken();
      expect(token1.startsWith("lyc_wh_")).toBe(true);
      expect(token1.length).toBeGreaterThanOrEqual(25);
      expect(token1).not.toBe(token2);
    });

    it("validates webhook names correctly", () => {
      expect(validateWebhookName("")).toBe("O nome do webhook deve ter pelo menos 2 caracteres.");
      expect(validateWebhookName("A")).toBe("O nome do webhook deve ter pelo menos 2 caracteres.");
      expect(validateWebhookName("GitHub Deploy")).toBeNull();
      expect(validateWebhookName("A".repeat(65))).toBe(
        "O nome do webhook não pode ultrapassar 64 caracteres.",
      );
    });

    it("validates webhook message payloads correctly", () => {
      expect(validateWebhookMessage("")).toBe("O conteúdo da mensagem não pode ficar vazio.");
      expect(validateWebhookMessage("   ")).toBe("O conteúdo da mensagem não pode ficar vazio.");
      expect(validateWebhookMessage("Build succeeded!")).toBeNull();
      expect(validateWebhookMessage("X".repeat(4001))).toBe(
        "A mensagem excede o limite máximo de 4000 caracteres.",
      );
    });

    it("builds a valid usable webhook URL with masked or full token", () => {
      const url = buildWebhookUrl("wh-123", "lyc_wh_secrettoken12345");
      expect(url).toContain("functions/v1/community-webhook");
      expect(url).toContain("id=wh-123");
      expect(url).toContain("token=lyc_wh_secrettoken12345");
    });
  });

  describe("Webhook Lifecycle and CRUD", () => {
    it("creates a webhook with secure token and default active state", async () => {
      const wh = await createCommunityWebhook(communityIdA, {
        name: "CI Monitor",
        channel_id: channelId1,
        created_by: testActor.id,
        creator_name: testActor.display_name,
      });

      expect(wh.id).toBeDefined();
      expect(wh.name).toBe("CI Monitor");
      expect(wh.channel_id).toBe(channelId1);
      expect(wh.token.startsWith("lyc_wh_")).toBe(true);
      expect(wh.is_active).toBe(true);

      const list = await loadCommunityWebhooks(communityIdA);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(wh.id);
    });

    it("rejects webhook creation with invalid name or missing channel", async () => {
      await expect(
        createCommunityWebhook(communityIdA, {
          name: "X",
          channel_id: channelId1,
          created_by: testActor.id,
        }),
      ).rejects.toThrow("O nome do webhook deve ter pelo menos 2 caracteres.");

      await expect(
        createCommunityWebhook(communityIdA, {
          name: "Valid Name",
          channel_id: "",
          created_by: testActor.id,
        }),
      ).rejects.toThrow("Selecione um canal de destino para o webhook.");
    });

    it("updates webhook name, channel, avatar, and active status", async () => {
      const created = await createCommunityWebhook(communityIdA, {
        name: "Old Name",
        channel_id: channelId1,
        created_by: testActor.id,
      });

      const updated = await updateCommunityWebhook(communityIdA, created.id, {
        name: "New Name",
        channel_id: channelId2,
        avatar_url: "https://example.com/bot.png",
        is_active: false,
      });

      expect(updated.name).toBe("New Name");
      expect(updated.channel_id).toBe(channelId2);
      expect(updated.avatar_url).toBe("https://example.com/bot.png");
      expect(updated.is_active).toBe(false);
    });

    it("deletes a webhook successfully", async () => {
      const created = await createCommunityWebhook(communityIdA, {
        name: "To Delete",
        channel_id: channelId1,
        created_by: testActor.id,
      });

      expect(await loadCommunityWebhooks(communityIdA)).toHaveLength(1);
      await deleteCommunityWebhook(communityIdA, created.id);
      expect(await loadCommunityWebhooks(communityIdA)).toHaveLength(0);
    });
  });

  describe("Message Delivery & Security Verification", () => {
    it("delivers a valid message to the destination channel", async () => {
      const wh = await createCommunityWebhook(communityIdA, {
        name: "AlertBot",
        channel_id: channelId1,
        created_by: testActor.id,
      });

      const result = await executeWebhookMessage(communityIdA, wh.id, wh.token, {
        content: "Server restarted successfully.",
      });

      expect(result.success).toBe(true);
      expect(result.channel_id).toBe(channelId1);
      expect(result.message_id).toBeDefined();
    });

    it("rejects message delivery with an invalid token", async () => {
      const wh = await createCommunityWebhook(communityIdA, {
        name: "AlertBot",
        channel_id: channelId1,
        created_by: testActor.id,
      });

      await expect(
        executeWebhookMessage(communityIdA, wh.id, "lyc_wh_forged_invalid_token", {
          content: "Intruder message",
        }),
      ).rejects.toThrow("Webhook não encontrado ou credenciais inválidas.");
    });

    it("rejects message delivery when webhook is deactivated", async () => {
      const wh = await createCommunityWebhook(communityIdA, {
        name: "DisabledBot",
        channel_id: channelId1,
        created_by: testActor.id,
      });

      await updateCommunityWebhook(communityIdA, wh.id, { is_active: false });

      await expect(
        executeWebhookMessage(communityIdA, wh.id, wh.token, {
          content: "Should not pass",
        }),
      ).rejects.toThrow("Este webhook está desativado.");
    });

    it("token regeneration invalidates previous token immediately", async () => {
      const wh = await createCommunityWebhook(communityIdA, {
        name: "KeyCycleBot",
        channel_id: channelId1,
        created_by: testActor.id,
      });

      const originalToken = wh.token;

      // Regenerate token
      const regenerated = await regenerateCommunityWebhookToken(communityIdA, wh.id);
      expect(regenerated.token).not.toBe(originalToken);
      expect(regenerated.token.startsWith("lyc_wh_")).toBe(true);

      // Attempting delivery with OLD token must fail
      await expect(
        executeWebhookMessage(communityIdA, wh.id, originalToken, {
          content: "Trying old token",
        }),
      ).rejects.toThrow("Webhook não encontrado ou credenciais inválidas.");

      // Attempting delivery with NEW token must succeed
      const okResult = await executeWebhookMessage(communityIdA, wh.id, regenerated.token, {
        content: "Trying new token",
      });
      expect(okResult.success).toBe(true);
    });

    it("prevents cross-community access", async () => {
      const whA = await createCommunityWebhook(communityIdA, {
        name: "Community A Bot",
        channel_id: channelId1,
        created_by: testActor.id,
      });

      // Community B attempts to load or execute community A's webhook
      const listB = await loadCommunityWebhooks(communityIdB);
      expect(listB).toHaveLength(0);

      await expect(
        executeWebhookMessage(communityIdB, whA.id, whA.token, {
          content: "Cross community injection",
        }),
      ).rejects.toThrow("Webhook não encontrado ou credenciais inválidas.");
    });
  });

  describe("Audit Log Integration without Secret Token Leakage", () => {
    it("records webhook actions in Audit Log without exposing secret tokens", async () => {
      const wh = await createCommunityWebhook(communityIdA, {
        name: "AuditTestBot",
        channel_id: channelId1,
        created_by: testActor.id,
      });

      // Record Audit Log for creation
      recordAuditLogEntry(communityIdA, testActor, {
        action_type: "webhook_create",
        target_type: "webhook",
        target_name: wh.name,
        target_id: wh.id,
        metadata: {
          channel_id: wh.channel_id,
          channel_name: "geral",
        },
      });

      // Record Audit Log for token regeneration
      recordAuditLogEntry(communityIdA, testActor, {
        action_type: "webhook_token_regenerate",
        target_type: "webhook",
        target_name: wh.name,
        target_id: wh.id,
        metadata: {
          reason: "Chave regenerada",
        },
      });

      const logs = getCommunityAuditLogs(communityIdA, {
        isOwner: true,
        permissions: ["manage_community"],
      });

      expect(logs).toHaveLength(2);
      expect(logs[0].action_type).toBe("webhook_token_regenerate");
      expect(logs[1].action_type).toBe("webhook_create");

      // Verify that NO log entry contains the secret token or full URL
      const serializedLogs = JSON.stringify(logs);
      expect(serializedLogs).not.toContain(wh.token);
      expect(serializedLogs).not.toContain("functions/v1/community-webhook");
    });
  });

  describe("Connected Integrations Operations", () => {
    it("manages connected integrations list and toggle status", async () => {
      const initial = await loadCommunityIntegrations(communityIdA);
      expect(initial).toEqual([]);

      // Connect integration
      const createdIntegration = await connectCommunityIntegration(communityIdA, {
        name: "LiveKit Engine",
        description: "Official Voice & Video Engine",
        connected_by: testActor.id,
      });

      expect(createdIntegration.id).toBeDefined();
      expect(createdIntegration.status).toBe("Conectado");
      expect(createdIntegration.is_active).toBe(true);

      // Toggle integration
      const toggled = await toggleCommunityIntegration(
        communityIdA,
        createdIntegration.id,
        false,
      );
      expect(toggled.is_active).toBe(false);
      expect(toggled.status).toBe("Desativado");

      await disconnectCommunityIntegration(communityIdA, createdIntegration.id);
      const afterDisconnect = await loadCommunityIntegrations(communityIdA);
      expect(
        afterDisconnect.find((i) => i.id === createdIntegration.id),
      ).toBeUndefined();
    });
  });
});
