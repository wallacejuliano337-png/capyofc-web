import { describe, it, expect, beforeEach } from "vitest";
import {
  validateEmojiName,
  formatEmojiName,
  validateStickerName,
  validateSoundName,
  createCommunityExpression,
  loadCommunityExpressions,
  updateCommunityExpression,
  deleteCommunityExpression,
  EXPRESSION_LIMITS,
  EXPRESSION_SIZE_LIMITS,
  SOUND_MAX_DURATION,
  clearExpressionsMemoryStore,
} from "../src/services/community-expressions";

describe("Community Expressions Service (Emojis, Stickers, Sounds)", () => {
  const communityId = "test-community-expressions";

  beforeEach(() => {
    clearExpressionsMemoryStore();
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.clear();
      }
    } catch {
      // ignore
    }
  });

  describe("Validation Functions", () => {
    it("validates emoji names properly", () => {
      expect(validateEmojiName("lyc")).toBeNull();
      expect(validateEmojiName(":gg:")).toBeNull();
      expect(validateEmojiName("trofeu_2026")).toBeNull();

      expect(validateEmojiName("a")).toContain("mínimo 2 caracteres");
      expect(validateEmojiName("nome com espaços")).toContain("apenas letras, números e sublinhados");
      expect(validateEmojiName("emoji@#$")).toContain("apenas letras, números e sublinhados");
      expect(validateEmojiName("a".repeat(33))).toContain("máximo 32 caracteres");
    });

    it("formats emoji names with colons correctly", () => {
      expect(formatEmojiName("lyc")).toBe(":lyc:");
      expect(formatEmojiName(":trofeu:")).toBe(":trofeu:");
      expect(formatEmojiName("::coroa::")).toBe(":coroa:");
      expect(formatEmojiName("EMOJI_UPPER")).toBe(":emoji_upper:");
    });

    it("validates sticker and sound names", () => {
      expect(validateStickerName("Figurinha Show")).toBeNull();
      expect(validateStickerName("a")).toContain("mínimo 2 caracteres");

      expect(validateSoundName("Vitória GG")).toBeNull();
      expect(validateSoundName("a")).toContain("mínimo 2 caracteres");
    });

    it("enforces configured limits and sizes", () => {
      expect(EXPRESSION_LIMITS.emoji).toBe(50);
      expect(EXPRESSION_LIMITS.sticker).toBe(30);
      expect(EXPRESSION_LIMITS.sound).toBe(24);

      expect(EXPRESSION_SIZE_LIMITS.emoji).toBe(5 * 1024 * 1024);
      expect(EXPRESSION_SIZE_LIMITS.sticker).toBe(5 * 1024 * 1024);
      expect(EXPRESSION_SIZE_LIMITS.sound).toBe(3 * 1024 * 1024);
      expect(SOUND_MAX_DURATION).toBe(10);
    });
  });

  describe("CRUD Operations", () => {
    it("creates, reads, updates, and deletes an emoji", async () => {
      const created = await createCommunityExpression(communityId, {
        kind: "emoji",
        name: "lyc_trophy",
        file_url: "https://example.com/trophy.png",
        created_by: "user-1",
        creator_name: "Coronel",
      });

      expect(created.name).toBe(":lyc_trophy:");
      expect(created.kind).toBe("emoji");

      const list = await loadCommunityExpressions(communityId, "emoji");
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe(":lyc_trophy:");

      const updated = await updateCommunityExpression(communityId, created.id, {
        name: "lyc_gold",
      });
      expect(updated.name).toBe(":lyc_gold:");

      const deleted = await deleteCommunityExpression(communityId, created.id);
      expect(deleted).toBe(true);

      const afterDelete = await loadCommunityExpressions(communityId, "emoji");
      expect(afterDelete).toHaveLength(0);
    });

    it("prevents duplicate names within the same kind", async () => {
      await createCommunityExpression(communityId, {
        kind: "emoji",
        name: ":coroa:",
        file_url: "https://example.com/crown.png",
        created_by: "user-1",
      });

      await expect(
        createCommunityExpression(communityId, {
          kind: "emoji",
          name: "coroa",
          file_url: "https://example.com/crown2.png",
          created_by: "user-1",
        }),
      ).rejects.toThrow("Já existe um emoji com o nome \":coroa:\".");
    });

    it("creates sound expression with duration", async () => {
      const sound = await createCommunityExpression(communityId, {
        kind: "sound",
        name: "Bip Arena",
        file_url: "https://example.com/bip.mp3",
        duration: 2.5,
        created_by: "user-1",
      });

      expect(sound.duration).toBe(2.5);
      expect(sound.name).toBe("Bip Arena");

      const sounds = await loadCommunityExpressions(communityId, "sound");
      expect(sounds).toHaveLength(1);
      expect(sounds[0].duration).toBe(2.5);
    });
  });
});
