/**
 * Cratos persistence: availability + plan singletons in the `coach` store,
 * chat history in `coachMessages`.
 */
import * as repo from './storage/repository.js';
import { respond, GREETING } from '../engines/coach/kratos.js';
import { planWeek, dietPlan, DEFAULT_AVAILABILITY } from '../engines/coach/planner.js';
import { moveSession, skipSession as skipEngine, applyPins } from '../engines/coach/reschedule.js';
import { localDateKey } from '../utils/dates.js';
import { activeTargets } from './nutrition/log.js';
import { registerCustomGear } from '../data/exercises/gear.js';

const serializePlan = (plan) => ({
  ...plan,
  nutrition: { ...plan.nutrition, startDate: !plan.nutrition.startDate ? null : typeof plan.nutrition.startDate === 'string' ? plan.nutrition.startDate : localDateKey(plan.nutrition.startDate) },
});

export const getAvailability = () => repo.get('coach', 'availability');
/** The plan, with any "this week only" changes rolled back once that week has ended. */
export async function getPlan() {
  const plan = await repo.get('coach', 'plan');
  if (plan?.base && plan.baseUntil && localDateKey() > plan.baseUntil) {
    const { base, ...rest } = plan;
    const restored = { ...rest, ...base, base: null, baseUntil: null };
    await savePlan(restored);
    return restored;
  }
  return plan;
}

export async function saveAvailability(av) {
  return repo.upsertSingleton('coach', 'availability', { ...av, kind: 'availability' });
}
export async function savePlan(plan) {
  return repo.upsertSingleton('coach', 'plan', { base: null, baseUntil: null, pins: null, ...serializePlan(plan), kind: 'plan' });
}

/** Rebuild the plan from current availability + profile (e.g. after profile edits). */
export async function regeneratePlan() {
  const [av, profile] = await Promise.all([getAvailability(), repo.getProfile()]);
  if (!av && !(await getPlan())) return null; // nothing set up yet: the wizard builds the first plan
  registerCustomGear(profile.customGear?.items ?? []);
  const old = await repo.get('coach', 'plan').catch(() => null);
  let plan = profile.mode === 'nutrition' ? dietPlan(av ?? DEFAULT_AVAILABILITY) : planWeek({ availability: av ?? DEFAULT_AVAILABILITY, profile, today: new Date() });
  if (old?.pins?.length && plan.sessions.length) plan = { ...applyPins(plan, old.pins, av, new Date()), pins: old.pins }; // your "every week" moves survive re-planning
  return savePlan(plan);
}

const sundayKey = (d = new Date()) => { const x = new Date(d); x.setDate(x.getDate() + (7 - ((x.getDay() + 6) % 7) - 1)); return localDateKey(x); };
const snapshot = (p) => ({ sessions: p.sessions, restDays: p.restDays, nutrition: p.nutrition });

/**
 * Move a session. scope 'week' → only this week (rolls back after Sunday);
 * 'always' → every week, remembered as a pin so Cratos keeps it when re-planning.
 * Returns the previous plan so the UI can offer Undo.
 */
export async function rescheduleSession(fromDay, to, scope = 'week') {
  const [plan, av] = await Promise.all([getPlan(), getAvailability()]);
  if (!plan) return null;
  const focus = plan.sessions.find((x) => x.day === fromDay)?.focus;
  let next = moveSession(plan, fromDay, to, av, new Date());
  if (scope === 'week') {
    next = { ...next, base: plan.base ?? snapshot(plan), baseUntil: plan.baseUntil ?? sundayKey() };
  } else {
    // pins remember which session moved (Cratos plans the same week the same way), so repeated focuses like two Upper days stay distinct
    const pins = [...(plan.pins ?? []).filter((x) => !(x.focus === focus && (x.day === fromDay || x.fromDay === fromDay))), { focus, fromDay: plan.pins?.find((x) => x.focus === focus && x.day === fromDay)?.fromDay ?? fromDay, day: to.day, start: to.start }];
    next = { ...next, pins };
    if (plan.base) next.base = snapshot(moveSession({ ...plan, ...plan.base }, fromDay, to, av, new Date()));
  }
  await savePlan(next);
  return plan;
}

export async function skipSessionThisWeek(day) {
  const [plan, av] = await Promise.all([getPlan(), getAvailability()]);
  if (!plan) return null;
  await savePlan({ ...skipEngine(plan, day, av, new Date()), base: plan.base ?? snapshot(plan), baseUntil: plan.baseUntil ?? sundayKey() });
  return plan;
}

/** Undo: put a previous plan back exactly. */
export const restorePlan = (plan) => savePlan(plan);

export async function listMessages() {
  return (await repo.list('coachMessages')).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || (a.seq ?? 0) - (b.seq ?? 0));
}

export async function addMessage(role, text, card = null, seq = 0) {
  return repo.create('coachMessages', { date: localDateKey(), role, text, card, seq });
}

export async function ensureGreeting() {
  const msgs = await listMessages();
  if (!msgs.length) await addMessage('kratos', GREETING);
}

/** Send a user message; persists the reply and any schedule/plan changes. */
export async function sendToKratos(text) {
  await addMessage('user', text);
  const [availability, plan, profile, workouts, targets] = await Promise.all([getAvailability(), getPlan(), repo.getProfile(), repo.list('workouts'), activeTargets()]);
  const out = respond(text, { availability, plan, profile, workouts, targets, now: new Date() });
  if (out.availability) await saveAvailability(out.availability);
  if (out.plan) await savePlan(out.plan);
  let i = 0;
  for (const r of out.replies) await addMessage('kratos', r.text, r.card ?? null, ++i);
  return out;
}

export async function clearChat() {
  for (const m of await repo.list('coachMessages')) await repo.remove('coachMessages', m.id);
}
