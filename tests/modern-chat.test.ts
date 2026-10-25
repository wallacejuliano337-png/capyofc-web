import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  groupReactions,
  isDifferentDay,
  formatDateSeparator,
} from "../src/features/chat/chat-helpers";
import {
  formatFileSize,
  isImageMime,
  validateFile,
} from "../src/services/attachments";
import type { Reaction } from "../src/types";

describe("Modern Chat Unit & Helper Functions", () => {
  it("formats file sizes correctly in bytes, KB, and MB", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("1.5 KB");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(1048576)).toBe("1 MB");
    expect(formatFileSize(5242880)).toBe("5 MB");
  });

  it("identifies image MIME types properly", () => {
    expect(isImageMime("image/png")).toBe(true);
    expect(isImageMime("image/jpeg")).toBe(true);
    expect(isImageMime("image/webp")).toBe(true);
    expect(isImageMime("image/gif")).toBe(true);
    expect(isImageMime("application/pdf")).toBe(false);
    expect(isImageMime("text/plain")).toBe(false);
    expect(isImageMime("application/octet-stream")).toBe(false);
  });

  it("validates attachments enforcing 10MB limit and allowed MIME types", () => {
    const validFile = new File(["hello world"], "doc.txt", {
      type: "text/plain",
    });
    expect(validateFile(validFile).valid).toBe(true);

    const oversizedFile = new File(
      [new Uint8Array(11 * 1024 * 1024)],
      "huge.pdf",
      { type: "application/pdf" },
    );
    const oversizedCheck = validateFile(oversizedFile);
    expect(oversizedCheck.valid).toBe(false);
    expect(oversizedCheck.error).toContain("excede o limite máximo de 10 MB");

    const invalidTypeFile = new File(["binary"], "program.exe", {
      type: "application/x-msdownload",
    });
    const invalidCheck = validateFile(invalidTypeFile);
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.error).toContain("Formato de arquivo não suportado");
  });

  it("groups multi-emoji reactions with count and reactedByMe flag", () => {
    const reactions: Reaction[] = [
      { message_id: "m1", user_id: "u1", emoji: "🔥" },
      { message_id: "m1", user_id: "u2", emoji: "🔥" },
      { message_id: "m1", user_id: "u3", emoji: "❤️" },
      { message_id: "m1", user_id: "u1", emoji: "custom_pepe" },
    ];

    const groupedForU1 = groupReactions(reactions, "u1");
    expect(groupedForU1).toHaveLength(3);

    const fire = groupedForU1.find((r) => r.emoji === "🔥");
    expect(fire).toBeDefined();
    expect(fire?.count).toBe(2);
    expect(fire?.reactedByMe).toBe(true);

    const heart = groupedForU1.find((r) => r.emoji === "❤️");
    expect(heart).toBeDefined();
    expect(heart?.count).toBe(1);
    expect(heart?.reactedByMe).toBe(false);

    const custom = groupedForU1.find((r) => r.emoji === "custom_pepe");
    expect(custom).toBeDefined();
    expect(custom?.count).toBe(1);
    expect(custom?.reactedByMe).toBe(true);
  });

  it("handles date separators and identifies cross-day boundaries", () => {
    const d1 = "2026-09-26T10:00:00Z";
    const d1Later = "2026-09-26T11:30:00Z";
    const d2 = "2026-09-27T08:00:00Z";

    expect(isDifferentDay(d1, undefined)).toBe(true);
    expect(isDifferentDay(d1Later, d1)).toBe(false);
    expect(isDifferentDay(d2, d1)).toBe(true);

    const todayStr = new Date().toISOString();
    expect(formatDateSeparator(todayStr)).toBe("Hoje");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(formatDateSeparator(yesterday.toISOString())).toBe("Ontem");

    const pastDate = "2026-05-15T12:00:00Z";
    const formatted = formatDateSeparator(pastDate);
    expect(formatted).toContain("maio");
    expect(formatted).toContain("2026");
  });
});

describe("Modern Chat Database, RLS, Replies, Reactions & Attachments", () => {
  let pg: PGlite;
  const userA = "11111111-1111-4111-8111-111111111111"; // Coronel (Owner)
  const userB = "22222222-2222-4222-8222-222222222222"; // Naori (Member)
  const userC = "33333333-3333-4333-8333-333333333333"; // Third party
  let channelId: string;
  let dmConversationId: string;

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

  async function execSocial(
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
    await pg.exec(`
      create role anon;
      create role authenticated;
      alter default privileges in schema public grant all on tables to anon,authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth,public to authenticated;
      grant execute on function auth.uid() to authenticated;
      create schema realtime;
      create table realtime.messages(id bigint, extension text);
      alter table realtime.messages enable row level security;
      create function realtime.topic() returns text language sql stable as $$select current_setting('realtime.topic',true)$$;
      grant usage on schema realtime to authenticated;
      grant select,insert on realtime.messages to authenticated;
      create publication supabase_realtime;
    `);

    // Load migrations in order
    const migrations = [
      "20260920083236_initial_arena",
      "20260920180714_fix_message_reply_reference",
      "20260920231745_communities_permissions",
      "20260921174314_community_administration",
      "20260921180936_social_layer",
      "20260926210000_modern_chat",
    ];

    for (const name of migrations.slice(0, 2)) {
      await pg.exec(readFileSync("supabase/migrations/" + name + ".sql", "utf8"));
    }

    for (const id of [userA, userB, userC]) {
      await pg.query("insert into auth.users(id) values($1)", [id]);
    }

    await pg.query(
      "select set_config('arena.owner_username',(select username from profiles where id=$1),false)",
      [userA],
    );

    for (const name of migrations.slice(2)) {
      await pg.exec(readFileSync("supabase/migrations/" + name + ".sql", "utf8"));
    }

    await pg.exec("grant all on all tables in schema public to authenticated,anon;");

    // Grab a channel for testing
    const ch = (await pg.query<{ id: string }>("select id from channels limit 1")).rows[0];
    channelId = ch.id;

    // Establish friendship between userA and userB to test DMs
    await execSocial(userA, "request_friend", { user_id: userB });
    await execSocial(userB, "accept_friend", { user_id: userA });
    dmConversationId = (await execSocial(userA, "open_dm", { user_id: userB })) as string;
  }, 30000);

  afterAll(async () => {
    await pg?.close();
  });

  describe("Channel Messages: Replies, Editing, Soft Delete & Reactions", () => {
    let msg1Id: string;
    let replyMsgId: string;

    it("creates a message with attachments jsonb and content", async () => {
      const attachments = [
        {
          id: "att-1",
          name: "screenshot.png",
          size: 204800,
          url: "https://example.com/screenshot.png",
          content_type: "image/png",
        },
      ];

      const res = await queryAs<{ id: string }>(
        userA,
        `insert into public.messages (channel_id, author_id, content, attachments)
         values ($1, $2, $3, $4::jsonb)
         returning id`,
        [channelId, userA, "Mensagem inicial com anexo", JSON.stringify(attachments)],
      );
      expect(res.rows).toHaveLength(1);
      msg1Id = res.rows[0].id;

      const loaded = (
        await queryAs<{ content: string; attachments: unknown }>(
          userA,
          "select content, attachments from public.messages where id = $1",
          [msg1Id],
        )
      ).rows[0];
      expect(loaded.content).toBe("Mensagem inicial com anexo");
      expect(Array.isArray(loaded.attachments)).toBe(true);
    });

    it("creates a message replying to an existing message (reply_to)", async () => {
      const res = await queryAs<{ id: string; reply_to: string }>(
        userB,
        `insert into public.messages (channel_id, author_id, content, reply_to)
         values ($1, $2, $3, $4)
         returning id, reply_to`,
        [channelId, userB, "Respondendo sua mensagem!", msg1Id],
      );
      expect(res.rows).toHaveLength(1);
      replyMsgId = res.rows[0].id;
      expect(res.rows[0].reply_to).toBe(msg1Id);
    });

    it("rejects replying to a nonexistent message reference", async () => {
      const fakeId = "00000000-0000-0000-0000-000000000000";
      await expect(
        queryAs(
          userA,
          `insert into public.messages (channel_id, author_id, content, reply_to)
           values ($1, $2, $3, $4)`,
          [channelId, userA, "Referência inválida", fakeId],
        ),
      ).rejects.toThrow();
    });

    it("allows the author to edit their own message", async () => {
      const before = (
        await queryAs<{ created_at: string; edited_at: string | null }>(
          userA,
          "select created_at, edited_at from public.messages where id = $1",
          [msg1Id],
        )
      ).rows[0];

      await queryAs(
        userA,
        `update public.messages
         set content = $1, edited_at = now()
         where id = $2`,
        ["Mensagem inicial atualizada", msg1Id],
      );

      const after = (
        await queryAs<{ content: string; created_at: string; edited_at: string | null }>(
          userA,
          "select content, created_at, edited_at from public.messages where id = $1",
          [msg1Id],
        )
      ).rows[0];

      expect(after.content).toBe("Mensagem inicial atualizada");
      expect(new Date(after.created_at).getTime()).toBe(
        new Date(before.created_at).getTime(),
      );
      expect(after.edited_at).not.toBeNull();
    });

    it("blocks a non-author from editing another user's message", async () => {
      await queryAs(
        userB,
        `update public.messages
         set content = 'Tentativa de alteração não autorizada'
         where id = $1`,
        [msg1Id],
      );

      // Verify content was not modified
      const msg = (
        await queryAs<{ content: string }>(
          userA,
          "select content from public.messages where id = $1",
          [msg1Id],
        )
      ).rows[0];
      expect(msg.content).toBe("Mensagem inicial atualizada");
    });

    it("supports multi-emoji reactions: adding, counting, and removing on toggle", async () => {
      // User A reacts with 🔥
      await queryAs(
        userA,
        `insert into public.message_reactions (message_id, user_id, emoji)
         values ($1, $2, $3)`,
        [msg1Id, userA, "🔥"],
      );

      // User B reacts with same emoji 🔥
      await queryAs(
        userB,
        `insert into public.message_reactions (message_id, user_id, emoji)
         values ($1, $2, $3)`,
        [msg1Id, userB, "🔥"],
      );

      // User A reacts with custom emoji
      await queryAs(
        userA,
        `insert into public.message_reactions (message_id, user_id, emoji)
         values ($1, $2, $3)`,
        [msg1Id, userA, "community_rocket"],
      );

      const reactions = (
        await queryAs<{ emoji: string; user_id: string }>(
          userA,
          "select emoji, user_id from public.message_reactions where message_id = $1 order by emoji",
          [msg1Id],
        )
      ).rows;
      expect(reactions).toHaveLength(3);

      // Duplicate reaction with same emoji by same user is rejected by primary key / unique constraint
      await expect(
        queryAs(
          userA,
          `insert into public.message_reactions (message_id, user_id, emoji)
           values ($1, $2, $3)`,
          [msg1Id, userA, "🔥"],
        ),
      ).rejects.toThrow();

      // User A removes reaction (toggles off)
      await queryAs(
        userA,
        `delete from public.message_reactions where message_id = $1 and user_id = $2 and emoji = $3`,
        [msg1Id, userA, "🔥"],
      );

      const remaining = (
        await queryAs<{ emoji: string }>(
          userA,
          "select emoji from public.message_reactions where message_id = $1",
          [msg1Id],
        )
      ).rows;
      expect(remaining).toHaveLength(2);
      expect(remaining.map((r) => r.emoji)).toContain("community_rocket");
      expect(remaining.map((r) => r.emoji)).toContain("🔥");
    });

    it("soft-deletes message preserving reply tree resilience", async () => {
      // Soft delete msg1
      await queryAs(
        userA,
        `update public.messages
         set content = '', deleted_at = now()
         where id = $1`,
        [msg1Id],
      );

      const deleted = (
        await queryAs<{ content: string; deleted_at: string | null }>(
          userA,
          "select content, deleted_at from public.messages where id = $1",
          [msg1Id],
        )
      ).rows[0];
      expect(deleted.deleted_at).not.toBeNull();
      expect(deleted.content).toBe("");

      // The reply message still references msg1Id and is intact
      const reply = (
        await queryAs<{ id: string; reply_to: string }>(
          userB,
          "select id, reply_to from public.messages where id = $1",
          [replyMsgId],
        )
      ).rows[0];
      expect(reply.reply_to).toBe(msg1Id);
    });
  });

  describe("Direct Messages: Attachments, Replies, Reactions & Isolation", () => {
    let dmMsg1Id: string;
    let dmReplyId: string;

    it("sends DM with attachments and reply reference", async () => {
      const attachments = [
        {
          id: "att-dm-1",
          name: "plan.pdf",
          size: 1048576,
          url: "https://example.com/plan.pdf",
          content_type: "application/pdf",
        },
      ];

      // Send first DM from userA
      await execSocial(userA, "send_dm", {
        conversation_id: dmConversationId,
        content: "Olá Naori, veja o documento anexo!",
        attachments,
      });

      const dms = (
        await queryAs<{ id: string; content: string; attachments: unknown }>(
          userB,
          "select id, content, attachments from public.dm_messages where conversation_id = $1 order by seq",
          [dmConversationId],
        )
      ).rows;
      expect(dms.length).toBeGreaterThan(0);
      dmMsg1Id = dms[0].id;
      expect(dms[0].content).toBe("Olá Naori, veja o documento anexo!");

      // UserB replies to dmMsg1Id
      await execSocial(userB, "send_dm", {
        conversation_id: dmConversationId,
        content: "Recebido com sucesso!",
        reply_to: dmMsg1Id,
      });

      const replies = (
        await queryAs<{ id: string; content: string; reply_to: string }>(
          userA,
          "select id, content, reply_to from public.dm_messages where conversation_id = $1 and reply_to is not null",
          [dmConversationId],
        )
      ).rows;
      expect(replies).toHaveLength(1);
      dmReplyId = replies[0].id;
      expect(replies[0].reply_to).toBe(dmMsg1Id);
    });

    it("supports atomic react_dm toggle in private conversations", async () => {
      // User B reacts with 👍
      await execSocial(userB, "react_dm", {
        conversation_id: dmConversationId,
        message_id: dmMsg1Id,
        emoji: "👍",
      });

      let rx = (
        await queryAs<{ emoji: string; user_id: string }>(
          userA,
          "select emoji, user_id from public.dm_message_reactions where message_id = $1",
          [dmMsg1Id],
        )
      ).rows;
      expect(rx).toHaveLength(1);
      expect(rx[0].emoji).toBe("👍");
      expect(rx[0].user_id).toBe(userB);

      // Clicking 👍 again toggles off (deletes) the reaction
      await execSocial(userB, "react_dm", {
        conversation_id: dmConversationId,
        message_id: dmMsg1Id,
        emoji: "👍",
      });

      rx = (
        await queryAs<{ emoji: string; user_id: string }>(
          userA,
          "select emoji, user_id from public.dm_message_reactions where message_id = $1",
          [dmMsg1Id],
        )
      ).rows;
      expect(rx).toHaveLength(0);
    });

    it("allows author to edit DM and prevents non-author edit", async () => {
      // User A edits their DM
      await execSocial(userA, "edit_dm", {
        conversation_id: dmConversationId,
        message_id: dmMsg1Id,
        content: "Olá Naori, veja o documento anexo! (atualizado)",
      });

      const updated = (
        await queryAs<{ content: string; edited_at: string | null }>(
          userA,
          "select content, edited_at from public.dm_messages where id = $1",
          [dmMsg1Id],
        )
      ).rows[0];
      expect(updated.content).toBe("Olá Naori, veja o documento anexo! (atualizado)");
      expect(updated.edited_at).not.toBeNull();

      // User B attempts to edit User A's DM -> rejected
      await expect(
        execSocial(userB, "edit_dm", {
          conversation_id: dmConversationId,
          message_id: dmMsg1Id,
          content: "Invasão não permitida",
        }),
      ).rejects.toThrow("Somente o autor pode alterar a mensagem");
    });

    it("soft-deletes DM preserving reply reference", async () => {
      // User A deletes dmMsg1Id
      await execSocial(userA, "delete_dm", {
        conversation_id: dmConversationId,
        message_id: dmMsg1Id,
      });

      const deleted = (
        await queryAs<{ content: string; deleted_at: string | null }>(
          userB,
          "select content, deleted_at from public.dm_messages where id = $1",
          [dmMsg1Id],
        )
      ).rows[0];
      expect(deleted.deleted_at).not.toBeNull();
      expect(deleted.content).toBe("");

      // User B's reply still references dmMsg1Id
      const reply = (
        await queryAs<{ reply_to: string }>(
          userA,
          "select reply_to from public.dm_messages where id = $1",
          [dmReplyId],
        )
      ).rows[0];
      expect(reply.reply_to).toBe(dmMsg1Id);
    });

    it("enforces strict privacy isolation: third party user C cannot read DM messages or reactions", async () => {
      // User C attempts to read messages from conversation between A and B
      const cMessages = (
        await queryAs(
          userC,
          "select * from public.dm_messages where conversation_id = $1",
          [dmConversationId],
        )
      ).rows;
      expect(cMessages).toHaveLength(0);

      // User C attempts to read reactions
      const cReactions = (
        await queryAs(
          userC,
          "select * from public.dm_message_reactions where conversation_id = $1",
          [dmConversationId],
        )
      ).rows;
      expect(cReactions).toHaveLength(0);
    });

    it("prevents DM reactions and messages when blocked", async () => {
      // User A blocks user B
      await execSocial(userA, "block", { user_id: userB });

      // User B attempts to react to DM -> rejected
      await expect(
        execSocial(userB, "react_dm", {
          conversation_id: dmConversationId,
          message_id: dmReplyId,
          emoji: "❤️",
        }),
      ).rejects.toThrow("Interação privada indisponível");

      // User B attempts to send DM -> rejected
      await expect(
        execSocial(userB, "send_dm", {
          conversation_id: dmConversationId,
          content: "Tentativa após bloqueio",
        }),
      ).rejects.toThrow("Interação privada indisponível");

      // Unblock
      await execSocial(userA, "unblock", { user_id: userB });
    });
  });
});
