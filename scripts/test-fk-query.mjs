import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

async function testFK() {
  const pg = new PGlite();
  await pg.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS private;
    CREATE TABLE auth.users (id uuid primary key);
    CREATE TABLE public.profiles (id uuid primary key references auth.users(id) on delete cascade);
    CREATE TABLE public.communities (id uuid primary key, owner_id uuid references public.profiles(id));
    CREATE TABLE public.community_members (community_id uuid references public.communities(id), user_id uuid references public.profiles(id));
    CREATE TABLE public.server_templates (id uuid primary key, creator_id uuid references public.profiles(id) on delete cascade);
    CREATE TABLE public.user_presence (user_id uuid primary key references public.profiles(id));
    CREATE TABLE private.presence_preferences (user_id uuid primary key references public.profiles(id));
    CREATE TABLE public.messages (id uuid primary key, author_id uuid references public.profiles(id));
    CREATE TABLE public.friendships (id uuid primary key, user_low uuid references public.profiles(id), user_high uuid references public.profiles(id));
  `);

  const sql = fs.readFileSync('supabase/inspect_foreign_keys.sql', 'utf8');
  const res = await pg.query(sql);
  console.log('FK Query successful! Returned', res.rows.length, 'constraints.');
  for (const r of res.rows) {
    console.log(`[${r.esquema_origem}.${r.tabela_origem}.${r.coluna_origem}] -> [${r.esquema_destino}.${r.tabela_destino}.${r.coluna_destino}] (ON DELETE ${r.regra_on_delete})`);
  }
}

testFK().catch(console.error);
