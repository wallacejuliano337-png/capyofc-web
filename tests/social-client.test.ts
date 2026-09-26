import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  responses: [] as unknown[][],
  queries: [] as {
    table: string;
    select?: string;
    filters: Record<string, unknown>;
  }[],
}));
vi.mock("../src/lib/supabase", () => ({
  db: () => ({
    from: (table: string) => {
      const query: {
        table: string;
        select?: string;
        filters: Record<string, unknown>;
      } = { table, filters: {} };
      mock.queries.push(query);
      const builder = {
        select: (s: string) => {
          query.select = s;
          return builder;
        },
        eq: (k: string, v: unknown) => {
          query.filters[k] = v;
          return builder;
        },
        neq: (k: string, v: unknown) => {
          query.filters["neq_" + k] = v;
          return builder;
        },
        or: (v: string) => {
          query.filters.or = v;
          return builder;
        },
        order: () => builder,
        limit: () => builder,
        lt: (k: string, v: unknown) => {
          query.filters["before_" + k] = v;
          return builder;
        },
        in: (k: string, v: unknown) => {
          query.filters["in_" + k] = v;
          return builder;
        },
        then: (resolve: (r: unknown) => unknown) =>
          Promise.resolve({
            data: mock.responses.shift() || [],
            error: null,
          }).then(resolve),
      };
      return builder;
    },
  }),
}));
import {
  dmHistory,
  visiblePresence,
  findPeople,
  friendRequestStatus,
} from "../src/services/social";
beforeEach(() => {
  mock.responses = [];
  mock.queries = [];
});
it("loads older DM pages in sequence and resolves replies outside the page without self-embedding", async () => {
  const rows = Array.from({ length: 80 }, (_, i) => ({
    id: "m" + (81 - i),
    seq: 81 - i,
    conversation_id: "conversation",
    reply_to: i === 0 ? "root" : null,
    content: "message",
  }));
  mock.responses = [
    rows.slice(0, 40),
    rows.slice(40),
    [
      {
        id: "root",
        content: "root outside loaded pages",
        deleted_at: null,
        author_id: "peer",
      },
    ],
  ];
  const history = await dmHistory("conversation", 2);
  expect(history.map((m) => m.seq)).toEqual(
    Array.from({ length: 80 }, (_, i) => i + 2),
  );
  expect(history.at(-1)?.reply?.content).toBe("root outside loaded pages");
  expect(mock.queries[1].filters.before_seq).toBe(42);
  expect(
    mock.queries.every((q) => q.filters.conversation_id === "conversation"),
  ).toBe(true);
  expect(mock.queries.some((q) => q.select?.includes("!"))).toBe(false);
});
it("refreshes edited and deleted reply previews instead of retaining old quoted content", async () => {
  for (const reply of [
    { id: "root", content: "edited", deleted_at: null, author_id: "peer" },
    {
      id: "root",
      content: "",
      deleted_at: "2026-09-22T00:00:00Z",
      author_id: "peer",
    },
  ]) {
    mock.responses = [
      [{ id: "reply", seq: 2, reply_to: "root", content: "response" }],
      [reply],
    ];
    expect((await dmHistory("conversation"))[0].reply).toEqual(reply);
  }
});
it("shows expired leases as Offline without waiting for a database cleanup event", () => {
  const now = Date.parse("2026-09-22T00:00:00Z");
  expect(
    visiblePresence(
      {
        user_id: "peer",
        status: "online",
        expires_at: new Date(now - 1).toISOString(),
      },
      now,
    ),
  ).toBe("offline");
  expect(
    visiblePresence(
      {
        user_id: "peer",
        status: "away",
        expires_at: new Date(now + 1000).toISOString(),
      },
      now,
    ),
  ).toBe("away");
  expect(
    visiblePresence(
      { user_id: "peer", status: "offline", expires_at: null },
      now,
    ),
  ).toBe("offline");
});

it("searches only public profile fields and excludes the current user", async () => {
  mock.responses = [
    [{ id: "b", username: "naori", display_name: "Naori", avatar_url: null }],
  ];
  const people = await findPeople("  Naori  ", "a");
  expect(people[0].display_name).toBe("Naori");
  expect(mock.queries[0].select).toBe("id,username,display_name,avatar_url");
  expect(mock.queries[0].filters).toEqual({
    neq_id: "a",
    or: "username.ilike.%Naori%,display_name.ilike.%Naori%",
  });
});
it("rejects empty searches before querying profiles", async () => {
  await expect(findPeople(" .,% ", "a")).rejects.toThrow("2 caracteres");
  expect(mock.queries).toHaveLength(0);
});
it("reflects both sides of friendship requests and allows a new request after removal", () => {
  const f = {
    user_low: "a",
    user_high: "b",
    requester_id: "a",
    state: "pending",
  };
  expect(friendRequestStatus([f], "a", "b")).toBe("Solicitação enviada");
  expect(friendRequestStatus([f], "b", "a")).toBe("Solicitação recebida");
  expect(friendRequestStatus([{ ...f, state: "accepted" }], "a", "b")).toBe(
    "Já são amigos",
  );
  expect(
    friendRequestStatus([{ ...f, state: "removed" }], "a", "b"),
  ).toBeNull();
  expect(friendRequestStatus([], "a", "a")).toBe("Você");
  expect(friendRequestStatus([], "a", "b", true)).toBe("Usuário bloqueado");
  expect(friendRequestStatus([f], "a", "c")).toBeNull();
});
