// Hercules push reminders.
//  POST { action: 'config' }                                   → { publicKey }
//  POST { action: 'register', deviceId, secret, subscription, timezone, reminders }
//  POST { action: 'unregister', deviceId, secret }
//  POST { action: 'test', deviceId, secret }
//  POST { action: 'tick' } + header x-cron-secret               (pg_cron, every minute)
// Devices authenticate with a random per-device secret (only its SHA-256 is stored).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

let cfg: Record<string, string> | null = null;
async function config() {
  if (cfg) return cfg;
  const { data, error } = await db.from("hercules_push_config").select("key,value");
  if (error) throw error;
  cfg = Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  webpush.setVapidDetails(cfg.vapid_subject, cfg.vapid_public, cfg.vapid_private);
  return cfg;
}

async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const PUSH_HOSTS = [/(^|\.)push\.apple\.com$/, /^fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/];

function cleanSubscription(s: any) {
  if (!s || typeof s.endpoint !== "string" || !s.keys?.p256dh || !s.keys?.auth) return null;
  let u: URL;
  try { u = new URL(s.endpoint); } catch { return null; }
  if (u.protocol !== "https:" || !PUSH_HOSTS.some((re) => re.test(u.hostname))) return null;
  return { endpoint: s.endpoint, keys: { p256dh: String(s.keys.p256dh), auth: String(s.keys.auth) } };
}

function cleanReminders(list: any) {
  if (!Array.isArray(list)) return [];
  return list.slice(0, 100).flatMap((r: any) => {
    if (!r || typeof r.id !== "string" || !TIME.test(r.time) || !Array.isArray(r.days)) return [];
    const days = r.days.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6);
    if (!days.length) return [];
    return [{
      id: r.id.slice(0, 40), time: r.time, days,
      title: String(r.title ?? "Hercules").slice(0, 80), body: String(r.body ?? "").slice(0, 160),
      url: typeof r.url === "string" && r.url.startsWith("#/") ? r.url.slice(0, 60) : "#/home",
    }];
  });
}

function validTimeZone(tz: unknown) {
  if (typeof tz !== "string") return "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz; } catch { return "UTC"; }
}

async function authDevice(deviceId: string, secret: string) {
  if (!UUID.test(deviceId ?? "") || typeof secret !== "string" || secret.length < 32 || secret.length > 128) return { error: "bad credentials" };
  const { data } = await db.from("hercules_push_devices").select("*").eq("device_id", deviceId).maybeSingle();
  if (data && data.secret_hash !== await sha256(secret)) return { error: "forbidden" };
  return { row: data };
}

async function send(sub: any, payload: unknown) {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 3600, urgency: "high" });
    return "ok";
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) return "gone";
    console.error("push failed", e?.statusCode, e?.body ?? e?.message);
    return "error";
  }
}

const WD: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
function localNow(tz: string, now: Date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map((p) => [p.type, p.value]));
  return { day: WD[parts.weekday], min: Number(parts.hour) * 60 + Number(parts.minute), date: `${parts.year}-${parts.month}-${parts.day}` };
}

async function tick() {
  const now = new Date();
  const { data: rows, error } = await db.from("hercules_push_devices").select("*");
  if (error) throw error;
  let sent = 0;
  for (const row of rows ?? []) {
    const t = localNow(row.timezone, now);
    const last = { ...(row.last_sent ?? {}) };
    let changed = false, gone = false;
    for (const r of row.reminders ?? []) {
      const [hh, mm] = r.time.split(":").map(Number);
      const diff = t.min - (hh * 60 + mm);
      if (!r.days.includes(t.day) || diff < 0 || diff >= 5 || last[r.id] === t.date) continue;
      const res = await send(row.subscription, { title: r.title, body: r.body, url: r.url, tag: r.id });
      if (res === "gone") { gone = true; break; }
      last[r.id] = t.date; changed = true; if (res === "ok") sent++;
    }
    if (gone) await db.from("hercules_push_devices").delete().eq("device_id", row.device_id);
    else if (changed) await db.from("hercules_push_devices").update({ last_sent: last }).eq("device_id", row.device_id);
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400); }
  try {
    const c = await config();
    switch (body?.action) {
      case "config":
        return json({ publicKey: c.vapid_public });
      case "tick": {
        if (req.headers.get("x-cron-secret") !== c.cron_secret) return json({ error: "forbidden" }, 403);
        return json({ sent: await tick() });
      }
      case "register": {
        const a = await authDevice(body.deviceId, body.secret);
        if (a.error) return json({ error: a.error }, 403);
        const subscription = cleanSubscription(body.subscription);
        if (!subscription) return json({ error: "invalid subscription" }, 400);
        const { error } = await db.from("hercules_push_devices").upsert({
          device_id: body.deviceId, secret_hash: await sha256(body.secret), subscription,
          timezone: validTimeZone(body.timezone), reminders: cleanReminders(body.reminders), updated_at: new Date().toISOString(),
        });
        if (error) throw error;
        return json({ ok: true, reminders: cleanReminders(body.reminders).length });
      }
      case "unregister": {
        const a = await authDevice(body.deviceId, body.secret);
        if (a.error) return json({ error: a.error }, 403);
        await db.from("hercules_push_devices").delete().eq("device_id", body.deviceId);
        return json({ ok: true });
      }
      case "test": {
        const a = await authDevice(body.deviceId, body.secret);
        if (a.error || !a.row) return json({ error: a.error ?? "not registered" }, 403);
        const res = await send(a.row.subscription, { title: "Kratos", body: "Notifications are live. No more excuses.", url: "#/kratos", tag: "test" });
        return json({ ok: res === "ok", result: res });
      }
      default:
        return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: "server error" }, 500);
  }
});
