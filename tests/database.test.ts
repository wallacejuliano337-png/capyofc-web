import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
let pg: PGlite;
const member = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  admin = "33333333-3333-4333-8333-333333333333";
let channel: string,
  privateChannel: string,
  team: string,
  ticket: string,
  msg: string;
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
create role anon;create role authenticated;alter default privileges in schema public grant all on tables to anon,authenticated;
create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;
create schema realtime;create table realtime.messages(id bigint,extension text);alter table realtime.messages enable row level security;
create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
grant usage on schema realtime to authenticated;grant select,insert on realtime.messages to authenticated;
create publication supabase_realtime;
`);
  await pg.exec(
    readFileSync(
      "supabase/migrations/20260920083236_initial_arena.sql",
      "utf8",
    ),
  );
  await pg.exec(
    readFileSync(
      "supabase/migrations/20260920180714_fix_message_reply_reference.sql",
      "utf8",
    ),
  );
  for (const id of [member, other, admin])
    await pg.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [id, { display_name: "Tester", role: "OWNER" }],
    );
  await pg.query("update public.profiles set role='ADMIN' where id=$1", [
    admin,
  ]);
  await pg.query(
    "select set_config('arena.owner_username',(select username from profiles where id=$1),false)",
    [admin],
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
  channel = (
    await pg.query<{ id: string }>("select id from channels where name='geral'")
  ).rows[0].id;
  team = (
    await as<{ id: string }>(
      member,
      "select public.create_team('Test Squad','TST') id",
    )
  ).rows[0].id;
  privateChannel = (
    await pg.query<{ id: string }>(
      "select id from channels where team_id=$1 and kind='text'",
      [team],
    )
  ).rows[0].id;
  ticket = (
    await as<{ id: string }>(
      member,
      "insert into tickets(user_id,subject,description,category) values($1,'Ajuda','Descrição','Dúvida') returning id",
      [member],
    )
  ).rows[0].id;
  msg = (
    await as<{ id: string }>(
      member,
      "insert into messages(channel_id,author_id,content) values($1,$2,'Olá') returning id",
      [channel, member],
    )
  ).rows[0].id;
}, 30000);
afterAll(async () => {
  await pg?.close();
});
describe("Supabase migration / real PostgreSQL RLS", () => {
  it("ignores role in signup metadata", async () => {
    const r = await as<{ role: string }>(
      member,
      "select role from profiles where id=$1",
      [member],
    );
    expect(r.rows[0].role).toBe("MEMBER");
  });
  it("blocks self promotion and ownership reassignment", async () => {
    await expect(
      as(member, "update profiles set role='OWNER' where id=$1", [member]),
    ).rejects.toThrow();
    await expect(
      as(member, "update messages set author_id=$1 where id=$2", [other, msg]),
    ).rejects.toThrow();
  });
  it("hides private channels and messages from outsiders", async () => {
    expect(
      (await as(other, "select id from channels where id=$1", [privateChannel]))
        .rows,
    ).toHaveLength(0);
    await expect(
      as(
        other,
        "insert into messages(channel_id,author_id,content) values($1,$2,'invasion')",
        [privateChannel, other],
      ),
    ).rejects.toThrow();
    expect(
      (
        await as(member, "select id from channels where id=$1", [
          privateChannel,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("blocks unauthorized roster changes and self membership", async () => {
    await expect(
      as(
        other,
        "insert into team_members(team_id,user_id,slot) values($1,$2,'PLAYER')",
        [team, other],
      ),
    ).rejects.toThrow();
    await expect(
      as(
        member,
        "insert into team_members(team_id,user_id,slot) values($1,$2,'CAPTAIN')",
        [team, other],
      ),
    ).rejects.toThrow();
  });
  it("allows captain to manage players and grants private access", async () => {
    await as(
      member,
      "insert into team_members(team_id,user_id,slot) values($1,$2,'PLAYER')",
      [team, other],
    );
    expect(
      (await as(other, "select id from channels where id=$1", [privateChannel]))
        .rows,
    ).toHaveLength(1);
    await as(
      member,
      "delete from team_members where team_id=$1 and user_id=$2",
      [team, other],
    );
    expect(
      (await as(other, "select id from channels where id=$1", [privateChannel]))
        .rows,
    ).toHaveLength(0);
  });
  it("blocks impersonation and empty messages", async () => {
    await expect(
      as(
        member,
        "insert into messages(channel_id,author_id,content) values($1,$2,'spoof')",
        [channel, other],
      ),
    ).rejects.toThrow();
    await expect(
      as(
        member,
        "insert into messages(channel_id,author_id,content) values($1,$2,'  ')",
        [channel, member],
      ),
    ).rejects.toThrow();
  });
  it("allows replying to another author in the same channel", async () => {
    const result = await as<{ reply_to: string; author_id: string }>(
      other,
      "insert into messages(channel_id,author_id,content,reply_to) values($1,$2,'Reply',$3) returning reply_to,author_id",
      [channel, other, msg],
    );
    expect(result.rows).toEqual([{ reply_to: msg, author_id: other }]);
  });
  it("rejects replies across channels, to missing messages, and with forged authors", async () => {
    const query =
      "insert into messages(channel_id,author_id,content,reply_to) values($1,$2,'Invalid reply',$3)";
    await expect(
      as(member, query, [privateChannel, member, msg]),
    ).rejects.toThrow();
    await expect(
      as(other, query, [
        channel,
        other,
        "99999999-9999-4999-8999-999999999999",
      ]),
    ).rejects.toThrow();
    await expect(as(other, query, [channel, member, msg])).rejects.toThrow();
  });
  it("allows author editing but not another member", async () => {
    await as(member, "update messages set content='Editada' where id=$1", [
      msg,
    ]);
    await as(other, "update messages set content='Invadida' where id=$1", [
      msg,
    ]);
    expect(
      (
        await as<{ content: string }>(
          member,
          "select content from messages where id=$1",
          [msg],
        )
      ).rows[0].content,
    ).toBe("Editada");
  });
  it("isolates tickets and prevents forged closed tickets", async () => {
    expect(
      (await as(other, "select id from tickets where id=$1", [ticket])).rows,
    ).toHaveLength(0);
    await expect(
      as(
        other,
        "insert into ticket_messages(ticket_id,author_id,content) values($1,$2,'spy')",
        [ticket, other],
      ),
    ).rejects.toThrow();
    await expect(
      as(
        member,
        "insert into tickets(user_id,subject,description,category,status) values($1,'X','X','Dúvida','FECHADO')",
        [member],
      ),
    ).rejects.toThrow();
  });
  it("allows staff closure and records history; rejects replies when closed", async () => {
    await as(
      admin,
      "update tickets set status='FECHADO',assigned_to=$1 where id=$2",
      [admin, ticket],
    );
    const history = await as(
      member,
      "select * from ticket_history where ticket_id=$1",
      [ticket],
    );
    expect(history.rows).toHaveLength(2);
    await expect(
      as(
        member,
        "insert into ticket_messages(ticket_id,author_id,content) values($1,$2,'reply')",
        [ticket, member],
      ),
    ).rejects.toThrow();
  });
  it("restricts voice authorization to voice channels the user may enter", async () => {
    expect(
      (
        await as<{ ok: boolean }>(member, "select can_join_voice($1) ok", [
          channel,
        ])
      ).rows[0].ok,
    ).toBe(false);
    const v = (
      await pg.query<{ id: string }>(
        "select id from channels where team_id=$1 and kind='voice'",
        [team],
      )
    ).rows[0].id;
    expect(
      (await as<{ ok: boolean }>(member, "select can_join_voice($1) ok", [v]))
        .rows[0].ok,
    ).toBe(true);
    expect(
      (await as<{ ok: boolean }>(other, "select can_join_voice($1) ok", [v]))
        .rows[0].ok,
    ).toBe(false);
  });
  it("isolates communities, allows owner channel creation, rejects members and cross-community category moves", async () => {
    const created = await as<{ id: string }>(
      member,
      "select community_action('create',$1) #>> '{}' id",
      [{ name: "Private community" }],
    );
    const cid = created.rows[0].id;
    expect(
      (await as(other, "select id from communities where id=$1", [cid])).rows,
    ).toHaveLength(0);
    const category = (
      await as<{ id: string }>(
        member,
        "select id from channel_categories where community_id=$1",
        [cid],
      )
    ).rows[0].id;
    const payload = {
      community_id: cid,
      name: "new-room",
      category_id: category,
      kind: "text",
    };
    const result = await as<{ id: string }>(
      member,
      "select community_action('create_channel',$1) #>> '{}' id",
      [payload],
    );
    const child = result.rows[0].id;
    await expect(
      as(other, "select community_action('create_channel',$1)", [payload]),
    ).rejects.toThrow();
    await expect(
      as(admin, "select community_action('create_channel',$1)", [payload]),
    ).rejects.toThrow();
    await expect(
      as(
        other,
        "insert into channels(community_id,name,category,category_id,kind) values($1,'attack','',$2,'text')",
        [cid, category],
      ),
    ).rejects.toThrow();
    expect(
      (await as(other, "select id from channels where id=$1", [child])).rows,
    ).toHaveLength(0);
    await expect(
      as(
        member,
        "update channels set community_id=private.official_community() where id=$1",
        [child],
      ),
    ).rejects.toThrow();
    await expect(
      as(
        member,
        "update channels set category_id=(select category_id from channels where id=$1) where id=$2",
        [channel, child],
      ),
    ).rejects.toThrow();
  });
  it("validates invite expiry, limits, idempotent joins, scoped roles and leave", async () => {
    const cid = (
      await as<{ id: string }>(
        member,
        "select community_action('create',$1) #>> '{}' id",
        [{ name: "Invite test" }],
      )
    ).rows[0].id;
    const invite = (
      await as<{ v: { code: string } }>(
        member,
        "select community_action('invite',$1) v",
        [{ community_id: cid, max_uses: 1 }],
      )
    ).rows[0].v;
    await as(other, "select community_action('join',$1)", [
      { code: invite.code },
    ]);
    await as(other, "select community_action('join',$1)", [
      { code: invite.code },
    ]);
    expect(
      (
        await as<{ uses: number }>(
          member,
          "select uses from community_invites where code=$1",
          [invite.code],
        )
      ).rows[0].uses,
    ).toBe(1);
    await expect(
      as(admin, "select community_action('join',$1)", [{ code: invite.code }]),
    ).rejects.toThrow();
    const role = (
      await as<{ id: string }>(
        member,
        "select id from community_roles where community_id=$1 and base_role='ADMIN'",
        [cid],
      )
    ).rows[0].id;
    await expect(
      as(other, "select community_action('assign_role',$1)", [
        { community_id: cid, user_id: other, role_id: role },
      ]),
    ).rejects.toThrow();
    await as(member, "select community_action('assign_role',$1)", [
      { community_id: cid, user_id: other, role_id: role },
    ]);
    expect(
      (
        await as<{ ok: boolean }>(
          other,
          "select private.community_permission($1,'manage_channels') ok",
          [cid],
        )
      ).rows[0].ok,
    ).toBe(true);
    await expect(
      as(member, "select community_action('leave',$1)", [
        { community_id: cid },
      ]),
    ).rejects.toThrow();
    await as(other, "select community_action('leave',$1)", [
      { community_id: cid },
    ]);
    expect(
      (await as(other, "select id from communities where id=$1", [cid])).rows,
    ).toHaveLength(0);
    const expired = (
      await as<{ v: { code: string } }>(
        member,
        "select community_action('invite',$1) v",
        [{ community_id: cid }],
      )
    ).rows[0].v;
    await pg.query(
      "update community_invites set expires_at=now()-interval '1 second' where code=$1",
      [expired.code],
    );
    await expect(
      as(other, "select community_action('join',$1)", [{ code: expired.code }]),
    ).rejects.toThrow();
  });
  it("soft-deletes channels without losing messages or allowing history access", async () => {
    const cid = (
      await as<{ id: string }>(
        admin,
        "select id from communities where is_official",
      )
    ).rows[0].id;
    const category = (
      await as<{ id: string }>(
        admin,
        "select id from channel_categories where community_id=$1 limit 1",
        [cid],
      )
    ).rows[0].id;
    const child = (
      await as<{ id: string }>(
        admin,
        "select community_action('create_channel',$1) #>> '{}' id",
        [
          {
            community_id: cid,
            name: "archive-test",
            category_id: category,
            kind: "text",
          },
        ],
      )
    ).rows[0].id;
    await as(
      other,
      "insert into messages(channel_id,author_id,content) values($1,$2,'keep')",
      [child, other],
    );
    await as(admin, "select community_action('delete_channel',$1)", [
      { community_id: cid, id: child },
    ]);
    expect(
      (await as(other, "select id from messages where channel_id=$1", [child]))
        .rows,
    ).toHaveLength(0);
    expect(
      (await pg.query("select id from messages where channel_id=$1", [child]))
        .rows,
    ).toHaveLength(1);
  });

  it("manages custom roles, permissions and hierarchy without changing global roles", async () => {
    const cid = (
      await as<{ id: string }>(
        admin,
        "select id from communities where is_official",
      )
    ).rows[0].id;
    const call = (
      user: string,
      action: string,
      payload: Record<string, unknown>,
    ) =>
      as<{ v: unknown }>(user, "select community_action($1,$2) v", [
        action,
        { community_id: cid, ...payload },
      ]);
    const make = await call(admin, "create_role", {
      name: "Channel steward",
      position: 20,
      permissions: [
        "manage_channels",
        "manage_roles",
        "send_messages",
        "connect_voice",
        "speak",
        "share_screen",
      ],
    });
    const rid = make.rows[0].v as string;
    await expect(
      call(other, "create_role", {
        name: "Attack",
        position: 10,
        permissions: [],
      }),
    ).rejects.toThrow();
    await call(admin, "assign_role", { user_id: other, role_id: rid });
    expect(
      (
        await as<{ ok: boolean }>(
          other,
          "select private.community_permission($1,'manage_channels') ok",
          [cid],
        )
      ).rows[0].ok,
    ).toBe(true);
    await expect(
      call(other, "edit_role", {
        id: rid,
        name: "Self boost",
        position: 99,
        permissions: ["manage_community"],
      }),
    ).rejects.toThrow();
    await expect(
      call(other, "create_role", {
        name: "Grant escalation",
        position: 10,
        permissions: ["manage_community"],
      }),
    ).rejects.toThrow();
    await expect(
      call(other, "create_role", {
        name: "Priority escalation",
        position: 20,
        permissions: [],
      }),
    ).rejects.toThrow();
    await expect(
      call(other, "assign_role", { user_id: admin, role_id: rid }),
    ).rejects.toThrow();
    const low = (
      await call(other, "create_role", {
        name: "Lower role",
        position: 10,
        permissions: ["send_messages"],
      })
    ).rows[0].v as string;
    await call(other, "assign_role", { user_id: member, role_id: low });
    await expect(
      call(other, "assign_role", { user_id: other, role_id: low }),
    ).rejects.toThrow();
    await expect(
      as(other, "update community_roles set position=99 where id=$1", [low]),
    ).rejects.toThrow();
    await expect(
      as(
        other,
        "insert into community_role_permissions(community_id,role_id,permission) values($1,$2,$3)",
        [cid, low, "manage_community"],
      ),
    ).rejects.toThrow();
    const ownerRole = (
      await pg.query<{ id: string }>(
        "select id from community_roles where community_id=$1 and base_role='OWNER'",
        [cid],
      )
    ).rows[0].id;
    await expect(
      call(admin, "edit_role", {
        id: ownerRole,
        name: "Oops",
        position: 0,
        permissions: [],
      }),
    ).rejects.toThrow();
    await expect(
      call(admin, "delete_role", { id: ownerRole }),
    ).rejects.toThrow();
    await expect(
      call(admin, "assign_role", { user_id: admin, role_id: low }),
    ).rejects.toThrow();
    await expect(
      call(admin, "transfer_ownership", { user_id: other }),
    ).rejects.toThrow();
    await expect(
      call(admin, "create_role", {
        name: "Unknown",
        position: 1,
        permissions: ["root"],
      }),
    ).rejects.toThrow();
    await call(admin, "edit_role", {
      id: low,
      name: "Reader only",
      position: 11,
      permissions: [],
    });
    await expect(
      as(
        member,
        "insert into messages(channel_id,author_id,content) values($1,$2,'denied')",
        [channel, member],
      ),
    ).rejects.toThrow();
    const voice = (
      await pg.query<{ id: string }>(
        "select id from channels where name='lobby'",
      )
    ).rows[0].id;
    expect(
      (
        await as<{ v: { connect: boolean; share_screen: boolean } }>(
          member,
          "select voice_channel_permissions($1) v",
          [voice],
        )
      ).rows[0].v,
    ).toMatchObject({ connect: false, share_screen: false });
    await call(admin, "edit_role", {
      id: low,
      name: "Voice without screen",
      position: 11,
      permissions: ["connect_voice"],
    });
    expect(
      (
        await as<{ v: { connect: boolean; share_screen: boolean } }>(
          member,
          "select voice_channel_permissions($1) v",
          [voice],
        )
      ).rows[0].v,
    ).toMatchObject({ connect: true, share_screen: false });
    await call(admin, "remove_role", { user_id: member, role_id: low });
    await call(admin, "assign_role", { user_id: member, role_id: low });
    await call(admin, "delete_role", { id: low });
    expect(
      (
        await pg.query<{ base_role: string }>(
          "select r.base_role from community_members m join community_roles r on r.id=m.role_id where m.community_id=$1 and m.user_id=$2",
          [cid, member],
        )
      ).rows[0].base_role,
    ).toBe("MEMBER");
    await expect(
      call(admin, "assign_role", { user_id: member, role_id: low }),
    ).rejects.toThrow();
    await call(admin, "remove_role", { user_id: other, role_id: rid });
    await call(admin, "delete_role", { id: rid });
    expect(
      (
        await pg.query<{ role: string }>(
          "select role from profiles where id=$1",
          [other],
        )
      ).rows[0].role,
    ).toBe("MEMBER");
  });
  it("atomically orders categories/channels and denies malformed or cross-community lists", async () => {
    const cid = (
      await as<{ id: string }>(
        admin,
        "select id from communities where is_official",
      )
    ).rows[0].id;
    const call = (
      user: string,
      action: string,
      payload: Record<string, unknown>,
    ) =>
      as(user, "select community_action($1,$2)", [
        action,
        { community_id: cid, ...payload },
      ]);
    const cats = (
      await as<{ id: string }>(
        admin,
        "select id from channel_categories where community_id=$1 and deleted_at is null order by position,id",
        [cid],
      )
    ).rows
      .map((r) => r.id)
      .reverse();
    await call(admin, "reorder_categories", { ids: cats });
    expect(
      (
        await as<{ id: string }>(
          other,
          "select id from channel_categories where community_id=$1 and deleted_at is null order by position,id",
          [cid],
        )
      ).rows.map((r) => r.id),
    ).toEqual(cats);
    await expect(
      call(other, "reorder_categories", { ids: cats }),
    ).rejects.toThrow();
    await expect(
      call(admin, "reorder_categories", { ids: [cats[0], cats[0]] }),
    ).rejects.toThrow();
    await expect(
      call(admin, "reorder_categories", { ids: [] }),
    ).rejects.toThrow();
    const category = (
      await pg.query<{ category_id: string }>(
        "select category_id from channels where id=$1",
        [channel],
      )
    ).rows[0].category_id;
    const ids = (
      await as<{ id: string }>(
        admin,
        "select id from channels where category_id=$1 and deleted_at is null order by position,id",
        [category],
      )
    ).rows
      .map((r) => r.id)
      .reverse();
    await call(admin, "reorder_channels", { ids, category_id: category });
    expect(
      (
        await as<{ id: string }>(
          other,
          "select id from channels where category_id=$1 and deleted_at is null order by position,id",
          [category],
        )
      ).rows.map((r) => r.id),
    ).toEqual(ids);
    await expect(
      call(other, "reorder_channels", { ids, category_id: category }),
    ).rejects.toThrow();
    await expect(
      call(admin, "reorder_channels", {
        ids: [...ids, privateChannel],
        category_id: category,
      }),
    ).rejects.toThrow();
    await expect(
      call(admin, "delete_category", { id: category }),
    ).rejects.toThrow();
  });

  it("enforces mute and ban using database state", async () => {
    await as(
      admin,
      "insert into moderation_actions(user_id,kind,reason) values($1,'MUTE','Test')",
      [member],
    );
    await expect(
      as(
        member,
        "insert into messages(channel_id,author_id,content) values($1,$2,'Muted')",
        [channel, member],
      ),
    ).rejects.toThrow();
    await as(
      admin,
      "insert into moderation_actions(user_id,kind,reason) values($1,'BAN','Test')",
      [member],
    );
    expect((await as(member, "select * from channels")).rows).toHaveLength(0);
  });
  it("denies anonymous data access", async () => {
    await pg.exec("set role anon");
    try {
      await expect(pg.query("select * from profiles")).rejects.toThrow();
    } finally {
      await pg.exec("reset role");
    }
  });
  it("can roll back administration commands without dropping data or RLS", async () => {
    const before = (
      await pg.query<{ n: number }>("select count(*)::int n from messages")
    ).rows[0].n;
    await pg.exec(
      readFileSync("supabase/rollback/community_administration.sql", "utf8"),
    );
    expect(
      (await pg.query<{ n: number }>("select count(*)::int n from messages"))
        .rows[0].n,
    ).toBe(before);
    const cid = (
      await pg.query<{ id: string }>(
        "select id from communities where is_official",
      )
    ).rows[0].id;
    await expect(
      as(admin, "select community_action($1,$2)", [
        "create_role",
        {
          community_id: cid,
          name: "After rollback",
          position: 10,
          permissions: [],
        },
      ]),
    ).rejects.toThrow("Unknown community action");
    expect(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from pg_class where relname='community_roles' and relrowsecurity",
        )
      ).rows[0].n,
    ).toBe(1);
  });
});

