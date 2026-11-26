/**
 * Web Push client. Talks to the `hercules-push` Supabase Edge Function.
 *
 * iPhone requirements (Apple): iOS/iPadOS 16.4+, Hercules added to the Home
 * Screen, and permission granted from a user tap. Device credentials (a random
 * id + secret) stay on this device in localStorage; only reminder titles/times
 * and the push subscription are sent to the server.
 */
import * as repo from '../storage/repository.js';
import { buildReminders, DEFAULT_REMINDERS } from '../../engines/notifications/schedule.js';

export const PUSH_ENDPOINT = 'https://pwsrrxtugjvnvstzbnps.supabase.co/functions/v1/hercules-push';
export const VAPID_PUBLIC_KEY = 'BLBVhL4zrTsdL-ElRcqGDcq58QEBwfU1uh_UC2cMYksmPXPRo_M8bHru3aEHx65ax2JWnih8yYR8QoGP5wourT0';
const KEY = 'hercules:push-device';

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** What the UI should say about this device's notification capability. */
export function capability() {
  if (isIOS() && !isStandalone()) return { state: 'needs-home-screen', text: 'On iPhone, notifications only work after you add Hercules to your Home Screen (Share → Add to Home Screen), then open it from there.' };
  if (!pushSupported()) return { state: 'unsupported', text: 'This browser doesn’t support push notifications. Calendar reminders still work.' };
  if (Notification.permission === 'denied') return { state: 'denied', text: 'Notifications are blocked. Turn them on in Settings → Notifications → Hercules.' };
  return { state: Notification.permission === 'granted' ? 'granted' : 'prompt', text: '' };
}

function device() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.deviceId && saved?.secret) return saved;
  } catch { /* fallthrough */ }
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const d = { deviceId: crypto.randomUUID(), secret: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''), enabled: false };
  localStorage.setItem(KEY, JSON.stringify(d));
  return d;
}
const saveDevice = (d) => localStorage.setItem(KEY, JSON.stringify(d));
export const pushEnabledHere = () => { try { return !!JSON.parse(localStorage.getItem(KEY) || '{}').enabled; } catch { return false; } };

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function call(body) {
  const res = await fetch(PUSH_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  return data;
}

export async function currentReminders() {
  const [settings, plan] = await Promise.all([repo.getSettings(), repo.get('coach', 'plan')]);
  return buildReminders({ ...DEFAULT_REMINDERS, ...(settings.reminders ?? {}) }, plan);
}

/** Must be called from a tap. Asks permission, subscribes, registers reminders. */
export async function enablePush() {
  const cap = capability();
  if (cap.state === 'needs-home-screen' || cap.state === 'unsupported' || cap.state === 'denied') throw new Error(cap.text);
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('Permission wasn’t granted.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
  const d = device();
  await call({ action: 'register', deviceId: d.deviceId, secret: d.secret, subscription: sub.toJSON(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, reminders: await currentReminders() });
  saveDevice({ ...d, enabled: true });
}

/** Re-send the reminder list (after plan or preference changes). Silent no-op when push is off. */
export async function syncPush() {
  if (!pushEnabledHere() || !pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return false;
    const d = device();
    await call({ action: 'register', deviceId: d.deviceId, secret: d.secret, subscription: sub.toJSON(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, reminders: await currentReminders() });
    return true;
  } catch (e) { console.warn('[push] sync failed', e.message); return false; }
}

export async function disablePush() {
  const d = device();
  try { await call({ action: 'unregister', deviceId: d.deviceId, secret: d.secret }); } catch { /* best effort */ }
  try { const reg = await navigator.serviceWorker.ready; await (await reg.pushManager.getSubscription())?.unsubscribe(); } catch { /* ignore */ }
  saveDevice({ ...d, enabled: false });
}

export async function sendTestPush() {
  const d = device();
  const r = await call({ action: 'test', deviceId: d.deviceId, secret: d.secret });
  if (!r.ok) throw new Error('The push service didn’t accept the test. Try turning notifications off and on.');
}
