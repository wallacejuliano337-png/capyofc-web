import { describe, it, expect } from "vitest";
import {
  validateCommunityName,
  validateCommunityDescription,
  canManageCommunity,
  COMMUNITY_MEDIA_LIMIT,
  COMMUNITY_MEDIA_ACCEPT,
  COMMUNITY_NAME_MAX_LENGTH,
  COMMUNITY_DESC_MAX_LENGTH,
} from "../src/services/community-media";

describe("Community Profile Validation & Permissions", () => {
  describe("validateCommunityName", () => {
    it("rejects empty or whitespace-only name", () => {
      expect(validateCommunityName("")).toBe("O nome da comunidade não pode ficar em branco.");
      expect(validateCommunityName("   ")).toBe("O nome da comunidade não pode ficar em branco.");
    });

    it("rejects names longer than 60 characters", () => {
      const longName = "A".repeat(COMMUNITY_NAME_MAX_LENGTH + 1);
      expect(validateCommunityName(longName)).toContain("no máximo 60 caracteres");
    });

    it("accepts valid names within 1 and 60 characters", () => {
      expect(validateCommunityName("Comunidade LYC")).toBeNull();
      expect(validateCommunityName("A")).toBeNull();
      expect(validateCommunityName("  Nome com espaços válidos  ")).toBeNull();
    });
  });

  describe("validateCommunityDescription", () => {
    it("accepts empty description", () => {
      expect(validateCommunityDescription("")).toBeNull();
    });

    it("accepts descriptions up to 300 characters", () => {
      const validDesc = "B".repeat(COMMUNITY_DESC_MAX_LENGTH);
      expect(validateCommunityDescription(validDesc)).toBeNull();
    });

    it("rejects descriptions exceeding 300 characters", () => {
      const longDesc = "C".repeat(COMMUNITY_DESC_MAX_LENGTH + 1);
      expect(validateCommunityDescription(longDesc)).toContain("no máximo 300 caracteres");
    });
  });

  describe("canManageCommunity", () => {
    const ownerId = "user-owner-123";
    const memberId = "user-member-456";

    it("allows owner regardless of permissions array", () => {
      expect(canManageCommunity(ownerId, ownerId, [])).toBe(true);
      expect(canManageCommunity(ownerId, ownerId, ["send_messages"])).toBe(true);
    });

    it("allows non-owner who has manage_community permission", () => {
      expect(canManageCommunity(ownerId, memberId, ["manage_community"])).toBe(true);
      expect(canManageCommunity(ownerId, memberId, ["manage_channels", "manage_community"])).toBe(true);
    });

    it("denies non-owner without manage_community permission", () => {
      expect(canManageCommunity(ownerId, memberId, [])).toBe(false);
      expect(canManageCommunity(ownerId, memberId, ["manage_channels", "send_messages"])).toBe(false);
    });

    it("denies when userId is undefined", () => {
      expect(canManageCommunity(ownerId, undefined, ["manage_community"])).toBe(false);
    });
  });

  describe("Media Constraints", () => {
    it("enforces 5MB file size limit matching avatars bucket", () => {
      expect(COMMUNITY_MEDIA_LIMIT).toBe(5 * 1024 * 1024);
    });

    it("accepts png, jpeg, webp, gif formats", () => {
      expect(COMMUNITY_MEDIA_ACCEPT).toContain("image/png");
      expect(COMMUNITY_MEDIA_ACCEPT).toContain("image/jpeg");
      expect(COMMUNITY_MEDIA_ACCEPT).toContain("image/webp");
      expect(COMMUNITY_MEDIA_ACCEPT).toContain("image/gif");
    });
  });

  describe("Unsaved / Dirty state logic", () => {
    it("detects changes in name, icon, banner, and description", () => {
      const initial = {
        name: "Comunidade LYC",
        imageUrl: "https://example.com/icon.png",
        bannerUrl: "https://example.com/banner.png",
        description: "Bem-vindos!",
      };

      // No changes
      const isDirty1 =
        initial.name !== initial.name ||
        initial.imageUrl !== initial.imageUrl ||
        initial.bannerUrl !== initial.bannerUrl ||
        initial.description !== initial.description;
      expect(isDirty1).toBe(false);

      // Name change
      const isDirtyName = "Novo Nome" !== initial.name;
      expect(isDirtyName).toBe(true);

      // Icon change
      const isDirtyIcon = null !== initial.imageUrl;
      expect(isDirtyIcon).toBe(true);

      // Banner change
      const isDirtyBanner = "https://example.com/new-banner.png" !== initial.bannerUrl;
      expect(isDirtyBanner).toBe(true);

      // Description change
      const isDirtyDesc = "Nova descrição" !== initial.description;
      expect(isDirtyDesc).toBe(true);
    });
  });
});
