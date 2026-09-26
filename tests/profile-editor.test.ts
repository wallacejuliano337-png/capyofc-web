import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  validateProfileMedia,
  PROFILE_MEDIA_LIMIT,
} from "../src/services/profile-media";
import {
  ProfileCard,
  defaultAppearance,
} from "../src/features/profile/ProfileCard";
it("accepts original GIF bytes without conversion", async () => {
  const bytes = new TextEncoder().encode("GIF89a" + "\0".repeat(20));
  const file = new File([bytes], "animation.gif", { type: "image/gif" });
  await expect(validateProfileMedia(file)).resolves.toBeUndefined();
  expect(new Uint8Array(await file.arrayBuffer())).toEqual(bytes);
});
it("rejects disguised, mismatched, empty, oversized or executable files", async () => {
  for (const file of [
    new File(["<svg/>"], "x.svg", { type: "image/svg+xml" }),
    new File(["GIF89a"], "x.png", { type: "image/gif" }),
    new File(["<script>"], "x.gif", { type: "image/gif" }),
    new File([], "x.gif", { type: "image/gif" }),
    new File([new Uint8Array(PROFILE_MEDIA_LIMIT + 1)], "x.gif", {
      type: "image/gif",
    }),
  ])
    await expect(validateProfileMedia(file)).rejects.toThrow();
});
it("escapes bio and renders animated images directly with scoped theme colors", () => {
  const html = renderToStaticMarkup(
    createElement(ProfileCard, {
      profile: {
        display_name: "Preview",
        username: "preview",
        avatar_url: "https://example.test/avatar.gif",
        created_at: "2026-01-01",
      },
      appearance: {
        ...defaultAppearance,
        banner: "https://example.test/banner.gif",
        bio: "<script>alert(1)</script>",
      },
      presence: "online",
    }),
  );
  expect(html).toContain("avatar.gif");
  expect(html).toContain("banner.gif");
  expect(html).not.toContain("<script>");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("Membro desde");
});
