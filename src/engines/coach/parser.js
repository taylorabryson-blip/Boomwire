/**
 * Natural-language schedule parser for Cratos. Deterministic and offline:
 * it recognises days, times, time ranges and a fixed vocabulary of intents.
 * Anything it assumes is returned in `assumptions` so Cratos can say it out
 * loud and the user can correct it.
 *
 * Days are 0–6 = Monday–Sunday. Times are minutes after midnight.
 */

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const DAY_WORD = {
  mon: 0, monday: 0, mondays: 0, tue: 1, tues: 1, tuesday: 1, tuesdays: 1,
  wed: 2, weds: 2, wednesday: 2, wednesdays: 2, thu: 3, thur: 3, thurs: 3, thursday: 3, thursdays: 3,
  fri: 4, friday: 4, fridays: 4, sat: 5, saturday: 5, saturdays: 5, sun: 6, sunday: 6, sundays: 6,
};
const NUM_WORD = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, a: 1, an: 1 };
const DAY_RE_SRC = Object.keys(DAY_WORD).sort((a, b) => b.length - a.length).join('|');

/* ---- time helpers -------------------------------------------------------- */
export const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const toHHMM = (min) => { const m = Math.max(0, Math.min(1439, Math.round(min))); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
export function fmt12(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60), mm = m % 60, ap = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 || 12;
  return mm ? `${h12}:${String(mm).padStart(2, '0')} ${ap}` : `${h12} ${ap}`;
}
export const fmtRange = (a, b) => `${fmt12(a)} – ${fmt12(b)}`;

const TIME_SRC = String.raw`(noon|midnight|(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|am|pm|a|p)?)`;

function readTime(match) {
  // match groups: full, word|num, h, m, mer
  const word = match[0].trim().toLowerCase();
  if (word === 'noon') return { h: 12, m: 0, mer: 'pm' };
  if (word === 'midnight') return { h: 12, m: 0, mer: 'am' };
  const h = Number(match[1]), m = Number(match[2] ?? 0);
  const merRaw = match[3]?.toLowerCase().replace(/\./g, '');
  const mer = merRaw ? (merRaw.startsWith('a') ? 'am' : 'pm') : null;
  return { h, m, mer };
}
const with24 = (t) => (t.h > 12 ? t.h * 60 + t.m : null); // 13–23 → explicit 24h
function withMer(t, mer) {
  if (t.h > 12) return t.h * 60 + t.m;
  let h = t.h % 12;
  if (mer === 'pm') h += 12;
  return h * 60 + t.m;
}

/**
 * Resolve an ambiguous range like "9-5" into concrete minutes.
 * Rules (documented, echoed back to the user):
 *  - explicit am/pm or 24-hour values are respected;
 *  - a bare start of 7–11 is morning, 12 is noon, 1–4 is afternoon, 5–6 is morning;
 *  - a bare end is the first matching clock time after the start.
 * Returns {start, end, overnight}.
 */
export function resolveRange(a, b) {
  let start;
  if (with24(a) != null) start = with24(a);
  else if (a.mer) start = withMer(a, a.mer);
  else if (b.mer && with24(b) == null) {
    const same = withMer(a, b.mer), endSame = withMer(b, b.mer);
    start = same < endSame ? same : withMer(a, 'am');
  } else if (a.h === 12) start = 12 * 60 + a.m;
  else if (a.h >= 1 && a.h <= 4) start = (a.h + 12) * 60 + a.m;
  else start = a.h * 60 + a.m; // 5–11 → morning
  let end;
  if (with24(b) != null) end = with24(b);
  else if (b.mer) end = withMer(b, b.mer);
  else {
    const c1 = (b.h % 12) * 60 + b.m, c2 = c1 + 720;
    end = [c1, c2].find((c) => c > start) ?? c1;
  }
  return { start, end, overnight: end <= start };
}

/* ---- days -------------------------------------------------------------- */
function findDayMentions(s) {
  const out = [];
  const take = (re, fn) => { for (const m of s.matchAll(re)) out.push({ pos: m.index, end: m.index + m[0].length, days: fn(m) }); };
  const range = (a, b) => { const r = []; for (let d = a; ; d = (d + 1) % 7) { r.push(d); if (d === b || r.length > 7) break; } return r; };
  take(new RegExp(String.raw`\b(${DAY_RE_SRC})\b\s*(?:-|–|to|through|thru|till|until)\s*\b(${DAY_RE_SRC})\b`, 'g'), (m) => range(DAY_WORD[m[1]], DAY_WORD[m[2]]));
  take(/\b(weekdays?|week days|monday to friday)\b/g, () => [0, 1, 2, 3, 4]);
  take(/\b(weekends?)\b/g, () => [5, 6]);
  take(/\b(every ?day|daily|all week|7 days a week|seven days)\b/g, () => [0, 1, 2, 3, 4, 5, 6]);
  const covered = (i) => out.some((o) => i >= o.pos && i < o.end);
  for (const m of s.matchAll(new RegExp(String.raw`\b(${DAY_RE_SRC})\b`, 'g'))) {
    if (!covered(m.index)) out.push({ pos: m.index, end: m.index + m[0].length, days: [DAY_WORD[m[1]]] });
  }
  // merge adjacent single-day lists like "mon, wed and fri"
  out.sort((x, y) => x.pos - y.pos);
  const merged = [];
  for (const o of out) {
    const last = merged.at(-1);
    if (last && /^[\s,&]*(and|&|,|\/)?[\s,]*$/.test(s.slice(last.end, o.pos))) { last.days = [...new Set([...last.days, ...o.days])]; last.end = o.end; }
    else merged.push({ ...o });
  }
  return merged;
}

/* ---- main parser ------------------------------------------------------- */
const BUSY_WORDS = /\b(work|working|job|shift|shifts|school|class|classes|college|practice|busy|meeting|meetings|church|commute|lectures?|office)\b/;
const FREE_WORDS = /\b(free|available|open|off work|can (?:train|work ?out|lift|go|hit)|could (?:train|go)|gym time)\b/;
const TRAIN_WORDS = /\b(train|training|work ?out|workouts?|lift|lifting|gym|exercise|sessions?)\b/;

/**
 * @param {string} text
 * @returns {{busy: object[], free: object[], daysOff: number[], wake: number|null, sleep: number|null,
 *   daysPerWeek: number|null, sessionMinutes: number|null, preference: string|null,
 *   intents: Set<string>, assumptions: string[], understood: boolean}}
 */
export function parseMessage(text) {
  const raw = String(text || '');
  const s = raw.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ');
  const r = { busy: [], free: [], daysOff: [], wake: null, sleep: null, daysPerWeek: null, sessionMinutes: null, preference: null, intents: new Set(), assumptions: [] };

  const sentences = s.split(/[.!?;\n]+|\bbut\b|\bthen\b(?= on| i)/).map((x) => x.trim()).filter(Boolean);
  const rangeRe = new RegExp(String.raw`(?:from\s+)?\b${TIME_SRC}\s*(?:-|–|to|until|till|til|through)\s*${TIME_SRC}`, 'g');

  for (const sent of sentences) {
    const dayMentions = findDayMentions(sent);
    const ranges = [];
    let lastLabel = null;
    for (const m of sent.matchAll(rangeRe)) {
      // groups 1-4 = first time, 5-8 = second
      const a = readTime([m[1], m[2], m[3], m[4]]), b = readTime([m[5], m[6], m[7], m[8]]);
      if (a.h > 23 || b.h > 23 || a.m > 59 || b.m > 59) continue;
      if (!a.mer && !b.mer && a.h <= 7 && b.h <= 7 && /\b(days?|times?|x)\b/.test(sent.slice(m.index + m[0].length, m.index + m[0].length + 8))) continue; // "3-4 days a week"
      ranges.push({ pos: m.index, end: m.index + m[0].length, a, b });
    }

    ranges.forEach((rg, k) => {
      const nextPos = ranges[k + 1]?.pos ?? Infinity, prevEnd = ranges[k - 1]?.end ?? -1;
      const after = dayMentions.find((d) => d.pos >= rg.end && d.pos < nextPos);
      const before = [...dayMentions].reverse().find((d) => d.end <= rg.pos && d.pos > prevEnd);
      // Prefer whichever day phrase sits closest to this time range.
      const gapAfter = after ? after.pos - rg.end : Infinity, gapBefore = before ? rg.pos - before.end : Infinity;
      const nearest = gapBefore <= gapAfter ? before : after;
      const ctx = sent.slice(Math.max(prevEnd, 0), Math.min(nextPos, sent.length));
      const isFree = FREE_WORDS.test(ctx) || (/\b(off)\b/.test(ctx) && !BUSY_WORDS.test(ctx));
      const busyLabel = ctx.match(BUSY_WORDS)?.[1];
      let days = (nearest ?? dayMentions[0])?.days;
      if (!days) {
        days = isFree ? [0, 1, 2, 3, 4, 5, 6] : [0, 1, 2, 3, 4];
        r.assumptions.push(isFree ? 'You didn’t say which days, so I applied that free time to every day.' : 'You didn’t say which days, so I assumed Monday–Friday.');
      }
      const { start, end, overnight } = resolveRange(rg.a, rg.b);
      const unclear = !rg.a.mer && !rg.b.mer && rg.a.h <= 12 && rg.b.h <= 12;
      if (unclear) r.assumptions.push(`I read “${sent.slice(rg.pos, rg.end).trim()}” as ${fmtRange(start, end)}. Add am/pm if that’s wrong.`);
      const label = isFree ? 'free' : busyLabel ? normalizeLabel(busyLabel) : lastLabel ?? 'Busy';
      if (!isFree) lastLabel = label;
      const target = isFree ? r.free : r.busy;
      for (const d of days) {
        if (!overnight) target.push({ day: d, start, end, label });
        else {
          target.push({ day: d, start, end: 1439, label });
          if (end > 0) target.push({ day: (d + 1) % 7, start: 0, end, label });
        }
      }
    });

    // Days off: "weekends off", "off on sunday", "free saturday"
    if (!ranges.length && /\b(off|free|nothing|no work)\b/.test(sent) && dayMentions.length) {
      for (const d of dayMentions) r.daysOff.push(...d.days);
    }

    // Wake / sleep
    const single = (re) => { const m = sent.match(re); if (!m) return null; const t = readTime([m[1], m[2], m[3], m[4]]); return t; };
    const wake = single(new RegExp(String.raw`\b(?:wake|waking|get up|getting up|up at|alarm)\b[^0-9a-z]*(?:up\s*)?(?:at|around|by|@)?\s*${TIME_SRC}`));
    if (wake) r.wake = with24(wake) ?? withMer(wake, wake.mer ?? 'am');
    const sleep = single(new RegExp(String.raw`\b(?:sleep|bed|crash|asleep|go to sleep|lights out)\b[^0-9]*?(?:at|around|by|@)?\s*${TIME_SRC}`));
    if (sleep) {
      let v = with24(sleep) ?? withMer(sleep, sleep.mer ?? (sleep.h >= 6 && sleep.h <= 11 ? 'pm' : 'am'));
      if (sleep.h === 12 && !sleep.mer) v = 0;
      r.sleep = v;
    }

    // Training days per week
    const dpw = sent.match(/\b(\d|one|two|three|four|five|six|seven)\s*(?:x|times|days?)\s*(?:a|per|\/|each|every)\s*week\b/);
    if (dpw) {
      const n = Number(dpw[1]) || NUM_WORD[dpw[1]];
      const jobContext = /\b(i )?(work|job|shift)\b/.test(sent) && !TRAIN_WORDS.test(sent);
      if (!jobContext && n >= 1 && n <= 7) r.daysPerWeek = n;
    }

    // Session length
    if (TRAIN_WORDS.test(sent) || /\b(got|have|only|about|like)\b/.test(sent)) {
      const mins = sent.match(/\b(\d{2,3})\s*(?:min|mins|minutes)\b/);
      const hrs = sent.match(/\b(an|one|1|two|2|1\.5)\s*(?:hour|hr|hours|hrs)\b(\s*and a half)?/);
      const half = /\bhalf (?:an )?hour\b/.test(sent);
      if (!/\b(commute|drive|lunch|break)\b/.test(sent)) {
        if (mins) r.sessionMinutes = Number(mins[1]);
        else if (hrs) r.sessionMinutes = Math.round(((Number(hrs[1]) || NUM_WORD[hrs[1]]) + (hrs[2] ? 0.5 : 0)) * 60);
        else if (half) r.sessionMinutes = 30;
        if (r.sessionMinutes != null) r.sessionMinutes = Math.max(15, Math.min(180, r.sessionMinutes));
      }
    }

    // Preference
    if (/\b(prefer|rather|like|love|best|usually|want to|wanna)\b/.test(sent) || TRAIN_WORDS.test(sent)) {
      if (/\b(mornings?|before work|before school|early|am workouts?)\b/.test(sent)) r.preference = 'morning';
      else if (/\b(evenings?|after work|after school|at night|nights|tonight)\b/.test(sent) && !ranges.length) r.preference = 'evening';
      else if (/\b(lunch|midday|lunchtime)\b/.test(sent)) r.preference = 'midday';
    }
  }

  // Intents
  const I = r.intents;
  if (/\b(plan|program|routine|split|schedule me|fit me|fit (?:it|them|workouts?) in|when (?:should|can|do) i (?:train|work ?out|lift|go to the gym|hit the gym|exercise)|what days|best (?:days|time)|make me|build me|set me up)\b/.test(s)) I.add('plan');
  if (/\b(today|tonight|right now|this morning|this evening)\b/.test(s)) I.add('today');
  if (/\b(diet|dieting|eat|eating|food|meals?|nutrition|cut|cutting|bulk|bulking|protein|calories?|macros?)\b/.test(s)) I.add('nutrition');
  if (/\b(tired|lazy|don'?t feel like|dont wanna|motivat\w*|skip|unmotivated|can'?t be bothered|struggl\w*|give up|quit)\b/.test(s)) I.add('motivate');
  if (/\b(rest day|sore|recover\w*|day off from)\b/.test(s)) I.add('rest');
  if (/\b(reset|start over|clear (?:my )?schedule|wipe (?:my )?schedule|forget my schedule)\b/.test(s)) I.add('reset');
  if (/^\s*(yo|hey|hi|hello|sup|what'?s up|wassup|ayo)\b/.test(s)) I.add('greeting');
  if (/\b(thanks|thank you|thx|appreciate|ty)\b/.test(s)) I.add('thanks');
  if (/\b(help|what can you do|how does this work|who are you)\b/.test(s)) I.add('help');
  if (/\bwhat should i (?:train|hit|work on|do)\b|\b(lagging|neglect\w*|weak points?|behind)\b/.test(s)) I.add('focus');

  r.daysOff = [...new Set(r.daysOff)];
  r.understood = r.busy.length + r.free.length + r.daysOff.length > 0 || r.wake != null || r.sleep != null
    || r.daysPerWeek != null || r.sessionMinutes != null || r.preference != null || I.size > 0;
  return r;
}

function normalizeLabel(w) {
  if (!w) return 'Busy';
  if (/school|class|college|lecture/.test(w)) return 'School';
  if (/practice/.test(w)) return 'Practice';
  if (/church/.test(w)) return 'Church';
  if (/meeting/.test(w)) return 'Meetings';
  if (/commute/.test(w)) return 'Commute';
  if (/work|job|shift|office/.test(w)) return 'Work';
  return 'Busy';
}
