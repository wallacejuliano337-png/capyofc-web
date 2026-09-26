import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { it, expect } from "vitest";
it("reverses the additive schema without deleting profiles, messages or archived community metadata", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;create schema realtime;create table realtime.messages(id bigint,extension text);alter table realtime.messages enable row level security;create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;grant usage on schema realtime to authenticated;grant select,insert on realtime.messages to authenticated;create publication supabase_realtime;`,
    );
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
    await pg.exec(
      `insert into auth.users(id) values('11111111-1111-4111-8111-111111111111');insert into messages(channel_id,author_id,content) select id,'11111111-1111-4111-8111-111111111111','preserve' from channels where name='geral';select set_config('arena.owner_username',(select username from profiles limit 1),false);`,
    );
    await pg.exec(
      readFileSync(
        "supabase/migrations/20260920231745_communities_permissions.sql",
        "utf8",
      ),
    );
    await pg.exec(
      readFileSync("supabase/rollback/communities_permissions.sql", "utf8"),
    );
    expect((await pg.query("select * from profiles")).rows).toHaveLength(1);
    expect((await pg.query("select * from channels")).rows).toHaveLength(10);
    expect((await pg.query("select * from messages")).rows).toHaveLength(1);
    expect(
      (await pg.query("select * from arena_community_archive.communities"))
        .rows,
    ).toHaveLength(1);
    await pg.exec(
      "set role authenticated;select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false)",
    );
    expect((await pg.query("select * from messages")).rows).toHaveLength(1);
    await expect(
      pg.query("select * from arena_community_archive.communities"),
    ).rejects.toThrow();
  } finally {
    await pg.close();
  }
}, 30000);
