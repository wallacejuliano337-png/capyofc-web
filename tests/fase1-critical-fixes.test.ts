import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";

let pg: PGlite;
const owner = "11111111-1111-4111-8111-111111111111";
const mod = "22222222-2222-4222-8222-222222222222";
const userToBan = "33333333-3333-4333-8333-333333333333";
const userToKick = "44444444-4444-4444-8444-444444444444";

let communityId: string;
let inviteCode: string;

async function as<T>(id: string, query: string, params: unknown[] = []) {
  await pg.exec("set role authenticated");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  try {
    return await pg.query<T>(query, params);
  } finally {
    await pg.exec("reset role");
  }
}

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(`
    create role anon;
    create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth, public to authenticated;
    grant execute on function auth.uid() to authenticated;
    create schema realtime;
    create table realtime.messages(id bigint, extension text);
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
    grant usage on schema realtime to authenticated;
    grant select, insert on realtime.messages to authenticated;
    create publication supabase_realtime;
  `);

  await pg.exec(
    readFileSync("supabase/migrations/20260920083236_initial_arena.sql", "utf8"),
  );
  await pg.exec(
    readFileSync(
      "supabase/migrations/20260920180714_fix_message_reply_reference.sql",
      "utf8",
    ),
  );

  for (const id of [owner, mod, userToBan, userToKick]) {
    await pg.query(
      "insert into auth.users(id, raw_user_meta_data) values($1, $2)",
      [id, { display_name: "User " + id.slice(0, 4) }],
    );
  }

  await pg.query("update public.profiles set role='ADMIN' where id=$1", [
    owner,
  ]);
  await pg.query(
    "select set_config('arena.owner_username',(select username from profiles where id=$1),false)",
    [owner],
  );

  await pg.exec(
    readFileSync(
      "supabase/migrations/20260920231745_communities_permissions.sql",
      "utf8",
    ),
  );
  await pg.exec(
    readFileSync(
      "supabase/migrations/20260921174314_community_administration.sql",
      "utf8",
    ),
  );
  await pg.exec(
    readFileSync(
      "supabase/migrations/20260926230000_fase1_critical_fixes.sql",
      "utf8",
    ),
  );

  // Create a community as owner
  await as(
    owner,
    "select private.community_command('create', '{\"name\":\"Arena Alpha\"}'::jsonb)",
  );
  communityId = (
    await pg.query<{ id: string }>(
      "select id from public.communities where name = 'Arena Alpha'",
    )
  ).rows[0].id;

  // Create an invite code as owner
  await as(
    owner,
    "select private.community_command('invite', $1::jsonb)",
    [
      JSON.stringify({
        community_id: communityId,
        expires_at: new Date(Date.now() + 86400000).toISOString(),
        max_uses: 100,
      }),
    ],
  );
  inviteCode = (
    await pg.query<{ code: string }>(
      "select code from public.community_invites where community_id = $1",
      [communityId],
    )
  ).rows[0].code;

  // mod, userToBan, and userToKick join via invite
  for (const uid of [mod, userToBan, userToKick]) {
    await as(
      uid,
      "select private.community_command('join', $1::jsonb)",
      [JSON.stringify({ code: inviteCode })],
    );
  }

  // Create MODERATOR role and assign to mod
  await as(
    owner,
    "select private.community_command('create_role', $1::jsonb)",
    [
      JSON.stringify({
        community_id: communityId,
        name: "Moderator",
        color: "#00ff00",
        permissions: ["moderate_members", "view_audit_log"],
      }),
    ],
  );
  const modRoleId = (
    await pg.query<{ id: string }>(
      "select id from public.community_roles where community_id = $1 and name = 'Moderator'",
      [communityId],
    )
  ).rows[0].id;

  await as(
    owner,
    "select private.community_command('assign_role', $1::jsonb)",
    [
      JSON.stringify({
        community_id: communityId,
        user_id: mod,
        id: modRoleId,
      }),
    ],
  );
}, 30000);

afterAll(async () => {
  await pg?.close();
});

describe("Fase 1 — Critical Fixes & Infrastructure", () => {
  it("enforces database schema columns on public.communities", async () => {
    const res = await pg.query<{
      column_name: string;
      data_type: string;
    }>(
      `select column_name, data_type from information_schema.columns 
       where table_name = 'communities' and column_name in ('tag', 'verification_level', 'content_filter')`,
    );
    const cols = res.rows.map((r) => r.column_name);
    expect(cols).toContain("tag");
    expect(cols).toContain("verification_level");
    expect(cols).toContain("content_filter");
  });

  it("persists tag, verification_level, and content_filter via edit_community RPC", async () => {
    await as(
      owner,
      "select private.community_command('edit_community', $1::jsonb)",
      [
        JSON.stringify({
          community_id: communityId,
          tag: "ALPH",
          verification_level: "high",
          content_filter: "all",
        }),
      ],
    );

    const commRes = await pg.query<{
      tag: string;
      verification_level: string;
      content_filter: string;
    }>("select tag, verification_level, content_filter from public.communities where id = $1", [
      communityId,
    ]);

    expect(commRes.rows[0].tag).toBe("ALPH");
    expect(commRes.rows[0].verification_level).toBe("high");
    expect(commRes.rows[0].content_filter).toBe("all");
  });

  it("prevents non-privileged members from editing community safety or tag", async () => {
    await expect(
      as(
        userToBan,
        "select private.community_command('edit_community', $1::jsonb)",
        [
          JSON.stringify({
            community_id: communityId,
            tag: "HACK",
          }),
        ],
      ),
    ).rejects.toThrow();
  });

  it("bans member, records in community_bans, and removes from community_members", async () => {
    // mod bans userToBan
    await as(
      mod,
      "select private.community_command('ban_member', $1::jsonb)",
      [
        JSON.stringify({
          community_id: communityId,
          user_id: userToBan,
          reason: "Spam no canal geral",
        }),
      ],
    );

    // Verify ban in community_bans
    const banRows = await pg.query<{
      community_id: string;
      user_id: string;
      banned_by: string;
      reason: string;
    }>(
      "select community_id, user_id, banned_by, reason from public.community_bans where community_id = $1 and user_id = $2",
      [communityId, userToBan],
    );
    expect(banRows.rows).toHaveLength(1);
    expect(banRows.rows[0].banned_by).toBe(mod);
    expect(banRows.rows[0].reason).toBe("Spam no canal geral");

    // Verify removed from community_members
    const memRows = await pg.query<{ left_at: string | null }>(
      "select left_at from public.community_members where community_id = $1 and user_id = $2",
      [communityId, userToBan],
    );
    expect(memRows.rows[0].left_at).not.toBeNull();
  });

  it("is_community_member immediately returns false for banned user", async () => {
    const checkRes = await as<{ is_member: boolean }>(
      userToBan,
      "select private.is_community_member($1) as is_member",
      [communityId],
    );
    expect(checkRes.rows[0].is_member).toBe(false);
  });

  it("prevents banned user from re-joining the community via invite", async () => {
    await expect(
      as(
        userToBan,
        "select private.community_command('join', $1::jsonb)",
        [JSON.stringify({ code: inviteCode })],
      ),
    ).rejects.toThrow(/banido/i);
  });

  it("protects owner from being banned by moderators", async () => {
    await expect(
      as(
        mod,
        "select private.community_command('ban_member', $1::jsonb)",
        [
          JSON.stringify({
            community_id: communityId,
            user_id: owner,
            reason: "Trying to ban owner",
          }),
        ],
      ),
    ).rejects.toThrow();
  });

  it("kicks member: removes membership without inserting a ban record", async () => {
    await as(
      mod,
      "select private.community_command('kick_member', $1::jsonb)",
      [
        JSON.stringify({
          community_id: communityId,
          user_id: userToKick,
          reason: "Inatividade",
        }),
      ],
    );

    // Verify member is kicked (left_at is not null)
    const memRows = await pg.query<{ left_at: string | null }>(
      "select left_at from public.community_members where community_id = $1 and user_id = $2",
      [communityId, userToKick],
    );
    expect(memRows.rows[0].left_at).not.toBeNull();

    // Verify userToKick is NOT banned
    const banRows = await pg.query(
      "select 1 from public.community_bans where community_id = $1 and user_id = $2",
      [communityId, userToKick],
    );
    expect(banRows.rows).toHaveLength(0);

    // User is able to re-join since they are not banned
    await as(
      userToKick,
      "select private.community_command('join', $1::jsonb)",
      [JSON.stringify({ code: inviteCode })],
    );
    const rejoinRows = await pg.query<{ left_at: string | null }>(
      "select left_at from public.community_members where community_id = $1 and user_id = $2",
      [communityId, userToKick],
    );
    expect(rejoinRows.rows[0].left_at).toBeNull();
  });

  it("unbans member and allows them to re-join with invite", async () => {
    // mod unbans userToBan
    await as(
      mod,
      "select private.community_command('unban_member', $1::jsonb)",
      [
        JSON.stringify({
          community_id: communityId,
          user_id: userToBan,
        }),
      ],
    );

    // Verify ban record deleted
    const banRows = await pg.query(
      "select 1 from public.community_bans where community_id = $1 and user_id = $2",
      [communityId, userToBan],
    );
    expect(banRows.rows).toHaveLength(0);

    // Now userToBan can re-join
    await as(
      userToBan,
      "select private.community_command('join', $1::jsonb)",
      [JSON.stringify({ code: inviteCode })],
    );

    const memRows = await pg.query<{ left_at: string | null }>(
      "select left_at from public.community_members where community_id = $1 and user_id = $2",
      [communityId, userToBan],
    );
    expect(memRows.rows[0].left_at).toBeNull();
  });

  it("stores and selects audit logs with RLS enforcement", async () => {
    // Insert an audit log entry
    await as(
      mod,
      `insert into public.community_audit_logs(community_id, actor_id, action_type, target_type, target_id, target_name, metadata)
       values($1, $2, 'member_kick', 'member', $3, 'KickedUser', '{"reason":"Test kick"}'::jsonb)`,
      [communityId, mod, userToKick],
    );

    // Mod (with moderate_members permission) can view logs
    const modViewRes = await as<{ action_type: string }>(
      mod,
      "select action_type from public.community_audit_logs where community_id = $1",
      [communityId],
    );
    expect(modViewRes.rows.length).toBeGreaterThan(0);
    expect(modViewRes.rows[0].action_type).toBe("member_kick");
  });
});
