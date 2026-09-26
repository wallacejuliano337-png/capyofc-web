import { it, expect, vi } from "vitest";
const rpc = vi.hoisted(() =>
  vi.fn(async () => ({ data: "created", error: null })),
);
vi.mock("../src/lib/supabase", () => ({ db: () => ({ rpc }) }));
import { communityAction, inviteCode } from "../src/services/communities";
it("omits the empty form ID on creation but preserves edit IDs", async () => {
  await communityAction("create_category", {
    id: "",
    name: "Canais",
    community_id: "community",
  });
  expect(rpc).toHaveBeenLastCalledWith("community_action", {
    action: "create_category",
    payload: { name: "Canais", community_id: "community" },
  });
  await communityAction("edit_category", { id: "existing", name: "Novo nome" });
  expect(rpc).toHaveBeenLastCalledWith("community_action", {
    action: "edit_category",
    payload: { id: "existing", name: "Novo nome" },
  });
});
it("accepts invitation codes and pasted links but rejects unrelated values", () => {
  const code = "a".repeat(32);
  expect(inviteCode(code)).toBe(code);
  expect(inviteCode("https://example.test/?invite=" + code)).toBe(code);
  expect(() => inviteCode("arbitrary-room")).toThrow();
});
