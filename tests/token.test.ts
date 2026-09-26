import { beforeEach, describe, it, expect, vi } from "vitest";
import { TokenVerifier } from "livekit-server-sdk";
const mocks = vi.hoisted(() => ({
  speak: true,
  share: true,
  configured: true,
  authenticated: true,
  allowed: true,
  user: "11111111-1111-4111-8111-111111111111",
  calls: [] as unknown[],
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (_url: string, _key: string, options: unknown) => {
    mocks.calls.push(options);
    return {
      auth: {
        getUser: async () => ({
          data: { user: mocks.authenticated ? { id: mocks.user } : null },
          error: mocks.authenticated ? null : new Error("bad"),
        }),
      },
      rpc: async (name: string) => ({
        data:
          name === "voice_channel_permissions"
            ? {
                connect: mocks.allowed,
                speak: mocks.speak,
                share_screen: mocks.share,
              }
            : mocks.allowed,
        error: null,
      }),
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                display_name: "Jogadora",
                avatar_url: "https://example.test/avatar.png",
              },
            }),
          }),
        }),
      }),
    };
  },
}));
let handler: (req: Request) => Promise<Response>;
vi.stubGlobal("Deno", {
  env: {
    get: (name: string) =>
      ({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "public-test",
        LIVEKIT_URL: "wss://example.livekit.cloud",
        LIVEKIT_API_KEY: "test-api",
        LIVEKIT_API_SECRET: mocks.configured
          ? "only-for-unit-tests-secret-minimum-32-characters"
          : undefined,
      })[name],
  },
  serve: (fn: typeof handler) => {
    handler = fn;
  },
});
await import("../supabase/functions/livekit-token/index");
beforeEach(() => {
  mocks.speak = true;
  mocks.share = true;
  mocks.configured = true;
  mocks.authenticated = true;
  mocks.allowed = true;
  mocks.calls = [];
});
const request = (
  body: unknown = { channelId: "22222222-2222-4222-8222-222222222222" },
) =>
  new Request("https://endpoint.test", {
    method: "POST",
    headers: {
      Authorization: "Bearer user-jwt",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
describe("LiveKit token endpoint", () => {
  it("rejects missing authentication", async () => {
    const r = await handler(
      new Request("https://endpoint.test", { method: "POST" }),
    );
    expect(r.status).toBe(401);
  });
  it("validates the user with Auth, not unverified JWT payload", async () => {
    mocks.authenticated = false;
    expect((await handler(request())).status).toBe(401);
  });
  it("rejects unauthorized rooms", async () => {
    mocks.allowed = false;
    expect((await handler(request())).status).toBe(403);
  });
  it("rejects malformed room identifiers", async () => {
    expect((await handler(request({ channelId: "room-admin" }))).status).toBe(
      400,
    );
  });
  it("returns 503 without backend secrets and never emits a token", async () => {
    mocks.configured = false;
    const r = await handler(request());
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ error: "Media service not configured" });
    expect(r.headers.get("Cache-Control")).toBe("no-store");
  });
  it("rejects non-hex identifiers and null payloads", async () => {
    expect(
      (
        await handler(
          request({ channelId: "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz" }),
        )
      ).status,
    ).toBe(400);
    expect((await handler(request(null))).status).toBe(400);
  });
  it("accepts the authenticated desktop CORS preflight", async () => {
    const r = await handler(
      new Request("https://endpoint.test", { method: "OPTIONS" }),
    );
    expect(r.status).toBe(200);
    expect(r.headers.get("Access-Control-Allow-Headers")).toContain(
      "x-client-info",
    );
  });
  it("does not grant microphone or screen publishing without community permissions", async () => {
    mocks.speak = false;
    mocks.share = false;
    const r = await handler(request());
    expect(r.status).toBe(200);
    const { token } = await r.json();
    const jwt = await new TokenVerifier(
      "test-api",
      "only-for-unit-tests-secret-minimum-32-characters",
    ).verify(token);
    expect(jwt.video?.canPublish).toBe(false);
    expect(jwt.video?.canSubscribe).toBe(true);
    expect(jwt.video?.canPublishSources).toEqual([]);
  });
  it("signs a short-lived scoped token with the authenticated identity", async () => {
    const r = await handler(
      request({
        channelId: "22222222-2222-4222-8222-222222222222",
        identity: "attacker",
        room: "other-room",
      }),
    );
    expect(r.status).toBe(200);
    const { token, url } = await r.json();
    const jwt = await new TokenVerifier(
      "test-api",
      "only-for-unit-tests-secret-minimum-32-characters",
    ).verify(token);
    expect(jwt.sub).toBe(mocks.user);
    expect(jwt.name).toBe("Jogadora");
    expect(JSON.parse(jwt.metadata || "{}").avatar_url).toBe(
      "https://example.test/avatar.png",
    );
    expect(jwt.video?.roomAdmin).not.toBe(true);
    expect(jwt.video?.canUpdateOwnMetadata).not.toBe(true);
    expect(jwt.video?.room).toBe("lyc-22222222-2222-4222-8222-222222222222");
    expect(jwt.video?.roomJoin).toBe(true);
    expect(jwt.video?.canPublishData).toBe(false);
    expect(url).toBe("wss://example.livekit.cloud");
    expect(Number(jwt.exp) - Number(jwt.nbf)).toBeLessThanOrEqual(301);
    expect(mocks.calls[0]).toMatchObject({
      global: { headers: { Authorization: "Bearer user-jwt" } },
    });
  });
});
