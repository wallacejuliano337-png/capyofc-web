import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let pg: PGlite;
const a = "11111111-1111-4111-8111-111111111111",
  b = "22222222-2222-4222-8222-222222222222",
  c = "33333333-3333-4333-8333-333333333333";
let dm: string, message: string;
async function as<T = Record<string, unknown>>(
  user: string,
  sql: string,
  params: unknown[] = [],
) {
  await pg.exec("set role authenticated");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  try {
    return await pg.query<T>(sql, params);
  } finally {
    await pg.exec("reset role");
  }
}
async function action(
  user: string,
  name: string,
  payload: Record<string, unknown> = { user_id: b },
) {
  return (
    await as<{ v: unknown }>(user, "select social_action($1,$2) v", [
      name,
      payload,
    ])
  ).rows[0].v;
}
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;alter default privileges in schema public grant all on tables to anon,authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;create schema realtime;create table realtime.messages(id bigint,extension text);alter table realtime.messages enable row level security;create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;grant usage on schema realtime to authenticated;grant select,insert on realtime.messages to authenticated;create publication supabase_realtime;`,
  );
  for (const name of [
    "20260920083236_initial_arena",
    "20260920180714_fix_message_reply_reference",
  ])
    await pg.exec(readFileSync("supabase/migrations/" + name + ".sql", "utf8"));
  for (const id of [a, b, c])
    await pg.query("insert into auth.users(id) values($1)", [id]);
  await pg.query(
    "select set_config('arena.owner_username',(select username from profiles where id=$1),false)",
    [a],
  );
  for (const name of [
    "20260920231745_communities_permissions",
    "20260921174314_community_administration",
    "20260921180936_social_layer",
  ])
    await pg.exec(readFileSync("supabase/migrations/" + name + ".sql", "utf8"));
}, 30000);
afterAll(async () => {
  await pg?.close();
});
it("enforces friendship direction, uniqueness, decline, cancel, accept and removal", async () => {
  await expect(action(a, "request_friend", { user_id: a })).rejects.toThrow();
  await action(a, "request_friend");
  await expect(action(b, "request_friend", { user_id: a })).rejects.toThrow();
  await expect(action(a, "accept_friend")).rejects.toThrow();
  await expect(action(b, "cancel_friend", { user_id: a })).rejects.toThrow();
  await action(b, "decline_friend", { user_id: a });
  await action(a, "request_friend");
  await action(a, "cancel_friend");
  await action(a, "request_friend");
  await action(b, "accept_friend", { user_id: a });
  await expect(action(a, "request_friend")).rejects.toThrow();
  expect((await as(c, "select * from friendships")).rows).toHaveLength(0);
  expect(
    (await as(a, "select * from friendships where state='accepted'")).rows,
  ).toHaveLength(1);
  expect(
    (await as(b, "select * from friendships where state='accepted'")).rows,
  ).toHaveLength(1);
  await expect(action(c, "accept_friend", { user_id: a })).rejects.toThrow();
  await expect(action(c, "remove_friend", { user_id: a })).rejects.toThrow();
  await expect(
    as(a, "update friendships set state='accepted'"),
  ).rejects.toThrow();
  await action(a, "remove_friend");
  expect(
    (await as(a, "select * from friendships where state='accepted'")).rows,
  ).toHaveLength(0);
  expect(
    (await as(b, "select * from friendships where state='accepted'")).rows,
  ).toHaveLength(0);
  await action(b, "request_friend", { user_id: a });
  await action(a, "accept_friend");
});
it("reuses one DM per pair and isolates all reads and direct writes", async () => {
  dm = (await action(a, "open_dm")) as string;
  expect(await action(b, "open_dm", { user_id: a })).toBe(dm);
  expect((await as(c, "select * from dm_conversations")).rows).toHaveLength(0);
  for (const table of [
    "friendships",
    "user_blocks",
    "dm_conversations",
    "dm_messages",
    "dm_reads",
    "social_inbox",
    "user_presence",
  ])
    await expect(as(a, "delete from " + table)).rejects.toThrow();
  await expect(
    as(a, "insert into dm_conversations(user_low,user_high) values($1,$2)", [
      a,
      c,
    ]),
  ).rejects.toThrow();
  await expect(
    action(c, "send_dm", { conversation_id: dm, content: "spy" }),
  ).rejects.toThrow();
});
it("enforces authorship and same-conversation replies, tombstones deletes", async () => {
  message = (await action(a, "send_dm", {
    conversation_id: dm,
    content: "hello",
  })) as string;
  await action(b, "send_dm", {
    conversation_id: dm,
    content: "reply",
    reply_to: message,
  });
  await expect(
    action(b, "edit_dm", {
      conversation_id: dm,
      message_id: message,
      content: "hijack",
    }),
  ).rejects.toThrow();
  await expect(
    action(b, "delete_dm", { conversation_id: dm, message_id: message }),
  ).rejects.toThrow();
  await action(a, "edit_dm", {
    conversation_id: dm,
    message_id: message,
    content: "edited",
  });
  expect(
    (
      await as<{ content: string }>(
        b,
        "select content from dm_messages where id=$1",
        [message],
      )
    ).rows[0].content,
  ).toBe("edited");
  const otherDm = await action(a, "open_dm", { user_id: c });
  await expect(
    action(a, "send_dm", {
      conversation_id: otherDm,
      reply_to: message,
      content: "cross room",
    }),
  ).rejects.toThrow();
  expect(
    (await as(c, "select * from dm_messages where conversation_id=$1", [dm]))
      .rows,
  ).toHaveLength(0);
  await action(a, "delete_dm", { conversation_id: dm, message_id: message });
  expect(
    (
      await as<{ content: string; deleted_at: string }>(
        b,
        "select content,deleted_at from dm_messages where id=$1",
        [message],
      )
    ).rows[0],
  ).toMatchObject({ content: "" });
});
it("counts only unread incoming nondeleted messages and never moves cursors backwards", async () => {
  await action(a, "send_dm", { conversation_id: dm, content: "new" });
  const inbox = async () =>
    (
      await as<{ last_seq: number; unread_count: number }>(
        b,
        "select * from dm_inbox() where id=$1",
        [dm],
      )
    ).rows[0];
  expect(Number((await inbox()).unread_count)).toBe(1);
  await expect(
    action(b, "read_dm", { conversation_id: dm, through_seq: 999 }),
  ).rejects.toThrow();
  await action(b, "read_dm", {
    conversation_id: dm,
    through_seq: (await inbox()).last_seq,
  });
  await action(b, "read_dm", { conversation_id: dm, through_seq: 0 });
  expect(Number((await inbox()).unread_count)).toBe(0);
  await action(a, "send_dm", { conversation_id: dm, content: "after read" });
  expect(Number((await inbox()).unread_count)).toBe(1);
});
it("blocks both directions at the backend and preserves existing history", async () => {
  const before = (
    await as(a, "select * from dm_messages where conversation_id=$1", [dm])
  ).rows.length;
  await action(a, "block");
  for (const [user, peer] of [
    [a, b],
    [b, a],
  ]) {
    await expect(
      action(user, "request_friend", { user_id: peer }),
    ).rejects.toThrow();
    await expect(action(user, "open_dm", { user_id: peer })).rejects.toThrow();
    await expect(
      action(user, "send_dm", { conversation_id: dm, content: "blocked" }),
    ).rejects.toThrow();
  }
  expect((await as(b, "select * from user_blocks")).rows).toHaveLength(0);
  expect(
    (await as(b, "select * from dm_messages where conversation_id=$1", [dm]))
      .rows,
  ).toHaveLength(before);
  await action(b, "unblock", { user_id: a });
  await expect(action(b, "open_dm", { user_id: a })).rejects.toThrow();
  await action(a, "unblock");
  expect(await action(a, "open_dm")).toBe(dm);
});
it("separates private preference and session liveness, invisible never exposes preference", async () => {
  const session = "44444444-4444-4444-8444-444444444444",
    second = "55555555-5555-4555-8555-555555555555";
  const presence = (action: string, pref: string | null = null) =>
    as(a, "select presence_action($1,$2,$3)", [action, session, pref]);
  await presence("heartbeat");
  expect(
    (
      await as<{ status: string }>(
        b,
        "select status from user_presence where user_id=$1",
        [a],
      )
    ).rows[0].status,
  ).toBe("online");
  await presence("set", "invisible");
  expect(
    (
      await as<{ status: string; expires_at: null }>(
        b,
        "select status,expires_at from user_presence where user_id=$1",
        [a],
      )
    ).rows[0],
  ).toEqual({ status: "offline", expires_at: null });
  await expect(
    as(b, "select * from private.presence_preferences"),
  ).rejects.toThrow();
  await expect(
    as(b, "select * from private.presence_sessions"),
  ).rejects.toThrow();
  await presence("set", "busy");
  await as(a, "select presence_action('heartbeat',$1)", [second]);
  await presence("leave");
  expect(
    (
      await as<{ status: string }>(
        b,
        "select status from user_presence where user_id=$1",
        [a],
      )
    ).rows[0].status,
  ).toBe("busy");
  await as(a, "select presence_action('leave',$1)", [second]);
  expect(
    (
      await as<{ status: string }>(
        b,
        "select status from user_presence where user_id=$1",
        [a],
      )
    ).rows[0].status,
  ).toBe("offline");
  await expect(presence("set", "root")).rejects.toThrow();
});
it("denies anonymous APIs and keeps every public social table under RLS", async () => {
  await pg.exec("set role anon");
  try {
    await expect(
      pg.query("select social_action('open_dm',$1)", [{ user_id: a }]),
    ).rejects.toThrow();
    await expect(pg.query("select * from dm_messages")).rejects.toThrow();
  } finally {
    await pg.exec("reset role");
  }
  expect(
    (
      await pg.query(
        "select relname from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='public' and relkind='r' and not relrowsecurity",
      )
    ).rows,
  ).toHaveLength(0);
});
