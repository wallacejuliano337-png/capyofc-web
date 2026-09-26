import { expect, it, vi } from "vitest";
import {
  UserProfileCache,
  profilePopoverPosition,
} from "../src/services/user-profiles";
import type { Profile } from "../src/types";
const profile = (id: string): Profile => ({
  id,
  display_name: id,
  username: id,
  avatar_url: null,
  banner_url: null,
  bio: "",
  profile_primary_color: "#142744",
  profile_secondary_color: "#30204c",
  profile_accent_color: "#7588f5",
  created_at: "2026-01-01",
  status: "offline",
  role: "MEMBER",
});
it("reuses complete loaded profiles without fetching and scopes identities", async () => {
  const fetch = vi.fn(async (id: string) => profile(id)),
    cache = new UserProfileCache(fetch);
  expect((await cache.get("A", profile("A"))).id).toBe("A");
  expect((await cache.get("A")).id).toBe("A");
  expect(fetch).not.toHaveBeenCalled();
  expect((await cache.get("B", profile("A"))).id).toBe("B");
  expect(fetch).toHaveBeenCalledWith("B");
});
it("deduplicates pending queries and retries failed queries", async () => {
  let resolve!: (p: Profile) => void;
  const fetch = vi.fn(
      () =>
        new Promise<Profile>((r) => {
          resolve = r;
        }),
    ),
    cache = new UserProfileCache(fetch);
  const a = cache.get("A"),
    b = cache.get("A");
  expect(fetch).toHaveBeenCalledOnce();
  resolve(profile("A"));
  expect(await a).toEqual(await b);
  const failure = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(profile("B"));
  const retry = new UserProfileCache(failure);
  await expect(retry.get("B")).rejects.toThrow();
  await expect(retry.get("B")).resolves.toMatchObject({ id: "B" });
});
it("refreshes expired cache and never accepts a different returned user", async () => {
  const fetch = vi.fn(async () => profile("A")),
    cache = new UserProfileCache(fetch);
  const now = vi.spyOn(Date, "now").mockReturnValue(0);
  await cache.get("A", profile("A"));
  now.mockReturnValue(120001);
  await cache.get("A");
  expect(fetch).toHaveBeenCalledOnce();
  now.mockRestore();
  await expect(
    new UserProfileCache(async () => profile("A")).get("B"),
  ).rejects.toThrow();
});
it("positions right when possible and left/up at viewport boundaries", () => {
  expect(
    profilePopoverPosition(
      { left: 100, right: 140, top: 80 },
      340,
      450,
      1200,
      800,
    ),
  ).toEqual({ left: 150, top: 80 });
  expect(
    profilePopoverPosition(
      { left: 1100, right: 1140, top: 740 },
      340,
      450,
      1200,
      800,
    ),
  ).toEqual({ left: 750, top: 338 });
  expect(
    profilePopoverPosition(
      { left: 5, right: 45, top: -50 },
      340,
      450,
      400,
      500,
    ),
  ).toEqual({ left: 12, top: 12 });
});
