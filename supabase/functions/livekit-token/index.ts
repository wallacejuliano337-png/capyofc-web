import { createClient } from "npm:@supabase/supabase-js@2.116.0";
import { AccessToken, TrackSource } from "npm:livekit-server-sdk@2.19.0";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,content-type,apikey,x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
Deno.serve(async (req: Request) => {
  const response = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST")
    return response({ error: "Method not allowed" }, 405);
  try {
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer "))
      return response({ error: "Unauthorized" }, 401);
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false },
      },
    );
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user) return response({ error: "Unauthorized" }, 401);
    const body = await req.text();
    if (body.length > 1024) return response({ error: "Too large" }, 413);
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || !("channelId" in parsed))
      return response({ error: "Invalid room" }, 400);
    const { channelId } = parsed;
    if (
      typeof channelId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        channelId,
      )
    )
      return response({ error: "Invalid room" }, 400);
    const { data: allowed, error: permissionError } = await client.rpc(
      "can_join_voice",
      { channel_id: channelId },
    );
    if (permissionError || allowed !== true)
      return response({ error: "Forbidden" }, 403);
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("display_name,avatar_url")
      .eq("id", user.id)
      .single();
    if (profileError || !profile)
      return response({ error: "Profile unavailable" }, 403);
    const key = Deno.env.get("LIVEKIT_API_KEY"),
      secret = Deno.env.get("LIVEKIT_API_SECRET"),
      url = Deno.env.get("LIVEKIT_URL");
    if (!key || !secret || !url?.startsWith("wss://"))
      return response({ error: "Media service not configured" }, 503);
    const { data: voicePermissions, error: voiceError } = await client.rpc(
      "voice_channel_permissions",
      { channel_id: channelId },
    );
    if (voiceError || voicePermissions?.connect !== true)
      return response({ error: "Forbidden" }, 403);
    const sources = [
      ...(voicePermissions.speak === true ? [TrackSource.MICROPHONE] : []),
      ...(voicePermissions.share_screen === true
        ? [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
        : []),
    ];
    const token = new AccessToken(key, secret, {
      identity: user.id,
      name: profile?.display_name || "Membro",
      metadata: JSON.stringify({ avatar_url: profile.avatar_url || null }),
      ttl: "5m",
    });
    token.addGrant({
      roomJoin: true,
      room: "lyc-" + channelId,
      canPublish: sources.length > 0,
      canSubscribe: true,
      canPublishData: false,
      canPublishSources: sources,
    });
    return response({ token: await token.toJwt(), url });
  } catch {
    return response({ error: "Invalid request or unavailable service" }, 400);
  }
});
