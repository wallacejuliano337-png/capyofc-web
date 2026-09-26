import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ProfileCard,
  defaultAppearance,
} from "../src/features/profile/ProfileCard";
import { expect, it } from "vitest";
it("renders a static avatar without a banner or bio and without inventing a join date", () => {
  const html = renderToStaticMarkup(
    createElement(ProfileCard, {
      profile: {
        display_name: "Membro",
        username: "membro",
        avatar_url: "https://example.test/photo.png",
        created_at: "",
      },
      appearance: defaultAppearance,
      presence: "offline",
    }),
  );
  expect(html).toContain("photo.png");
  expect(html).toContain("Offline");
  expect(html).not.toContain('alt="Banner do perfil"');
  expect(html).not.toContain("Sobre mim");
  expect(html).not.toContain("Membro desde");
});
it("renders initials when the user has no avatar", () => {
  const html = renderToStaticMarkup(
    createElement(ProfileCard, {
      profile: {
        display_name: "Naori",
        username: "naori",
        avatar_url: null,
        created_at: "2026-01-01",
      },
      appearance: defaultAppearance,
    }),
  );
  expect(html).toContain("NA");
  expect(html).not.toContain('alt="Avatar do perfil"');
});
