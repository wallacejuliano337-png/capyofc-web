import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,content-type,apikey,x-client-info,x-webhook-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WebhookBody {
  id?: string;
  token?: string;
  content?: string;
  username?: string;
  avatar_url?: string;
}

Deno.serve(async (req: Request) => {
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...cors,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed. Use POST." }, 405);
  }

  try {
    const url = new URL(req.url);
    const queryId = url.searchParams.get("id");
    const queryToken = url.searchParams.get("token");

    const headerAuth = req.headers.get("Authorization") || "";
    const bearerToken = headerAuth.startsWith("Bearer ")
      ? headerAuth.slice(7).trim()
      : null;
    const headerToken = req.headers.get("x-webhook-token") || bearerToken;

    const rawText = await req.text();
    if (rawText.length > 32768) {
      return jsonResponse({ error: "Payload too large. Limit is 32KB." }, 413);
    }

    let parsed: WebhookBody = {};
    if (rawText.trim().length > 0) {
      try {
        parsed = JSON.parse(rawText) as WebhookBody;
      } catch {
        return jsonResponse({ error: "Invalid JSON payload." }, 400);
      }
    }

    const webhookId = queryId || parsed.id;
    const token = queryToken || headerToken || parsed.token;
    const content = parsed.content;

    if (!webhookId || typeof webhookId !== "string") {
      return jsonResponse(
        { error: "Missing or invalid webhook id." },
        400,
      );
    }

    if (!token || typeof token !== "string" || token.length < 20) {
      return jsonResponse(
        { error: "Missing or invalid webhook token." },
        401,
      );
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return jsonResponse(
        { error: "Missing or empty message content." },
        400,
      );
    }

    if (content.trim().length > 4000) {
      return jsonResponse(
        { error: "Message content exceeds 4000 characters limit." },
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return jsonResponse(
        { error: "Server configuration error: missing Supabase credentials." },
        500,
      );
    }

    const client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await client.rpc("execute_community_webhook", {
      p_webhook_id: webhookId,
      p_token: token,
      p_content: content.trim(),
      p_override_name: parsed.username?.trim() || null,
      p_override_avatar: parsed.avatar_url?.trim() || null,
    });

    if (error) {
      const status =
        error.code === "42501" ? 403 : error.code === "22023" ? 400 : 500;
      return jsonResponse({ error: error.message }, status);
    }

    return jsonResponse(data, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return jsonResponse({ error: msg }, 500);
  }
});
