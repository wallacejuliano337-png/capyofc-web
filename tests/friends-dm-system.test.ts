import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  getFriendState,
  friendRequestStatus,
  type Friendship,
} from "../src/services/social";

describe("Friends and Direct Messages System (Unit & Helpers)", () => {
  it("determines friendship states correctly: NONE, PENDING_OUTGOING, PENDING_INCOMING, FRIENDS, BLOCKED", () => {
    const userId = "user-1";
    const peerId = "user-2";

    // NONE
    expect(getFriendState([], userId, peerId)).toBe("NONE");

    // BLOCKED
    expect(getFriendState([], userId, peerId, true)).toBe("BLOCKED");

    // PENDING_OUTGOING (userId sent to peerId)
    const outgoing: Friendship = {
      user_low: "user-1",
      user_high: "user-2",
      requester_id: "user-1",
      state: "pending",
    };
    expect(getFriendState([outgoing], userId, peerId)).toBe("PENDING_OUTGOING");
    expect(friendRequestStatus([outgoing], userId, peerId)).toBe("Solicitação enviada");

    // PENDING_INCOMING (peerId sent to userId)
    const incoming: Friendship = {
      user_low: "user-1",
      user_high: "user-2",
      requester_id: "user-2",
      state: "pending",
    };
    expect(getFriendState([incoming], userId, peerId)).toBe("PENDING_INCOMING");
    expect(friendRequestStatus([incoming], userId, peerId)).toBe("Solicitação recebida");

    // FRIENDS (accepted)
    const accepted: Friendship = {
      user_low: "user-1",
      user_high: "user-2",
      requester_id: "user-1",
      state: "accepted",
    };
    expect(getFriendState([accepted], userId, peerId)).toBe("FRIENDS");
    expect(friendRequestStatus([accepted], userId, peerId)).toBe("Já são amigos");

    // Removed / cancelled / declined relations resolve to NONE
    const removed: Friendship = {
      user_low: "user-1",
      user_high: "user-2",
      requester_id: "user-1",
      state: "removed",
    };
    expect(getFriendState([removed], userId, peerId)).toBe("NONE");
    expect(friendRequestStatus([removed], userId, peerId)).toBeNull();
  });
});

describe("Friends and Direct Messages Mandatory Security & Lifecycle (PostgreSQL RLS & RPC)", () => {
  let pg: PGlite;
  const userA = "11111111-1111-4111-8111-111111111111"; // Coronel
  const userB = "22222222-2222-4222-8222-222222222222"; // Naori
  const userC = "33333333-3333-4333-8333-333333333333"; // Third party / Spy
  let dmConversationId: string;
  let testMessageId: string;

  async function queryAs<T = Record<string, unknown>>(
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

  async function execAction(
    user: string,
    action: string,
    payload: Record<string, unknown>,
  ) {
    return (
      await queryAs<{ v: unknown }>(user, "select social_action($1,$2) v", [
        action,
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
    ]) {
      await pg.exec(readFileSync("supabase/migrations/" + name + ".sql", "utf8"));
    }

    for (const id of [userA, userB, userC]) {
      await pg.query("insert into auth.users(id) values($1)", [id]);
    }

    await pg.query(
      "select set_config('arena.owner_username',(select username from profiles where id=$1),false)",
      [userA],
    );

    for (const name of [
      "20260920231745_communities_permissions",
      "20260921174314_community_administration",
      "20260921180936_social_layer",
    ]) {
      await pg.exec(readFileSync("supabase/migrations/" + name + ".sql", "utf8"));
    }
  }, 30000);

  afterAll(async () => {
    await pg?.close();
  });

  // 1. Impedir auto-solicitação
  it("impede auto-solicitação de amizade", async () => {
    await expect(
      execAction(userA, "request_friend", { user_id: userA }),
    ).rejects.toThrow("Usuário inválido");
  });

  // 2. Enviar solicitação
  it("permite enviar solicitação de amizade para outro usuário", async () => {
    const result = await execAction(userA, "request_friend", { user_id: userB });
    expect(result).toBe(true);

    const fA = (
      await queryAs(userA, "select * from friendships where state='pending'")
    ).rows;
    expect(fA).toHaveLength(1);
    expect(fA[0].requester_id).toBe(userA);

    const fB = (
      await queryAs(userB, "select * from friendships where state='pending'")
    ).rows;
    expect(fB).toHaveLength(1);
    expect(fB[0].requester_id).toBe(userA);
  });

  // 3. Impedir duplicidade de solicitação
  it("impede solicitações duplicadas enquanto houver pendência", async () => {
    await expect(
      execAction(userA, "request_friend", { user_id: userB }),
    ).rejects.toThrow("Já existe amizade ou solicitação pendente");

    await expect(
      execAction(userB, "request_friend", { user_id: userA }),
    ).rejects.toThrow("Já existe amizade ou solicitação pendente");
  });

  // 4. Recusar solicitação
  it("permite ao destinatário recusar a solicitação", async () => {
    await expect(
      execAction(userA, "decline_friend", { user_id: userB }),
    ).rejects.toThrow("Somente o destinatário pode responder");

    await execAction(userB, "decline_friend", { user_id: userA });
    const res = (
      await queryAs(userA, "select * from friendships where state='pending'")
    ).rows;
    expect(res).toHaveLength(0);
  });

  // 5. Aceitar solicitação
  it("permite aceitar solicitação e estabelece amizade bidirecional", async () => {
    await execAction(userA, "request_friend", { user_id: userB });

    await expect(
      execAction(userA, "accept_friend", { user_id: userB }),
    ).rejects.toThrow("Somente o destinatário pode responder");

    await execAction(userB, "accept_friend", { user_id: userA });

    const fA = (
      await queryAs(userA, "select * from friendships where state='accepted'")
    ).rows;
    expect(fA).toHaveLength(1);

    const fB = (
      await queryAs(userB, "select * from friendships where state='accepted'")
    ).rows;
    expect(fB).toHaveLength(1);
  });

  // 6. Remover amizade
  it("permite remover amizade de forma bidirecional sem apagar histórico", async () => {
    await execAction(userA, "remove_friend", { user_id: userB });

    const fA = (
      await queryAs(userA, "select * from friendships where state='accepted'")
    ).rows;
    expect(fA).toHaveLength(0);

    const fB = (
      await queryAs(userB, "select * from friendships where state='accepted'")
    ).rows;
    expect(fB).toHaveLength(0);
  });

  // 7. Bloquear usuário
  it("permite bloquear usuário e encerra amizades ou pendências", async () => {
    await execAction(userA, "request_friend", { user_id: userB });
    await execAction(userB, "accept_friend", { user_id: userA });

    await execAction(userA, "block", { user_id: userB });

    const friends = (
      await queryAs(userA, "select * from friendships where state='accepted'")
    ).rows;
    expect(friends).toHaveLength(0);

    const blocks = (
      await queryAs(userA, "select * from user_blocks where active=true")
    ).rows;
    expect(blocks).toHaveLength(1);
  });

  // 8. Impedir solicitação quando bloqueado
  it("impede envio de novas solicitações quando há bloqueio ativo", async () => {
    await expect(
      execAction(userB, "request_friend", { user_id: userA }),
    ).rejects.toThrow("Interação privada indisponível");

    await expect(
      execAction(userA, "request_friend", { user_id: userB }),
    ).rejects.toThrow("Interação privada indisponível");

    // Desbloquear para continuar os testes de DM
    await execAction(userA, "unblock", { user_id: userB });
  });

  // 9. Criar DM
  it("cria conversa DM 1:1 entre dois usuários", async () => {
    const cid = await execAction(userA, "open_dm", { user_id: userB });
    expect(typeof cid).toBe("string");
    dmConversationId = cid as string;
  });

  // 10. Reutilizar DM existente
  it("reutiliza exatamente a mesma conversa DM para o mesmo par de usuários", async () => {
    const cid2 = await execAction(userB, "open_dm", { user_id: userA });
    expect(cid2).toBe(dmConversationId);

    const totalDMs = (
      await queryAs(userA, "select * from dm_conversations")
    ).rows;
    expect(totalDMs).toHaveLength(1);
  });

  // 11. Enviar mensagem DM
  it("permite enviar mensagem em DM com persistência e sequência", async () => {
    const mid = await execAction(userA, "send_dm", {
      conversation_id: dmConversationId,
      content: "Olá Naori!",
    });
    expect(typeof mid).toBe("string");
    testMessageId = mid as string;

    const msgs = (
      await queryAs<{ content: string; seq: number }>(
        userA,
        "select content, seq from dm_messages where id=$1",
        [testMessageId],
      )
    ).rows;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("Olá Naori!");
    expect(msgs[0].seq).toBe(1);
  });

  // 12. Receber mensagem DM
  it("permite ao destinatário ler e receber a mensagem enviada", async () => {
    const msgs = (
      await queryAs<{ content: string; author_id: string }>(
        userB,
        "select content, author_id from dm_messages where id=$1",
        [testMessageId],
      )
    ).rows;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe("Olá Naori!");
    expect(msgs[0].author_id).toBe(userA);
  });

  // 13. Impedir terceiro de acessar DM
  it("impede estritamente usuário terceiro de visualizar ou enviar mensagens na DM de terceiros", async () => {
    const conversationsForC = (
      await queryAs(userC, "select * from dm_conversations")
    ).rows;
    expect(conversationsForC).toHaveLength(0);

    const messagesForC = (
      await queryAs(
        userC,
        "select * from dm_messages where conversation_id=$1",
        [dmConversationId],
      )
    ).rows;
    expect(messagesForC).toHaveLength(0);

    await expect(
      execAction(userC, "send_dm", {
        conversation_id: dmConversationId,
        content: "invasão",
      }),
    ).rejects.toThrow("Private conversation access denied");
  });

  // 14. Contador de não lidas e marcação como lida
  it("calcula contador de não lidas e zera ao marcar como lida", async () => {
    const inboxBefore = (
      await queryAs<{ unread_count: number }>(
        userB,
        "select * from dm_inbox() where id=$1",
        [dmConversationId],
      )
    ).rows[0];
    expect(Number(inboxBefore.unread_count)).toBe(1);

    await execAction(userB, "read_dm", {
      conversation_id: dmConversationId,
      through_seq: 1,
    });

    const inboxAfter = (
      await queryAs<{ unread_count: number }>(
        userB,
        "select * from dm_inbox() where id=$1",
        [dmConversationId],
      )
    ).rows[0];
    expect(Number(inboxAfter.unread_count)).toBe(0);
  });
});
