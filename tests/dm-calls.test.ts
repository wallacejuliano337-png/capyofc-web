import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";

let pg: PGlite;
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const c = "33333333-3333-4333-8333-333333333333";
let conversationId: string;

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

async function callAction(
  user: string,
  action: string,
  payload: Record<string, unknown> = {},
) {
  const res = await as<{ v: unknown }>(
    user,
    "select call_action($1,$2) v",
    [action, payload],
  );
  return res.rows[0].v;
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;alter default privileges in schema public grant all on tables to anon,authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;create schema realtime;create table realtime.messages(id bigint,extension text);alter table realtime.messages enable row level security;create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;grant usage on schema realtime to authenticated;grant select,insert on realtime.messages to authenticated;create publication supabase_realtime;`,
  );

  for (const name of [
    "20260920083236_initial_arena",
    "20260920180714_fix_message_reply_reference",
  ]) {
    await pg.exec(readFileSync("supabase/migrations/" + name + ".sql", "utf8"));
  }

  for (const id of [a, b, c]) {
    await pg.query("insert into auth.users(id) values($1)", [id]);
  }

  await pg.query(
    "select set_config('arena.owner_username',(select username from profiles where id=$1),false)",
    [a],
  );

  for (const name of [
    "20260920231745_communities_permissions",
    "20260921174314_community_administration",
    "20260921180936_social_layer",
    "20260926200000_dm_calls",
  ]) {
    await pg.exec(readFileSync("supabase/migrations/" + name + ".sql", "utf8"));
  }

  // Open DM conversation between user a and user b
  conversationId = (
    await as<{ v: string }>(a, "select social_action('open_dm', $1) v", [
      { user_id: b },
    ])
  ).rows[0].v;
}, 30000);

afterAll(async () => {
  await pg?.close();
});

it("starts a call, prevents duplicates in same conversation, and restricts join authorization", async () => {
  // User a starts a voice call to user b
  const call = (await callAction(a, "start_call", {
    conversation_id: conversationId,
    call_type: "voice",
  })) as Record<string, unknown>;

  expect(call.conversation_id).toBe(conversationId);
  expect(call.caller_id).toBe(a);
  expect(call.receiver_id).toBe(b);
  expect(call.status).toBe("calling");
  expect(call.call_type).toBe("voice");

  const callId = call.id as string;

  // Starting another call in the same conversation returns the existing active call (idempotent, prevents duplicate calls)
  const secondCall = (await callAction(a, "start_call", {
    conversation_id: conversationId,
    call_type: "video",
  })) as Record<string, unknown>;
  expect(secondCall.id).toBe(callId);

  // Directly attempting an insert violating the partial unique index throws a duplicate key error
  await expect(
    pg.query(
      "insert into dm_calls(conversation_id, caller_id, receiver_id, call_type, status, room_name) values($1, $2, $3, 'video', 'calling', 'dm-dup')",
      [conversationId, a, b],
    ),
  ).rejects.toThrow(/unique|duplicate/i);

  // Check can_join_dm_call for participants
  const canAJoin = (
    await as<{ v: boolean }>(a, "select can_join_dm_call($1) v", [callId])
  ).rows[0].v;
  const canBJoin = (
    await as<{ v: boolean }>(b, "select can_join_dm_call($1) v", [callId])
  ).rows[0].v;
  const canCJoin = (
    await as<{ v: boolean }>(c, "select can_join_dm_call($1) v", [callId])
  ).rows[0].v;

  expect(canAJoin).toBe(true);
  expect(canBJoin).toBe(true);
  expect(canCJoin).toBe(false);

  // RLS: caller and receiver can select, 3rd party cannot
  const rowsA = await as(a, "select * from dm_calls where id = $1", [callId]);
  const rowsB = await as(b, "select * from dm_calls where id = $1", [callId]);
  const rowsC = await as(c, "select * from dm_calls where id = $1", [callId]);

  expect(rowsA.rows.length).toBe(1);
  expect(rowsB.rows.length).toBe(1);
  expect(rowsC.rows.length).toBe(0);

  // User c cannot answer the call
  await expect(
    callAction(c, "answer_call", { call_id: callId }),
  ).rejects.toThrow(/somente o destinatário pode atender/i);

  // Receiver b answers the call
  const answered = (await callAction(b, "answer_call", {
    call_id: callId,
  })) as Record<string, unknown>;
  expect(answered.status).toBe("connected");
  expect(answered.connected_at).not.toBeNull();

  // get_active_call returns the ongoing call for both participants
  const activeA = (await callAction(a, "get_active_call")) as Record<
    string,
    unknown
  >;
  const activeB = (await callAction(b, "get_active_call")) as Record<
    string,
    unknown
  >;
  const activeC = await callAction(c, "get_active_call");

  expect(activeA?.id).toBe(callId);
  expect(activeB?.id).toBe(callId);
  expect(activeC).toBeNull();

  // End the call
  await callAction(a, "end_call", { call_id: callId });

  const endedCall = (
    await as<{ status: string; duration_seconds: number }>(
      a,
      "select status, duration_seconds from dm_calls where id = $1",
      [callId],
    )
  ).rows[0];

  expect(endedCall.status).toBe("ended");
  expect(endedCall.duration_seconds).toBeGreaterThanOrEqual(0);

  // After ending, no active call remains
  const activeAfterEnd = await callAction(a, "get_active_call");
  expect(activeAfterEnd).toBeNull();
});

it("handles decline_call and miss_call lifecycles", async () => {
  // Test decline
  const declinedCall = (await callAction(a, "start_call", {
    conversation_id: conversationId,
    call_type: "video",
  })) as Record<string, unknown>;

  await callAction(b, "decline_call", { call_id: declinedCall.id });

  const statusAfterDecline = (
    await as<{ status: string }>(
      a,
      "select status from dm_calls where id = $1",
      [declinedCall.id],
    )
  ).rows[0].status;
  expect(statusAfterDecline).toBe("declined");

  // Test miss
  const missedCall = (await callAction(a, "start_call", {
    conversation_id: conversationId,
    call_type: "voice",
  })) as Record<string, unknown>;

  await callAction(a, "miss_call", { call_id: missedCall.id });

  const statusAfterMiss = (
    await as<{ status: string }>(
      a,
      "select status from dm_calls where id = $1",
      [missedCall.id],
    )
  ).rows[0].status;
  expect(statusAfterMiss).toBe("missed");
});
