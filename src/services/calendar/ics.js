/**
 * Calendar export: turns a Cratos plan into weekly recurring events with a
 * 30-minute alert. On iPhone, opening the .ics adds them to Calendar, which
 * then reminds you even with Hercules closed.
 */
import { toMin } from '../../engines/coach/parser.js';
import { EXERCISE_BY_ID } from '../../data/exercises/exercises.js';

const BYDAY = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
const pad = (n) => String(n).padStart(2, '0');
const stamp = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
const local = (d, min) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Math.floor(min / 60))}${pad(min % 60)}00`;
const esc = (s) => String(s).replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');

export function buildPlanICS(plan, from = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hercules//Cratos Plan//EN', 'CALSCALE:GREGORIAN'];
  for (const s of plan.sessions) {
    const first = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const dow = (first.getDay() + 6) % 7;
    first.setDate(first.getDate() + ((s.day - dow + 7) % 7));
    const desc = s.exercises.map((e) => `${EXERCISE_BY_ID[e.exerciseId]?.name ?? e.exerciseId} — ${e.sets}×${e.reps ?? `${e.durationSec}s`}`).join('\n');
    lines.push('BEGIN:VEVENT',
      `UID:hercules-${s.day}-${s.start}-${s.focus.replace(/\s/g, '')}@hercules`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${local(first, toMin(s.start))}`,
      `DTEND:${local(first, toMin(s.end))}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.day]}`,
      `SUMMARY:${esc(`Hercules · ${s.focus}`)}`,
      `DESCRIPTION:${esc(`Cratos plan\n${desc}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${s.focus} in 30 minutes. Let’s go.`)}`, 'TRIGGER:-PT30M', 'END:VALARM',
      'END:VEVENT');
  }
  // Daily meal times (diet-only plans): 20-minute events repeating every day, alert at the time.
  for (const m of plan.nutrition?.dailyMeals ?? []) {
    const first = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const start = toMin(m.time);
    lines.push('BEGIN:VEVENT',
      `UID:hercules-meal-${m.label.toLowerCase()}@hercules`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${local(first, start)}`,
      `DTEND:${local(first, Math.min(start + 20, 1439))}`,
      'RRULE:FREQ=DAILY',
      `SUMMARY:${esc(`Hercules · ${m.label}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(`${m.label} time`)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  // Fold long lines at 75 octets per RFC 5545.
  return lines.map((l) => l.length <= 74 ? l : l.match(/.{1,74}/g).join('\r\n ')).join('\r\n') + '\r\n';
}

export async function downloadPlanICS(plan) {
  const text = buildPlanICS(plan);
  const file = new File([text], 'hercules-kratos-plan.ics', { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Cratos training plan' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = Object.assign(document.createElement('a'), { href: url, download: file.name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
