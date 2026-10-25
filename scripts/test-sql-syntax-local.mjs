import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

async function testSqlSyntax() {
  const pg = new PGlite();
  await pg.exec(`
    create schema if not exists auth;
    create table auth.users(id uuid primary key);
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade);
    create table public.community_members(community_id uuid, user_id uuid, primary key(community_id, user_id));
    create table public.server_templates(id uuid, creator_id uuid);
    create table public.user_presence(user_id uuid primary key);
    create table public.social_inbox(user_id uuid primary key);
    create table public.messages(id uuid primary key, author_id uuid);
    create table public.friendships(user_low uuid, user_high uuid, requester_id uuid);
    create table public.communities(id uuid primary key, owner_id uuid);
    create schema if not exists private;
    create table private.presence_preferences(user_id uuid primary key);
    create table private.presence_sessions(user_id uuid, session_id uuid);
    create table public.dm_messages(id uuid, author_id uuid);
    create table public.dm_conversations(id uuid, user_low uuid, user_high uuid);
    create table public.channel_members(channel_id uuid, user_id uuid);
  `);

  // Test preview script
  const previewSql = fs.readFileSync('supabase/preview_cleanup_test_accounts.sql', 'utf8');
  const resPreview = await pg.query(previewSql);
  console.log('Preview script syntax valid! Rows returned:', resPreview.rows.length);
  for (const row of resPreview.rows) {
    console.log(` [${row.ordem}] ${row.verificacao}: ${row.quantidade} (${row.status_validacao})`);
  }

  // Insert test users into auth.users and profiles
  const census = JSON.parse(fs.readFileSync('scripts/census_output.json', 'utf8'));
  for (const item of census) {
    await pg.exec(`insert into auth.users(id) values ('${item.id}') on conflict do nothing;`);
    await pg.exec(`insert into public.profiles(id) values ('${item.id}') on conflict do nothing;`);
  }

  // Insert 7 legitimate profiles
  await pg.exec(`
    insert into auth.users(id) values
    ('f8fcd139-cf43-4873-bd7d-a807ecd73567'),
    ('96dde735-f6d8-4aaf-abd7-0176e44888f2'),
    ('7a4901f2-d51f-4747-9c5a-6b3aa716ada6'),
    ('73426b78-425e-486a-abb5-951bf7ca959d'),
    ('89ef8f98-37c5-4199-b598-88c90ae2db6e'),
    ('eda43ba0-44ee-4565-a0e7-bad81800e715'),
    ('33e0a99f-c10b-4057-b23d-85cf5fc13ba9')
    on conflict do nothing;

    insert into public.profiles(id) values
    ('f8fcd139-cf43-4873-bd7d-a807ecd73567'),
    ('96dde735-f6d8-4aaf-abd7-0176e44888f2'),
    ('7a4901f2-d51f-4747-9c5a-6b3aa716ada6'),
    ('73426b78-425e-486a-abb5-951bf7ca959d'),
    ('89ef8f98-37c5-4199-b598-88c90ae2db6e'),
    ('eda43ba0-44ee-4565-a0e7-bad81800e715'),
    ('33e0a99f-c10b-4057-b23d-85cf5fc13ba9')
    on conflict do nothing;
  `);

  // Test execution script guard (PENDENTE must throw)
  const execSql = fs.readFileSync('supabase/cleanup_test_accounts_safe.sql', 'utf8');
  try {
    await pg.exec(execSql);
    console.error('FAIL: Expected execution to be blocked when confirmation is PENDENTE!');
    process.exit(1);
  } catch (err) {
    console.log('\n[PASS] Guard test passed! Blocked execution with message:\n ', err.message);
  }

  // Add official community
  await pg.exec(`
    alter table public.communities add column if not exists is_official boolean default false;
    insert into public.communities(id, owner_id, is_official) values
    ('d84bfdae-1763-4796-9ee8-dc1e7baea4da', 'f8fcd139-cf43-4873-bd7d-a807ecd73567', true);
  `);

  // Test execution script with confirmation enabled
  const confirmedSql = execSql.replace(
    "v_confirmacao text := 'PENDENTE';",
    "v_confirmacao text := 'CONFIRMO_EXCLUSAO_56_CONTAS_TESTE';"
  );
  await pg.exec(confirmedSql);
  console.log('\n[PASS] Execution script syntax and logic 100% valid in PGLite simulation with confirmation!');

  // Test idempotency / re-run prevention (should throw OPERAÇÃO JÁ CONCLUÍDA)
  try {
    await pg.exec(confirmedSql);
    console.error('FAIL: Expected re-run to be blocked when accounts are already deleted!');
    process.exit(1);
  } catch (err) {
    console.log('[PASS] Re-run prevention passed! Blocked duplicate execution with message:\n ', err.message);
  }

  const remaining = await pg.query('select count(*) as count from public.profiles');
  console.log('Remaining profiles in public.profiles:', remaining.rows[0].count, '(expected 7)');
  if (Number(remaining.rows[0].count) !== 7) {
    throw new Error(`Unexpected remaining profiles count: ${remaining.rows[0].count}`);
  }
}

testSqlSyntax().catch(err => {
  console.error(err);
  process.exit(1);
});
