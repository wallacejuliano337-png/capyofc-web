import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";

let pg: PGlite;
const owner = "11111111-1111-4111-8111-111111111111";
const mod = "22222222-2222-4222-8222-222222222222";
const regularMember = "33333333-3333-4333-8333-333333333333";
const targetMember = "44444444-4444-4444-8444-444444444444";

let communityId: string;

async function as<T>(id: string, query: string, params: unknown[] = []) {
  await pg.exec("set role authenticated");
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  try {
    return await pg.query<T>(query, params);
  } finally {
    await pg.exec("reset role");
  }
}

function call(
  user: string,
  action: string,
  payload: Record<string, unknown>,
) {
  return as<{ v: unknown }>(user, "select community_action($1,$2) v", [
    action,
    { community_id: communityId, ...payload },
  ]);
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
    readFileSync("supabase/migrations/20260920083236_initial_arena.sql", "utf8"),
  );
  await pg.exec(
    readFileSync(
      "supabase/migrations/20260920180714_fix_message_reply_reference.sql",
      "utf8",
    ),
  );

  for (const id of [owner, mod, regularMember, targetMember]) {
    await pg.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [id, { display_name: "User_" + id.slice(0, 4) }],
    );
  }

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

  // Apply our new Roles & Permissions Migration
  await pg.exec(
    readFileSync(
      "supabase/migrations/20260930180000_community_roles_system.sql",
      "utf8",
    ),
  );

  communityId = (
    await as<{ id: string }>(
      owner,
      "select id from communities where is_official",
    )
  ).rows[0].id;
}, 30000);

afterAll(async () => {
  await pg?.close();
});

describe("LYC Arena - Sistema Real de Cargos e Permissões (Fase 1)", () => {
  it("verifica se o cargo @todos existe, está na base (posição 0) e possui permissões padrão", async () => {
    const roles = (
      await pg.query<{
        id: string;
        name: string;
        position: number;
        is_default: boolean;
        color: string;
      }>(
        "select id, name, position, is_default, color from community_roles where community_id = $1 and (is_default or name = '@todos')",
        [communityId],
      )
    ).rows;

    expect(roles.length).toBeGreaterThan(0);
    const everyone = roles[0];
    expect(everyone.name).toBe("@todos");
    expect(everyone.position).toBe(0);
    expect(everyone.is_default).toBe(true);
    expect(everyone.color).toBe("#99aab5");

    // Verificar se não pode ser excluído
    await expect(
      call(owner, "delete_role", { id: everyone.id }),
    ).rejects.toThrow(/cargos padrão não podem ser excluídos/i);

    // Verificar se não pode ter a posição alterada
    await expect(
      call(owner, "edit_role", { id: everyone.id, position: 10 }),
    ).rejects.toThrow();
  });

  it("permite ao OWNER criar cargo com nome, cor personalizada e permissões granulares", async () => {
    const res = await call(owner, "create_role", {
      name: "Super Mod",
      color: "#ff007f",
      position: 70,
      permissions: [
        "view_channels",
        "manage_roles",
        "kick_members",
        "ban_members",
        "send_messages",
        "embed_links",
      ],
    });

    const superModId = res.rows[0].v as string;
    expect(superModId).toBeDefined();

    const roleRow = (
      await pg.query<{ name: string; color: string; position: number }>(
        "select name, color, position from community_roles where id = $1",
        [superModId],
      )
    ).rows[0];

    expect(roleRow.name).toBe("Super Mod");
    expect(roleRow.color).toBe("#ff007f");
    expect(roleRow.position).toBe(70);

    const perms = (
      await pg.query<{ permission: string }>(
        "select permission from community_role_permissions where role_id = $1 order by permission",
        [superModId],
      )
    ).rows.map((r) => r.permission);

    expect(perms).toContain("manage_roles");
    expect(perms).toContain("kick_members");
    expect(perms).toContain("ban_members");
    expect(perms).toContain("embed_links");
  });

  it("permite ao OWNER atribuir múltiplos cargos ao membro", async () => {
    // Criar dois cargos
    const r1 = (
      await call(owner, "create_role", {
        name: "VIP",
        color: "#f1c40f",
        position: 30,
        permissions: ["embed_links", "attach_files"],
      })
    ).rows[0].v as string;

    const r2 = (
      await call(owner, "create_role", {
        name: "Streamer",
        color: "#9b59b6",
        position: 40,
        permissions: ["video", "share_screen"],
      })
    ).rows[0].v as string;

    // Atribuir VIP e Streamer para targetMember
    await call(owner, "add_member_role", { user_id: targetMember, role_id: r1 });
    await call(owner, "add_member_role", { user_id: targetMember, role_id: r2 });

    // Verificar se ambos estão em community_member_roles
    const assigned = (
      await pg.query<{ role_id: string }>(
        "select role_id from community_member_roles where community_id = $1 and user_id = $2 order by role_id",
        [communityId, targetMember],
      )
    ).rows.map((r) => r.role_id);

    expect(assigned).toContain(r1);
    expect(assigned).toContain(r2);

    // O role_id primário do membro deve refletir o cargo de maior hierarquia (Streamer, pos 40)
    const primary = (
      await pg.query<{ role_id: string }>(
        "select role_id from community_members where community_id = $1 and user_id = $2",
        [communityId, targetMember],
      )
    ).rows[0].role_id;

    expect(primary).toBe(r2);

    // Testar cálculo de permissões efetivas no backend
    expect(
      (
        await as<{ ok: boolean }>(
          targetMember,
          "select private.community_permission($1, 'embed_links') ok",
          [communityId],
        )
      ).rows[0].ok,
    ).toBe(true);

    expect(
      (
        await as<{ ok: boolean }>(
          targetMember,
          "select private.community_permission($1, 'share_screen') ok",
          [communityId],
        )
      ).rows[0].ok,
    ).toBe(true);

    // Remover um dos cargos
    await call(owner, "remove_member_role", { user_id: targetMember, role_id: r2 });

    const remaining = (
      await pg.query<{ role_id: string }>(
        "select role_id from community_member_roles where community_id = $1 and user_id = $2",
        [communityId, targetMember],
      )
    ).rows.map((r) => r.role_id);

    expect(remaining).toContain(r1);
    expect(remaining).not.toContain(r2);

    // Agora o role_id primário deve ter caído para VIP (pos 30)
    const newPrimary = (
      await pg.query<{ role_id: string }>(
        "select role_id from community_members where community_id = $1 and user_id = $2",
        [communityId, targetMember],
      )
    ).rows[0].role_id;
    expect(newPrimary).toBe(r1);
  });

  it("MEMBRO NORMAL é bloqueado pelo backend ao tentar criar/editar/atribuir cargos ou auto-promoção", async () => {
    // Tentativa de criar cargo
    await expect(
      call(regularMember, "create_role", {
        name: "Hacker Role",
        color: "#ff0000",
        position: 10,
        permissions: ["manage_roles"],
      }),
    ).rejects.toThrow();

    // Tentativa de alteração direta via SQL / RLS
    await expect(
      as(
        regularMember,
        "insert into community_roles(community_id, name, position) values($1, 'Direct Insert', 50)",
        [communityId],
      ),
    ).rejects.toThrow();

    // Tentativa de atribuir cargo a si mesmo
    const adminRoleId = (
      await pg.query<{ id: string }>(
        "select id from community_roles where community_id = $1 and base_role = 'ADMIN'",
        [communityId],
      )
    ).rows[0].id;

    await expect(
      call(regularMember, "assign_role", {
        user_id: regularMember,
        role_id: adminRoleId,
      }),
    ).rejects.toThrow();
  });

  it("GERENCIAR CARGOS: moderador só gerencia cargos estritamente abaixo do seu maior cargo", async () => {
    // Criar cargo para o moderador (posição 60)
    const modRoleId = (
      await call(owner, "create_role", {
        name: "Staff Level 1",
        color: "#3498db",
        position: 60,
        permissions: ["manage_roles", "kick_members", "send_messages", "view_channels"],
      })
    ).rows[0].v as string;

    await call(owner, "add_member_role", { user_id: mod, role_id: modRoleId });

    // Mod cria cargo inferior (posição 45) -> deve conseguir
    const lowerRoleId = (
      await call(mod, "create_role", {
        name: "Junior Helper",
        color: "#2ecc71",
        position: 45,
        permissions: ["send_messages", "view_channels"],
      })
    ).rows[0].v as string;

    expect(lowerRoleId).toBeDefined();

    // Mod tenta criar cargo com posição >= 60 -> deve falhar
    await expect(
      call(mod, "create_role", {
        name: "Equal Helper",
        color: "#2ecc71",
        position: 60,
        permissions: ["send_messages"],
      }),
    ).rejects.toThrow(/role hierarchy denied/i);

    // Mod tenta conceder permissão que ele não tem (ex: administrator ou manage_community) -> deve falhar
    await expect(
      call(mod, "create_role", {
        name: "Admin Helper",
        color: "#2ecc71",
        position: 40,
        permissions: ["administrator"],
      }),
    ).rejects.toThrow(/cannot grant permissions you do not have/i);

    // Mod tenta editar cargo superior ao seu -> deve falhar
    const higherRoleId = (
      await pg.query<{ id: string }>(
        "select id from community_roles where community_id = $1 and base_role = 'ADMIN'",
        [communityId],
      )
    ).rows[0].id;

    await expect(
      call(mod, "edit_role", {
        id: higherRoleId,
        name: "Compromised Admin",
      }),
    ).rejects.toThrow(/role hierarchy denied/i);

    // Mod atribui cargo inferior a outro membro -> deve conseguir
    await call(mod, "assign_role", { user_id: targetMember, role_id: lowerRoleId });

    // Mod tenta atribuir cargo a si mesmo -> deve falhar
    await expect(
      call(mod, "assign_role", { user_id: mod, role_id: lowerRoleId }),
    ).rejects.toThrow(/protected member/i);

    // Mod tenta excluir cargo inferior -> deve conseguir
    await call(mod, "delete_role", { id: lowerRoleId });
  });

  it("REORDENAÇÃO: permite reordenar cargos respeitando a hierarquia", async () => {
    const rA = (
      await call(owner, "create_role", {
        name: "Role A",
        position: 10,
        permissions: ["send_messages"],
      })
    ).rows[0].v as string;

    const rB = (
      await call(owner, "create_role", {
        name: "Role B",
        position: 20,
        permissions: ["send_messages"],
      })
    ).rows[0].v as string;

    // Owner inverte a ordem: [rA, rB]
    await call(owner, "reorder_roles", { ids: [rA, rB] });

    const posA = (
      await pg.query<{ position: number }>(
        "select position from community_roles where id = $1",
        [rA],
      )
    ).rows[0].position;

    const posB = (
      await pg.query<{ position: number }>(
        "select position from community_roles where id = $1",
        [rB],
      )
    ).rows[0].position;

    // rA estava em primeiro na lista, logo sua posição é maior que a de rB
    expect(posA).toBeGreaterThan(posB);
  });
});
