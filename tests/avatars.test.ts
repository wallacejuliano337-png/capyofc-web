import { describe, expect, it, vi } from "vitest";
vi.mock("../src/lib/supabase", () => ({
  supabase: null,
  db: () => ({
    storage: {
      from: () => ({
        getPublicUrl: () => ({
          data: {
            publicUrl:
              "https://arena.example/storage/v1/object/public/avatars/",
          },
        }),
      }),
    },
  }),
}));
import {
  AVATAR_LIMIT,
  validateAvatar,
  ownedAvatarPath,
} from "../src/services/avatars";
describe("avatar file boundaries", () => {
  it("accepts supported images through 5 MiB", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"])
      expect(() => validateAvatar({ type, size: AVATAR_LIMIT })).not.toThrow();
  });
  it("rejects unsupported, empty and oversized files", () => {
    for (const file of [
      { type: "image/svg+xml", size: 10 },
      { type: "image/png", size: 0 },
      { type: "image/webp", size: AVATAR_LIMIT + 1 },
    ])
      expect(() => validateAvatar(file)).toThrow();
  });
  it("cleans only a previous avatar in the same bucket and own directory", () => {
    const base = "https://arena.example/storage/v1/object/public/avatars/";
    expect(ownedAvatarPath(base + "owner/old.png", "owner")).toBe(
      "owner/old.png",
    );
    expect(ownedAvatarPath(base + "other/old.png", "owner")).toBeNull();
    expect(
      ownedAvatarPath("https://external.example/owner/old.png", "owner"),
    ).toBeNull();
    expect(ownedAvatarPath(base + "owner/nested/old.png", "owner")).toBeNull();
    expect(ownedAvatarPath(null, "owner")).toBeNull();
  });
});
