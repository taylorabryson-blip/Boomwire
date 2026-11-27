/**
 * S1 — When did you fall asleep?
 *
 * A web app can't watch your phone while it's closed, so Hercules uses the
 * best evidence it has, in this order:
 *  1. Apple Health (iPhone Sleep Schedule / Apple Watch), sent by the
 *     "Hercules Sleep" shortcut. Exact as Health records it.
 *  2. An estimate from two clues:
 *     - your sleep schedule (bedtime / wake time), and
 *     - the last time you used Hercules last night. Using the app at 12:40 AM
 *       means you weren't asleep before 12:40 AM.
 *     Asleep = the later of bedtime and last use, plus ~15 min to drift off
 *     (typical sleep-onset latency is about 10–20 minutes).
 *     Woke = your wake time, or the first time you opened Hercules this
 *     morning if that was earlier.
 * Times are always editable; whatever you set wins.
 */

export const ONSET_MIN = 15;
const H = 3600000;

const atTime = (base, hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base); d.setHours(h, m, 0, 0); return d;
};

/**
 * @param o.now        Date (the morning you're asking about)
 * @param o.bedtime    "HH:MM" scheduled sleep time (default 23:00)
 * @param o.wake       "HH:MM" scheduled wake time (default 07:00)
 * @param o.activity   [epoch ms] moments you used Hercules
 * @returns { asleep: Date, woke: Date, minutes, basis: string[], lastUse: Date|null, firstUse: Date|null }
 */
export function estimateSleep({ now = new Date(), bedtime = '23:00', wake = '07:00', activity = [] }) {
  let woke = atTime(now, wake);
  if (woke > now) woke = new Date(Math.min(now.getTime(), woke.getTime()));
  // Bedtime belongs to the evening before the wake (or the same day if after midnight).
  let bed = atTime(woke, bedtime);
  if (bed >= woke) bed = new Date(bed.getTime() - 24 * H);
  const basis = ['your sleep schedule'];

  // Last use in the night window (from 6 h before bedtime until 3 h before wake).
  const nightFrom = bed.getTime() - 6 * H, nightTo = woke.getTime() - 3 * H;
  const night = activity.filter((t) => t >= nightFrom && t <= nightTo);
  const lastUse = night.length ? new Date(Math.max(...night)) : null;
  let asleep = new Date(bed.getTime() + ONSET_MIN * 60000);
  if (lastUse && lastUse.getTime() + ONSET_MIN * 60000 > asleep.getTime()) {
    asleep = new Date(lastUse.getTime() + ONSET_MIN * 60000);
    basis.push('when you last used Hercules');
  }

  // First use this morning, if it came before the scheduled wake time.
  const morning = activity.filter((t) => t > nightTo && t <= now.getTime());
  const firstUse = morning.length ? new Date(Math.min(...morning)) : null;
  if (firstUse && firstUse < woke && firstUse > asleep) { woke = firstUse; basis.push('when you first opened Hercules'); }

  const minutes = Math.max(0, Math.round((woke - asleep) / 60000));
  return { asleep, woke, minutes, basis, lastUse, firstUse };
}

/** Minutes between two times-of-day across midnight ("23:40" → "07:05" = 445). */
export function minutesBetween(fromHHMM, toHHMM) {
  const [a, b] = [fromHHMM, toHHMM].map((t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; });
  return ((b - a) % 1440 + 1440) % 1440;
}

/** Pick the Health entry that ended on the morning of `dateKey` (local). */
export function healthNightFor(entries, dateKey) {
  const local = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  return entries.filter((e) => local(e.end) === dateKey).sort((a, b) => (Date.parse(b.end) - Date.parse(b.start)) - (Date.parse(a.end) - Date.parse(a.start)))[0] ?? null;
}
