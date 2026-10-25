import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";

vi.mock("../src/lib/supabase", () => ({
  configured: true,
  supabase: null,
  db: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      verifyOtp: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: vi.fn(),
        }),
      }),
    }),
  }),
  messageOf: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

import { Auth } from "../src/features/auth/Auth";

describe("LYC Arena Login & Authentication Structure", () => {
  it("renders strictly single login form with no duplicate elements or ghost forms", () => {
    const html = renderToStaticMarkup(
      createElement(Auth, {
        onDemo: () => {},
        onLogin: () => {},
        error: "",
      }),
    );

    // 1. Root structure
    const mainMatches = html.match(/<main class="arena-auth">/g);
    expect(mainMatches).toHaveLength(1);

    // 2. Exactly one heading "Bem-vindo de volta!"
    const headingMatches = html.match(/Bem-vindo de volta!/g);
    expect(headingMatches).toHaveLength(1);

    // 3. Exactly one form
    const formMatches = html.match(/<form>/g);
    expect(formMatches).toHaveLength(1);

    // 4. Exactly one email field
    const emailMatches = html.match(/placeholder="E-mail ou número de telefone"/g);
    expect(emailMatches).toHaveLength(1);

    // 5. Exactly one password field
    const passwordMatches = html.match(/placeholder="Senha"/g);
    expect(passwordMatches).toHaveLength(1);

    // 6. Exactly one checkbox for remember me
    const rememberMatches = html.match(/Manter-me conectado/g);
    expect(rememberMatches).toHaveLength(1);

    // 7. Exactly one submit button with "Entrar" and type="submit"
    const submitBtnMatches = html.match(/class="arena-auth-submit"[^>]*type="submit"/g);
    expect(submitBtnMatches).toHaveLength(1);
    expect(html).toContain("<span>Entrar</span>");

    // 8. Exactly one "ou" divider
    const dividerMatches = html.match(/<div class="arena-auth-divider"><span>ou<\/span><\/div>/g);
    expect(dividerMatches).toHaveLength(1);

    // 9. Exactly one QR button
    const qrMatches = html.match(/class="arena-auth-qr-btn"/g);
    expect(qrMatches).toHaveLength(1);

    // 10. Exactly one "Registre-se" button
    const registerMatches = html.match(/Registre-se/g);
    expect(registerMatches).toHaveLength(1);

    // 11. No compact duplicate logo injected
    expect(html).not.toContain("arena-auth-compact-logo");
  });

  it("verifies auth.css maintains centered background without horizontal displacement", () => {
    const cssPath = path.resolve(__dirname, "../src/features/auth/auth.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    // Ensure object-position does not displace background horizontally to 65% or 70%
    expect(css).not.toContain("65% center");
    expect(css).not.toContain("70% center");

    // Background must be strictly centered
    expect(css).toContain("object-position: center center");

    // Card background must be fully opaque dark tone to prevent any ghost raster bleed
    expect(css).toContain("background: #080e20;");
  });
});
