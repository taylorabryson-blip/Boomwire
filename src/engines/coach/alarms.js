/**
 * K6 — Phone alarms for a day, from the plan (pure).
 * Wake-up (your wake time), pre-workout meal (K5), and a heads-up before each session.
 * dow: 0 = Monday … 6 = Sunday (planner convention).
 */
import { toMin, toHHMM } from './parser.js';

export function alarmsForDay(plan, availability, dow, { leadMin = 30, meals = true } = {}) {
  const out = [];
  const session = plan?.sessions?.find((s) => s.day === dow);
  if (availability?.wakeTime) out.push({ time: availability.wakeTime, label: plan?.mode === 'nutrition' ? 'Wake up' : session ? `Wake up · ${session.focus} today` : 'Wake up · rest day' });
  if (meals) for (const m of plan?.nutrition?.dailyMeals ?? []) out.push({ time: m.time, label: m.label });
  if (session) {
    const meal = plan.nutrition?.meals?.find((m) => m.day === dow);
    if (meals && meal?.pre?.time) out.push({ time: meal.pre.time, label: meal.pre.kind === 'snack' ? 'Pre-workout snack' : 'Pre-workout meal' });
    const t = Math.max(0, toMin(session.start) - leadMin);
    out.push({ time: toHHMM(t), label: `${session.focus} in ${leadMin} min` });
  }
  // de-duplicate same minute, keep first
  const seen = new Set();
  return out.filter((a) => (seen.has(a.time) ? false : seen.add(a.time))).sort((a, b) => a.time.localeCompare(b.time));
}
