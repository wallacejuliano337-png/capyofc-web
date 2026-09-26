import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  owner: vi.fn(),
  stage: vi.fn(),
  cleanup: vi.fn(),
  publish: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  single: vi.fn(),
}));
vi.mock("../src/services/avatars", () => ({
  assertProfileOwner: state.owner,
  stageProfileImage: state.stage,
  cleanupProfileFiles: state.cleanup,
  ownedAvatarPath: (url: string | null) =>
    url?.split("/").slice(-2).join("/") || null,
}));
vi.mock("../src/hooks/useAvatar", () => ({ publishAvatar: state.publish }));
vi.mock("../src/lib/supabase", () => ({
  db: () => ({ from: () => ({ update: state.update }) }),
}));
import { saveProfile, profileAppearance } from "../src/services/profile";
import type { Profile } from "../src/types";
const profile: Profile = {
  id: "owner",
  display_name: "User",
  username: "user",
  avatar_url: "https://example/owner/old.gif",
  status: "online",
  role: "MEMBER",
  created_at: "2026-01-01",
  banner_url: null,
  bio: "",
  profile_primary_color: "#142744",
  profile_secondary_color: "#30204c",
  profile_accent_color: "#7588f5",
};
const draft = () => ({
  displayName: "New name",
  appearance: { ...profileAppearance(profile), bio: "New bio" },
  avatar: undefined,
  banner: undefined,
});
beforeEach(() => {
  vi.resetAllMocks();
  const q = {
    eq: state.eq,
    is: state.is,
    select: () => q,
    single: state.single,
  };
  state.eq.mockReturnValue(q);
  state.is.mockReturnValue(q);
  state.update.mockReturnValue(q);
  state.owner.mockResolvedValue(undefined);
  state.cleanup.mockResolvedValue("");
  state.single.mockResolvedValue({
    data: { ...profile, display_name: "New name", bio: "New bio" },
    error: null,
  });
});
it("saves all profile fields together and compares the original values", async () => {
  const result = await saveProfile(profile, draft());
  expect(state.owner).toHaveBeenCalledWith("owner");
  expect(state.update).toHaveBeenCalledOnce();
  expect(state.update.mock.calls[0][0]).toMatchObject({
    display_name: "New name",
    bio: "New bio",
    avatar_url: profile.avatar_url,
    banner_url: null,
  });
  expect(state.eq).toHaveBeenCalledWith("display_name", "User");
  expect(state.is).toHaveBeenCalledWith("banner_url", null);
  expect(result.profile.bio).toBe("New bio");
});
it("does not upload or update when the authenticated owner check fails", async () => {
  state.owner.mockRejectedValue(new Error("forbidden"));
  await expect(saveProfile(profile, draft())).rejects.toThrow("forbidden");
  expect(state.stage).not.toHaveBeenCalled();
  expect(state.update).not.toHaveBeenCalled();
});
it("preserves the original GIF file during upload and cleans new files after a conflict", async () => {
  const file = new File(["GIF89a12345"], "animation.gif", {
    type: "image/gif",
  });
  state.stage.mockResolvedValue({
    path: "owner/new.gif",
    url: "https://example/owner/new.gif",
  });
  state.single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
  await expect(
    saveProfile(profile, { ...draft(), banner: file }),
  ).rejects.toThrow("outra sessão");
  expect(state.stage).toHaveBeenCalledWith("owner", file);
  expect(state.cleanup).toHaveBeenCalledWith("owner", "owner/new.gif");
  expect(state.publish).not.toHaveBeenCalled();
});
it("removes an old file only after successfully unlinking it", async () => {
  state.single.mockResolvedValue({
    data: { ...profile, avatar_url: null },
    error: null,
  });
  await saveProfile(profile, { ...draft(), avatar: null });
  expect(state.update.mock.calls[0][0].avatar_url).toBeNull();
  expect(state.cleanup).toHaveBeenCalledWith("owner", "owner/old.gif");
  expect(state.single.mock.invocationCallOrder[0]).toBeLessThan(
    state.cleanup.mock.invocationCallOrder.at(-1)!,
  );
});
it("rejects invalid colors and oversized bio before writing", async () => {
  await expect(
    saveProfile(profile, {
      ...draft(),
      appearance: { ...profileAppearance(profile), accent: "red" },
    }),
  ).rejects.toThrow();
  await expect(
    saveProfile(profile, {
      ...draft(),
      appearance: { ...profileAppearance(profile), bio: "x".repeat(501) },
    }),
  ).rejects.toThrow();
  expect(state.update).not.toHaveBeenCalled();
});
