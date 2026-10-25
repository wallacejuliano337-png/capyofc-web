import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import {
  evaluateNotificationAction,
  type UserNotificationSettings,
} from "../src/services/notifications";

describe("Notifications Pure Rule Evaluator", () => {
  const defaultUserSettings: UserNotificationSettings = {
    user_id: "user-1",
    desktop_enabled: true,
    sounds_enabled: true,
    dms_enabled: true,
    mentions_enabled: true,
    calls_enabled: true,
  };

  it("Rule 1: Never notifies self-sent messages", () => {
    const decision = evaluateNotificationAction({
      type: "channel_message",
      authorId: "user-1",
      currentUserId: "user-1",
      isMention: false,
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: defaultUserSettings,
    });

    expect(decision.shouldShowDesktop).toBe(false);
    expect(decision.shouldPlaySound).toBe(false);
    expect(decision.soundType).toBeNull();
  });

  it("Rule 2: Presence 'busy' (DND) suppresses sounds and desktop notifications", () => {
    const decision = evaluateNotificationAction({
      type: "channel_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isMention: true,
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: defaultUserSettings,
      presenceStatus: "busy",
    });

    expect(decision.shouldShowDesktop).toBe(false);
    expect(decision.shouldPlaySound).toBe(false);
  });

  it("Rule 3: Channel notification level 'nothing' suppresses all alerts", () => {
    const decision = evaluateNotificationAction({
      type: "channel_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isMention: true,
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: defaultUserSettings,
      channelLevel: "nothing",
    });

    expect(decision.shouldShowDesktop).toBe(false);
    expect(decision.shouldPlaySound).toBe(false);
  });

  it("Rule 4: Channel notification level 'mentions' suppresses non-mentions but notifies mentions", () => {
    const nonMention = evaluateNotificationAction({
      type: "channel_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isMention: false,
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: defaultUserSettings,
      channelLevel: "mentions",
    });
    expect(nonMention.shouldShowDesktop).toBe(false);
    expect(nonMention.shouldPlaySound).toBe(false);

    const mention = evaluateNotificationAction({
      type: "channel_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isMention: true,
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: defaultUserSettings,
      channelLevel: "mentions",
    });
    expect(mention.shouldShowDesktop).toBe(true);
    expect(mention.shouldPlaySound).toBe(true);
    expect(mention.soundType).toBe("mention");
  });

  it("Rule 5: When window is focused and user is looking at target, suppresses desktop popup", () => {
    const viewingNormal = evaluateNotificationAction({
      type: "channel_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isMention: false,
      isWindowFocused: true,
      isViewingTarget: true,
      userSettings: defaultUserSettings,
    });
    expect(viewingNormal.shouldShowDesktop).toBe(false);
    expect(viewingNormal.shouldPlaySound).toBe(false);

    const viewingMention = evaluateNotificationAction({
      type: "channel_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isMention: true,
      isWindowFocused: true,
      isViewingTarget: true,
      userSettings: defaultUserSettings,
    });
    expect(viewingMention.shouldShowDesktop).toBe(false);
    expect(viewingMention.shouldPlaySound).toBe(true);
    expect(viewingMention.soundType).toBe("mention");
  });

  it("Rule 6: Respects master switches (desktop_enabled and sounds_enabled)", () => {
    const noDesktop = evaluateNotificationAction({
      type: "channel_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isMention: false,
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: { ...defaultUserSettings, desktop_enabled: false },
    });
    expect(noDesktop.shouldShowDesktop).toBe(false);
    expect(noDesktop.shouldPlaySound).toBe(true);

    const noSound = evaluateNotificationAction({
      type: "channel_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isMention: false,
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: { ...defaultUserSettings, sounds_enabled: false },
    });
    expect(noSound.shouldShowDesktop).toBe(true);
    expect(noSound.shouldPlaySound).toBe(false);
  });

  it("Rule 7: Direct messages respect dms_enabled switch", () => {
    const dmsDisabled = evaluateNotificationAction({
      type: "dm_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: { ...defaultUserSettings, dms_enabled: false },
    });
    expect(dmsDisabled.shouldShowDesktop).toBe(false);
    expect(dmsDisabled.shouldPlaySound).toBe(false);

    const dmsEnabled = evaluateNotificationAction({
      type: "dm_message",
      authorId: "user-2",
      currentUserId: "user-1",
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: defaultUserSettings,
    });
    expect(dmsEnabled.shouldShowDesktop).toBe(true);
    expect(dmsEnabled.shouldPlaySound).toBe(true);
    expect(dmsEnabled.soundType).toBe("message");
  });

  it("Rule 8: Calls respect calls_enabled switch and play call sound", () => {
    const callsEnabled = evaluateNotificationAction({
      type: "call",
      authorId: "user-2",
      currentUserId: "user-1",
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: defaultUserSettings,
    });
    expect(callsEnabled.shouldShowDesktop).toBe(true);
    expect(callsEnabled.shouldPlaySound).toBe(true);
    expect(callsEnabled.soundType).toBe("call");

    const callsDisabled = evaluateNotificationAction({
      type: "call",
      authorId: "user-2",
      currentUserId: "user-1",
      isWindowFocused: false,
      isViewingTarget: false,
      userSettings: { ...defaultUserSettings, calls_enabled: false },
    });
    expect(callsDisabled.shouldShowDesktop).toBe(false);
    expect(callsDisabled.shouldPlaySound).toBe(false);
  });
});

describe("Notifications System Database & RPC Migrations (PGlite)", () => {
  let pg: PGlite;

  beforeAll(async () => {
    pg = new PGlite();

    // Setup postgres roles & auth schema for Supabase emulation
    await pg.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      GRANT USAGE ON SCHEMA auth, public TO authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      CREATE SCHEMA IF NOT EXISTS realtime;
      CREATE TABLE IF NOT EXISTS realtime.messages(id bigint, extension text);
      CREATE OR REPLACE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$
        SELECT current_setting('realtime.topic', true)
      $$;
      GRANT USAGE ON SCHEMA realtime TO authenticated;
      GRANT SELECT, INSERT ON realtime.messages TO authenticated;
      CREATE PUBLICATION supabase_realtime;
    `);

    // Run relevant migrations in sequence
    const migrations = [
      "20260920083236_initial_arena",
      "20260920180714_fix_message_reply_reference",
      "20260920231745_communities_permissions",
      "20260921174314_community_administration",
      "20260921180936_social_layer",
      "20260926210000_modern_chat",
      "20260926220000_notifications_system",
    ];

    for (const name of migrations.slice(0, 2)) {
      await pg.exec(
        readFileSync(join(process.cwd(), "supabase", "migrations", name + ".sql"), "utf-8"),
      );
    }

    const testUser = "11111111-1111-4111-8111-111111111111";
    const peerUser = "22222222-2222-4222-8222-222222222222";
    await pg.query("INSERT INTO auth.users (id) VALUES ($1), ($2)", [
      testUser,
      peerUser,
    ]);
    await pg.query(
      "SELECT set_config('arena.owner_username', (SELECT username FROM profiles WHERE id = $1), false)",
      [testUser],
    );

    for (const name of migrations.slice(2)) {
      await pg.exec(
        readFileSync(join(process.cwd(), "supabase", "migrations", name + ".sql"), "utf-8"),
      );
    }

    await pg.exec(
      "GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon;",
    );
  }, 60000);

  afterAll(async () => {
    await pg.close();
  });

  it("creates and manages user_notification_settings table", async () => {
    const userRes = (
      await pg.query<{ id: string }>("SELECT id FROM public.profiles LIMIT 1")
    ).rows[0];
    const userId = userRes.id;
    await pg.exec(
      `INSERT INTO public.user_notification_settings (user_id, desktop_enabled, sounds_enabled, dms_enabled, mentions_enabled, calls_enabled)
       VALUES ('${userId}', true, true, false, true, true)
       ON CONFLICT (user_id) DO UPDATE SET dms_enabled = EXCLUDED.dms_enabled;`,
    );

    const res = await pg.query<{
      desktop_enabled: boolean;
      dms_enabled: boolean;
    }>(
      `SELECT desktop_enabled, dms_enabled FROM public.user_notification_settings WHERE user_id = '${userId}';`,
    );

    expect(res.rows.length).toBe(1);
    expect(res.rows[0].desktop_enabled).toBe(true);
    expect(res.rows[0].dms_enabled).toBe(false);
  });

  it("stores and updates channel notification overrides", async () => {
    const userRes = (
      await pg.query<{ id: string }>("SELECT id FROM public.profiles LIMIT 1")
    ).rows[0];
    const chanRes = (
      await pg.query<{ id: string }>("SELECT id FROM public.channels LIMIT 1")
    ).rows[0];
    const userId = userRes.id;
    const channelId = chanRes.id;

    await pg.exec(
      `INSERT INTO public.channel_notification_settings (channel_id, user_id, level)
       VALUES ('${channelId}', '${userId}', 'mentions')
       ON CONFLICT (channel_id, user_id) DO UPDATE SET level = EXCLUDED.level;`,
    );

    const res = await pg.query<{ level: string }>(
      `SELECT level FROM public.channel_notification_settings WHERE channel_id = '${channelId}' AND user_id = '${userId}';`,
    );

    expect(res.rows[0].level).toBe("mentions");
  });

  it("tracks channel reads and computes unread count via get_community_unreads", async () => {
    const ownerRes = (
      await pg.query<{ id: string; username: string }>(
        "SELECT id, username FROM public.profiles LIMIT 1",
      )
    ).rows[0];
    const commRes = (
      await pg.query<{ id: string }>("SELECT id FROM public.communities LIMIT 1")
    ).rows[0];
    const chanRes = (
      await pg.query<{ id: string }>("SELECT id FROM public.channels LIMIT 1")
    ).rows[0];

    const userId = ownerRes.id;
    const commId = commRes.id;
    const chanId = chanRes.id;

    // Select an existing peer author or insert with unique username
    const peerRes = (
      await pg.query<{ id: string }>(
        "SELECT id FROM public.profiles WHERE id != $1 LIMIT 1",
        [userId],
      )
    ).rows[0];
    const authorId = peerRes.id;

    // Set session user
    await pg.exec(
      `SELECT set_config('request.jwt.claim.sub', '${userId}', false);`,
    );

    // Mark channel read at an initial timestamp
    await pg.exec(`
      SELECT public.mark_channel_read('${chanId}', NULL);
    `);

    // Insert new messages created after read timestamp
    await pg.exec(`
      INSERT INTO public.messages (channel_id, author_id, content, created_at)
      VALUES 
        ('${chanId}', '${authorId}', 'Primeira mensagem não lida', now() + interval '1 second'),
        ('${chanId}', '${authorId}', 'Segunda mensagem citando @${ownerRes.username}', now() + interval '2 seconds');
    `);

    // Query unreads
    const res = await pg.query<{
      channel_id: string;
      unread_count: number;
      mention_count: number;
    }>(`SELECT * FROM public.get_community_unreads('${commId}');`);

    expect(res.rows.length).toBeGreaterThan(0);
    const targetChan = res.rows.find((r) => r.channel_id === chanId);
    expect(targetChan).toBeDefined();
    expect(Number(targetChan!.unread_count)).toBe(2);
    expect(Number(targetChan!.mention_count)).toBe(1);

    // Call mark_channel_read to consume all unreads
    await pg.exec(`
      SELECT public.mark_channel_read('${chanId}', NULL);
    `);

    // Verify unread count is zeroed
    const resAfter = await pg.query<{
      channel_id: string;
      unread_count: number;
      mention_count: number;
    }>(`SELECT * FROM public.get_community_unreads('${commId}');`);

    const targetChanAfter = resAfter.rows.find((r) => r.channel_id === chanId);
    expect(Number(targetChanAfter!.unread_count)).toBe(0);
    expect(Number(targetChanAfter!.mention_count)).toBe(0);
  });
});
