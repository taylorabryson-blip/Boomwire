/**
 * Reminder schedule — pure. Turns the user's notification preferences plus
 * the Cratos plan into a flat list of weekly reminders:
 *   { id, kind, title, body, days: number[] (0=Mon…6=Sun), time: 'HH:MM', url }
 * The same list drives in-app reminders and the push server.
 */
import { toMin, toHHMM, fmt12 } from '../coach/parser.js';

export const DEFAULT_REMINDERS = Object.freeze({
  workout: { enabled: true, leadMin: 30 },
  water: { enabled: false, times: ['10:00', '13:00', '16:00', '19:00'] },
  meals: { enabled: false },
  rest: { enabled: false, time: '09:00' },
  checkin: { enabled: false, day: 6, time: '18:00' },
});

const ALL = [0, 1, 2, 3, 4, 5, 6];

export function buildReminders(prefs, plan) {
  const p = { ...DEFAULT_REMINDERS, ...(prefs ?? {}) };
  const out = [];
  const sessions = plan?.sessions ?? [];
  if (p.workout?.enabled) {
    for (const s of sessions) {
      const t = toMin(s.start) - (p.workout.leadMin ?? 30);
      out.push({ id: `workout-${s.day}`, kind: 'workout', days: [s.day], time: toHHMM(t < 0 ? 0 : t),
        title: `${s.focus} at ${fmt12(toMin(s.start))}`, body: 'Cratos: shoes on. Your session is coming up.', url: '#/train' });
    }
  }
  if (p.water?.enabled) {
    (p.water.times ?? []).forEach((time, i) => out.push({ id: `water-${i}`, kind: 'water', days: ALL, time,
      title: 'Water check', body: 'Grab a cup. Tap to log it.', url: '#/nutrition' }));
  }
  if (p.meals?.enabled) {
    for (const m of plan?.nutrition?.meals ?? []) {
      out.push({ id: `meal-pre-${m.day}`, kind: 'meal', days: [m.day], time: m.pre.time,
        title: m.pre.kind === 'snack' ? 'Pre-workout snack' : 'Pre-workout meal', body: 'Fuel up before you train.', url: '#/kratos' });
      out.push({ id: `meal-post-${m.day}`, kind: 'meal', days: [m.day], time: m.post.time,
        title: 'Post-workout meal', body: 'Protein-rich meal now. Recovery starts here.', url: '#/kratos' });
    }
  }
  if (p.rest?.enabled && plan?.restDays?.length) {
    out.push({ id: 'rest', kind: 'rest', days: plan.restDays, time: p.rest.time ?? '09:00',
      title: 'Rest day', body: 'Recover hard: walk, stretch, eat, sleep.', url: '#/home' });
  }
  if (p.checkin?.enabled) {
    out.push({ id: 'checkin', kind: 'checkin', days: [p.checkin.day ?? 6], time: p.checkin.time ?? '18:00',
      title: 'Weekly check-in', body: 'Log your weight and measurements.', url: '#/measurements' });
  }
  return out;
}

/** Reminders due at a local moment (exact minute match). */
export function dueAt(reminders, date) {
  const day = (date.getDay() + 6) % 7;
  const hhmm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return reminders.filter((r) => r.days.includes(day) && r.time === hhmm);
}
