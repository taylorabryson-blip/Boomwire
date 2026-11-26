/**
 * KRATOS — Hercules' coach. Named for the Greek personification of strength.
 *
 * A deterministic, offline dialogue engine: parse → update schedule →
 * respond. No network, no API key, no invented data: every number Kratos
 * says comes from the user's records or the planner. Replies are short and
 * hype, but never shame the user's body.
 */
import { parseMessage, DAY_SHORT, DAY_NAMES, fmt12, fmtRange, toMin, toHHMM } from './parser.js';
import { planWeek, DEFAULT_AVAILABILITY, STYLE_SCHEMES } from './planner.js';
import { setsPerGroup, completedWorkouts } from '../training/metrics.js';
import { GROUPS } from '../../data/anatomy/muscles.js';
import { isDeveloping } from '../../data/models.js';
import { localDateKey, addDays, parseDateKey, isDateKey } from '../../utils/dates.js';

/* ---- voice --------------------------------------------------------------- */
const LINES = {
  locked: ['Locked in.', 'Got it, bro.', 'Noted. Olympus remembers.', 'Say less.'],
  plan: ['Here’s the war plan.', 'This is how we build you.', 'Your week. No excuses, just reps.'],
  hype: [
    'Bro. You don’t have to feel like it. You just have to start. Five minutes, then decide.',
    'Discipline is doing it on the days motivation calls in sick. Shoes on. Go.',
    'Nobody ever regretted the workout. Get the first set done and I’ll handle the rest.',
    'The gods weren’t built on perfect days. Show up at 60% — that still counts.',
  ],
  rest: [
    'Rest is part of the program, not a break from it. Muscles get built while you recover.',
    'Rest day. Walk, stretch, eat, sleep. You come back stronger.',
  ],
  thanks: ['Anytime. Now go lift.', 'That’s what I’m here for.', 'Respect. Back to work.'],
};
function pick(list, seed) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}

export function formatDays(days) {
  const d = [...new Set(days)].sort((a, b) => a - b);
  if (d.length === 7) return 'every day';
  if (d.join() === '0,1,2,3,4') return 'Mon–Fri';
  if (d.join() === '5,6') return 'weekends';
  const runs = [];
  for (const x of d) { const r = runs.at(-1); if (r && x === r[1] + 1) r[1] = x; else runs.push([x, x]); }
  return runs.map(([a, b]) => (a === b ? DAY_SHORT[a] : b === a + 1 ? `${DAY_SHORT[a]}, ${DAY_SHORT[b]}` : `${DAY_SHORT[a]}–${DAY_SHORT[b]}`)).join(', ');
}

/** Group blocks with identical label+times for a compact summary. */
export function summarizeBlocks(blocks) {
  const map = new Map();
  for (const b of blocks) {
    const key = `${b.label}|${b.start}|${b.end}`;
    if (!map.has(key)) map.set(key, { ...b, days: [] });
    map.get(key).days.push(b.day);
  }
  return [...map.values()].map((g) => `${g.label === 'free' ? 'Free' : g.label} ${formatDays(g.days)}, ${fmtRange(toMin(g.start), toMin(g.end))}`);
}

/** Merge parsed schedule facts into stored availability. */
export function mergeAvailability(current, p) {
  const av = { ...DEFAULT_AVAILABILITY, ...(current ?? {}) };
  let busy = [...(av.busy ?? [])], free = [...(av.free ?? [])];
  if (p.daysOff.length) busy = busy.filter((b) => !p.daysOff.includes(b.day));
  const key = (b) => `${b.day}|${b.start}|${b.end}`;
  for (const b of p.busy) {
    const rec = { day: b.day, start: toHHMM(b.start), end: toHHMM(b.end), label: b.label };
    if (!busy.some((x) => key(x) === key(rec))) busy.push(rec);
  }
  if (p.free.length) {
    const days = new Set(p.free.map((b) => b.day));
    free = free.filter((b) => !days.has(b.day));
    for (const b of p.free) free.push({ day: b.day, start: toHHMM(b.start), end: toHHMM(b.end), label: 'free' });
  }
  return {
    ...av, kind: 'availability', busy, free,
    wakeTime: p.wake != null ? toHHMM(p.wake) : av.wakeTime,
    sleepTime: p.sleep != null ? toHHMM(p.sleep === 0 ? 1439 : p.sleep) : av.sleepTime,
    daysPerWeek: p.daysPerWeek ?? av.daysPerWeek,
    sessionMinutes: p.sessionMinutes ?? av.sessionMinutes,
    preference: p.preference ?? av.preference,
  };
}

const hasSchedule = (p) => p.busy.length || p.free.length || p.daysOff.length || p.wake != null || p.sleep != null
  || p.daysPerWeek != null || p.sessionMinutes != null || p.preference != null;

export const GREETING = [
  'I’m Kratos. Strength, in the flesh. I build your week around your actual life.',
  'Tell me your schedule like you’d text a friend: “I work 9 to 5 Mon–Fri, wake up at 6:30, sleep at 11, want to lift 4 days.”',
  'I’ll find the best days and times, set your splits, and tell you when to eat around training.',
].join('\n\n');

/**
 * @param {string} text user message
 * @param {{availability?: object, plan?: object, profile?: object, workouts?: object[], now?: Date}} ctx
 * @returns {{replies: {text: string, card?: object}[], availability: object|null, plan: object|null}}
 */
export function respond(text, ctx = {}) {
  const now = ctx.now ?? new Date();
  const seed = `${text}|${localDateKey(now)}`;
  const p = parseMessage(text);
  const replies = [];
  let availability = null, plan = null;
  const profile = ctx.profile ?? {};
  const currentAv = ctx.availability ?? null;

  if (p.intents.has('reset')) {
    availability = { ...DEFAULT_AVAILABILITY };
    plan = planWeek({ availability, profile, today: now });
    replies.push({ text: 'Schedule wiped. Clean slate. Tell me your week again and I’ll rebuild it.' });
    return { replies, availability, plan };
  }

  if (hasSchedule(p)) {
    availability = mergeAvailability(currentAv, p);
    const facts = [];
    facts.push(...summarizeBlocks(p.busy.map((b) => ({ ...b, start: toHHMM(b.start), end: toHHMM(b.end) }))));
    facts.push(...summarizeBlocks(p.free.map((b) => ({ ...b, start: toHHMM(b.start), end: toHHMM(b.end), label: 'free' }))));
    if (p.daysOff.length) facts.push(`Off ${formatDays(p.daysOff)}`);
    if (p.wake != null) facts.push(`Up at ${fmt12(p.wake)}`);
    if (p.sleep != null) facts.push(`Bed at ${fmt12(p.sleep)}`);
    if (p.daysPerWeek != null) facts.push(`${p.daysPerWeek} training days a week`);
    if (p.sessionMinutes != null) facts.push(`${p.sessionMinutes}-minute sessions`);
    if (p.preference) facts.push(`Prefers ${p.preference === 'midday' ? 'midday' : p.preference + 's'}`);
    let msg = `${pick(LINES.locked, seed)}\n${facts.map((f) => `• ${f}`).join('\n')}`;
    if (p.assumptions.length) msg += `\n\n${p.assumptions.join('\n')}`;
    replies.push({ text: msg });
    plan = planWeek({ availability, profile, today: now });
    replies.push(planReply(plan, seed));
    return { replies, availability, plan };
  }

  const av = currentAv ?? { ...DEFAULT_AVAILABILITY };
  const current = ctx.plan ?? null;

  if (p.intents.has('plan')) {
    plan = planWeek({ availability: av, profile, today: now });
    if (!currentAv) replies.push({ text: 'You haven’t told me your schedule yet, so I’m assuming you’re free from 7 AM to 11 PM. Text me your work or school hours and I’ll tighten it up.' });
    replies.push(planReply(plan, seed));
  }
  if (p.intents.has('today')) replies.push(todayReply(current ?? planWeek({ availability: av, profile, today: now }), ctx.workouts ?? [], now));
  if (p.intents.has('nutrition')) replies.push(nutritionReply(current ?? planWeek({ availability: av, profile, today: now }), profile, now, ctx));
  if (p.intents.has('focus')) replies.push(focusReply(ctx.workouts ?? [], now));
  if (p.intents.has('motivate')) replies.push({ text: pick(LINES.hype, seed) + (current ? `\n\n${nextSessionLine(current, now)}` : '') });
  if (p.intents.has('rest')) replies.push({ text: pick(LINES.rest, seed) });
  if (p.intents.has('thanks') && !replies.length) replies.push({ text: pick(LINES.thanks, seed) });
  if ((p.intents.has('greeting') || p.intents.has('help')) && !replies.length) replies.push({ text: GREETING });

  if (!replies.length) {
    replies.push({ text: 'I didn’t catch a schedule or a question in that. Try:\n• “I work 7 to 3 Monday through Friday”\n• “Weekends off, I wake up at 8”\n• “Make me a plan” · “What’s today?” · “When do I eat?”' });
  }
  return { replies, availability, plan };
}

function planReply(plan, seed) {
  if (!plan.sessions.length) return { text: plan.notes.join('\n') || 'No training windows found. Tell me when you’re free.' };
  const scheme = STYLE_SCHEMES[plan.generatedFor.style] ?? STYLE_SCHEMES.general;
  const lines = [`${pick(LINES.plan, seed)} ${plan.sessions.length} days, ${plan.generatedFor.duration} minutes each. ${scheme.label}.`];
  if (plan.notes.length) lines.push(plan.notes.join('\n'));
  lines.push(`Rest: ${formatDays(plan.restDays)}. Rest is when you grow.`);
  return { text: lines.join('\n\n'), card: { type: 'plan' } };
}

export function nextSession(plan, now = new Date()) {
  if (!plan?.sessions?.length) return null;
  const today = (now.getDay() + 6) % 7, nowMin = now.getHours() * 60 + now.getMinutes();
  for (let k = 0; k < 8; k++) {
    const d = (today + k) % 7;
    const s = plan.sessions.find((x) => x.day === d && (k > 0 || toMin(x.start) >= nowMin - 30));
    if (s) return { session: s, inDays: k };
  }
  return null;
}

function nextSessionLine(plan, now) {
  const n = nextSession(plan, now);
  if (!n) return '';
  const when = n.inDays === 0 ? 'today' : n.inDays === 1 ? 'tomorrow' : DAY_NAMES[n.session.day];
  return `Next up: ${n.session.focus} ${when} at ${fmt12(toMin(n.session.start))}.`;
}

function todayReply(plan, workouts, now) {
  const todayKey = localDateKey(now);
  const done = completedWorkouts(workouts).filter((w) => w.date === todayKey);
  const d = (now.getDay() + 6) % 7;
  const s = plan.sessions.find((x) => x.day === d);
  if (done.length) return { text: `You already trained today — ${done.map((w) => w.name).join(', ')}. That’s a W. Eat, hydrate, sleep.` };
  if (!s) return { text: `Rest day today. Walk, stretch, eat, sleep — that’s the program.\n\n${nextSessionLine(plan, now)}` };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const late = nowMin > toMin(s.end);
  return {
    text: late
      ? `Today was ${s.focus} at ${fmt12(toMin(s.start))} and that window passed. Still got 30 minutes? Hit the first three lifts. Something beats nothing.`
      : `Today: ${s.focus}, ${fmtRange(toMin(s.start), toMin(s.end))}. ${s.exercises.length} exercises loaded and ready.`,
    card: { type: 'today', day: d },
  };
}

function nutritionReply(plan, profile, now, ctx = {}) {
  const dev = isDeveloping(profile, now);
  const n = plan.nutrition;
  const sd = typeof n.startDate === 'string' && isDateKey(n.startDate) ? parseDateKey(n.startDate) : n.startDate instanceof Date ? n.startDate : null;
  const start = sd ? sd.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) : 'Monday';
  const timing = n.meals.slice(0, 7).map((m) => `• ${DAY_SHORT[m.day]}: ${m.pre.kind === 'snack' ? 'snack' : 'meal'} ~${fmt12(toMin(m.pre.time))}, protein meal by ${fmt12(toMin(m.post.time))}`);
  const lines = [];
  if (dev) {
    lines.push('Real talk: you’re still growing, so we don’t diet. We fuel. Three solid meals, protein at each, snacks when hungry, and never train on empty.');
  } else {
    lines.push(`We start ${start}. Week one is simple: log everything you eat and don’t change it yet. You can’t fix what you don’t measure.`);
    lines.push('Then: protein at every meal, a meal before training, a protein meal after.');
  }
  if (timing.length) lines.push(`Fuel around your sessions:\n${timing.join('\n')}`);
  const t = ctx.targets;
  if (t && !t.missing) lines.push(`Your targets: ${t.kcal} kcal · ${t.protein} g protein · ${t.carbs} g carbs · ${t.fat} g fat${t.source === 'auto' ? ' (estimated from your profile — adjust in Nutrition → Targets)' : ''}.`);
  else lines.push('Set your targets in Nutrition → Targets (I need your weight, height, age and activity) and I’ll give you numbers.');
  return { text: lines.join('\n\n') };
}

function focusReply(workouts, now) {
  const from = addDays(localDateKey(now), -13);
  const recent = workouts.filter((w) => w.date >= from);
  if (!completedWorkouts(recent).length) return { text: 'No workouts logged in the last two weeks, so I can’t see lagging areas yet. Log a few sessions and ask again.' };
  const g = setsPerGroup(recent);
  const sorted = GROUPS.map((x) => ({ ...x, v: g[x.id] })).sort((a, b) => a.v - b.v);
  const low = sorted.slice(0, 2);
  return { text: `Last 14 days, your least-trained areas: ${low.map((x) => `${x.label} (${Math.round(x.v * 10) / 10} est. sets)`).join(' and ')}. Add 2–4 sets for each next week. (Estimated from your logged sets — not measured activation.)` };
}
