import { describe, it, expect } from "vitest";

describe("Fase 2 — Essential Features", () => {
  describe("Category Collapse & Expansion", () => {
    it("toggles category collapse state correctly", () => {
      const collapsedCategories = new Set<string>();

      const toggleCategoryCollapse = (catId: string) => {
        if (collapsedCategories.has(catId)) {
          collapsedCategories.delete(catId);
        } else {
          collapsedCategories.add(catId);
        }
      };

      expect(collapsedCategories.has("cat-1")).toBe(false);

      toggleCategoryCollapse("cat-1");
      expect(collapsedCategories.has("cat-1")).toBe(true);

      toggleCategoryCollapse("cat-1");
      expect(collapsedCategories.has("cat-1")).toBe(false);
    });

    it("aggregates unreads and mentions for collapsed categories", () => {
      const channels = [
        { id: "c1", category_id: "cat-1", name: "geral" },
        { id: "c2", category_id: "cat-1", name: "anúncios" },
        { id: "c3", category_id: "cat-2", name: "off-topic" },
      ];

      const channelUnreads = {
        c1: { unread_count: 2, mention_count: 1 },
        c2: { unread_count: 3, mention_count: 0 },
        c3: { unread_count: 0, mention_count: 0 },
      };

      const isCollapsed = true;
      const category1Channels = channels.filter((c) => c.category_id === "cat-1");

      const categoryHasUnread =
        isCollapsed &&
        category1Channels.some((c) => {
          const u = channelUnreads[c.id as keyof typeof channelUnreads];
          return u && u.unread_count > 0;
        });

      const categoryMentionCount = isCollapsed
        ? category1Channels.reduce((acc, c) => {
            const u = channelUnreads[c.id as keyof typeof channelUnreads];
            return acc + (u?.mention_count || 0);
          }, 0)
        : 0;

      expect(categoryHasUnread).toBe(true);
      expect(categoryMentionCount).toBe(1);
    });

    it("hides unread indicators when category is expanded", () => {
      const channels = [{ id: "c1", category_id: "cat-1", name: "geral" }];
      const channelUnreads = { c1: { unread_count: 5, mention_count: 2 } };

      const isCollapsed = false;
      const categoryHasUnread =
        isCollapsed &&
        channels.some((c) => {
          const u = channelUnreads[c.id as keyof typeof channelUnreads];
          return u && u.unread_count > 0;
        });
      const categoryMentionCount = isCollapsed
        ? channels.reduce((acc, c) => {
            const u = channelUnreads[c.id as keyof typeof channelUnreads];
            return acc + (u?.mention_count || 0);
          }, 0)
        : 0;

      expect(categoryHasUnread).toBe(false);
      expect(categoryMentionCount).toBe(0);
    });
  });

  describe("Server Tag Formatting", () => {
    it("formats server tag correctly when present", () => {
      const communityTag = "LYC";
      const formattedTag = communityTag ? `[${communityTag.trim().toUpperCase()}]` : null;
      expect(formattedTag).toBe("[LYC]");
    });

    it("handles null or empty server tag gracefully", () => {
      const emptyTag = "";
      const formattedEmpty = emptyTag.trim() ? `[${emptyTag.trim().toUpperCase()}]` : null;
      expect(formattedEmpty).toBeNull();

      const nullTag: string | null = null;
      const formattedNull = nullTag ? `[${nullTag}]` : null;
      expect(formattedNull).toBeNull();
    });
  });

  describe("Server Template Generator", () => {
    it("generates a shareable template data structure", () => {
      const community = {
        id: "comm-12345678-abcd",
        name: "Squad Alpha",
        description: "Comunidade competitiva",
        tag: "ALPH",
      };

      const channels = [
        { name: "geral", kind: "text", category_id: "Texto" },
        { name: "voz-1", kind: "voice", category_id: "Voz" },
      ];

      const roles = [
        { name: "Admin", permissions: ["manage_community", "manage_channels"] },
        { name: "Membro", permissions: ["send_messages", "speak"] },
      ];

      const templateData = {
        name: community.name,
        description: community.description,
        tag: community.tag,
        channels: channels.map((c) => ({
          name: c.name,
          kind: c.kind,
          category: c.category_id,
        })),
        roles: roles.map((r) => ({
          name: r.name,
          permissions: r.permissions,
        })),
      };

      expect(templateData.name).toBe("Squad Alpha");
      expect(templateData.tag).toBe("ALPH");
      expect(templateData.channels).toHaveLength(2);
      expect(templateData.roles).toHaveLength(2);

      const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(templateData))));
      const templateLink = `https://arena.lyc.gg/template/${community.id.slice(0, 8)}?t=${encoded.slice(0, 32)}`;

      expect(templateLink).toContain("https://arena.lyc.gg/template/comm-123");
      expect(templateLink).toContain("?t=");
    });
  });

  describe("Dynamic Community Engagement Level", () => {
    function computeEngagementLevel(memberCount: number) {
      if (memberCount >= 20) {
        return { level: "Nível 3", title: "Comunidade Consolidada" };
      }
      if (memberCount >= 5) {
        return { level: "Nível 2", title: "Comunidade Ativa" };
      }
      return { level: "Nível 1", title: "Comunidade Inicial" };
    }

    it("assigns Nível 1 to initial squads", () => {
      expect(computeEngagementLevel(1)).toEqual({
        level: "Nível 1",
        title: "Comunidade Inicial",
      });
      expect(computeEngagementLevel(4)).toEqual({
        level: "Nível 1",
        title: "Comunidade Inicial",
      });
    });

    it("assigns Nível 2 to active squads with 5 to 19 members", () => {
      expect(computeEngagementLevel(5)).toEqual({
        level: "Nível 2",
        title: "Comunidade Ativa",
      });
      expect(computeEngagementLevel(19)).toEqual({
        level: "Nível 2",
        title: "Comunidade Ativa",
      });
    });

    it("assigns Nível 3 to established communities with 20+ members", () => {
      expect(computeEngagementLevel(20)).toEqual({
        level: "Nível 3",
        title: "Comunidade Consolidada",
      });
      expect(computeEngagementLevel(150)).toEqual({
        level: "Nível 3",
        title: "Comunidade Consolidada",
      });
    });
  });
});
