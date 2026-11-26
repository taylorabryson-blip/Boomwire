// Hercules widget + alarm snapshot relay.
// The app on your phone publishes a small daily snapshot (targets, progress, next session,
// tomorrow's alarms) under a random key only that phone knows. Scriptable widgets and the
// "Hercules Alarms" shortcut read it back with the same key. Only SHA-256(key) is stored.
//
//  POST   { key, data }        → store/replace snapshot
//  DELETE { key }              → remove it
//  GET    ?k=KEY               → snapshot JSON
//  GET    ?k=KEY&f=alarms      → "HH:MM|Label" lines (for Shortcuts → Create Alarm)
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { ...CORS, "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const KEY = /^[A-Za-z0-9_-]{32,64}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    if (req.method === "GET") {
      const u = new URL(req.url);
      const k = u.searchParams.get("k") ?? "";
      if (!KEY.test(k)) return json({ error: "bad key" }, 400);
      const { data, error } = await db.from("hercules_widget_snapshots").select("data,updated_at").eq("key_hash", await sha256(k)).maybeSingle();
      if (error) throw error;
      if (!data) return u.searchParams.get("f") === "alarms" ? text("", 404) : json({ error: "not found" }, 404);
      if (u.searchParams.get("f") === "alarms") {
        const alarms = Array.isArray(data.data?.alarms) ? data.data.alarms : [];
        return text(alarms.filter((a: { time?: string }) => TIME.test(a?.time ?? "")).map((a: { time: string; label?: string }) =>
          `${a.time}|${String(a.label ?? "Hercules").replace(/[|\n\r]/g, " ").slice(0, 40)}`).join("\n"));
      }
      return json({ ...data.data, syncedAt: data.updated_at });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.key !== "string" || !KEY.test(body.key)) return json({ error: "bad key" }, 400);
    const hash = await sha256(body.key);

    if (req.method === "DELETE") {
      await db.from("hercules_widget_snapshots").delete().eq("key_hash", hash);
      return json({ ok: true });
    }
    if (req.method === "POST") {
      const data = body.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) return json({ error: "bad data" }, 400);
      if (JSON.stringify(data).length > 12000) return json({ error: "too large" }, 413);
      const { error } = await db.from("hercules_widget_snapshots").upsert({ key_hash: hash, data, updated_at: new Date().toISOString() });
      if (error) throw error;
      return json({ ok: true });
    }
    return json({ error: "method" }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "server" }, 500);
  }
});
