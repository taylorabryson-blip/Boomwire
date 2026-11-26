/**
 * Cratos persistence: availability + plan singletons in the `coach` store,
 * chat history in `coachMessages`.
 */
import * as repo from './storage/repository.js';
import { respond, GREETING } from '../engines/coach/kratos.js';
import { planWeek, DEFAULT_AVAILABILITY } from '../engines/coach/planner.js';
import { localDateKey } from '../utils/dates.js';
import { activeTargets } from './nutrition/log.js';
import { registerCustomGear } from '../data/exercises/gear.js';

const serializePlan = (plan) => ({
  ...plan,
  nutrition: { ...plan.nutrition, startDate: plan.nutrition.startDate ? localDateKey(plan.nutrition.startDate) : null },
});

export const getAvailability = () => repo.get('coach', 'availability');
export const getPlan = () => repo.get('coach', 'plan');

export async function saveAvailability(av) {
  return repo.upsertSingleton('coach', 'availability', { ...av, kind: 'availability' });
}
export async function savePlan(plan) {
  return repo.upsertSingleton('coach', 'plan', { ...serializePlan(plan), kind: 'plan' });
}

/** Rebuild the plan from current availability + profile (e.g. after profile edits). */
export async function regeneratePlan() {
  const [av, profile] = await Promise.all([getAvailability(), repo.getProfile()]);
  if (!av && !(await getPlan())) return null; // nothing set up yet: the wizard builds the first plan
  registerCustomGear(profile.customGear?.items ?? []);
  const plan = planWeek({ availability: av ?? DEFAULT_AVAILABILITY, profile, today: new Date() });
  return savePlan(plan);
}

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
