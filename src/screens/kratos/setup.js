/**
 * Kratos setup wizard — the button-driven way to give Kratos your life.
 * Nine steps, one screen each. On finish it saves the schedule + profile
 * and builds the plan immediately (so Kratos always has your data).
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, Button, List, FieldRow, Stepper, TimeField } from '../../components/primitives.js';
import { island } from '../../components/island.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { getAvailability, saveAvailability, savePlan } from '../../services/coach.js';
import { DEFAULT_AVAILABILITY, planWeek } from '../../engines/coach/planner.js';
import { DAY_SHORT } from '../../engines/coach/parser.js';
import { ENVIRONMENTS, STYLES } from '../../data/exercises/gear.js';
import { navigate } from '../../navigation/nav.js';
import { ACTIVITY_LABELS } from '../../engines/nutrition/nutrition.js';
import { kgToLb, lbToKg, cmToIn, inToCm } from '../../utils/units.js';
import { localDateKey } from '../../utils/dates.js';

export async function mount(root) {
  const [av0, p0, settings, metrics] = await Promise.all([getAvailability(), repo.getProfile(), repo.getSettings(), repo.list('bodyMetrics')]);
  const metric = settings.units === 'metric';
  const lastW = metrics.filter((m) => m.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0]?.weightKg ?? null;
  const av = { ...DEFAULT_AVAILABILITY, ...(av0 ?? {}) };
  // Reconstruct commitments into the wizard's simple model (first two groups).
  const groupBy = new Map();
  for (const b of av.busy) { const k = `${b.label}|${b.start}|${b.end}`; if (!groupBy.has(k)) groupBy.set(k, { label: b.label, start: b.start, end: b.end, days: new Set() }); groupBy.get(k).days.add(b.day); }
  const blocks = [...groupBy.values()].slice(0, 2);
  const st = {
    commit: blocks.length ? (blocks.length > 1 ? 'both' : blocks[0].label === 'School' ? 'school' : 'work') : (av0 ? 'none' : null),
    work: blocks.find((b) => b.label !== 'School') ?? { label: 'Work', start: '09:00', end: '17:00', days: new Set([0, 1, 2, 3, 4]) },
    school: blocks.find((b) => b.label === 'School') ?? { label: 'School', start: '08:00', end: '15:00', days: new Set([0, 1, 2, 3, 4]) },
    wake: av.wakeTime, sleep: av.sleepTime,
    days: av.daysPerWeek ?? p0.trainingDaysTarget ?? 3, minutes: av.sessionMinutes ?? p0.sessionMinutes ?? 60,
    pref: av.preference ?? 'any', env: p0.environment ?? null, style: p0.style ?? null, experience: p0.experience ?? null,
    goal: p0.goal ?? null, birthYear: p0.birthYear ?? null, sex: p0.sex ?? null, activity: p0.activityLevel ?? null,
    heightA: p0.heightCm ? (metric ? Math.round(p0.heightCm) : Math.floor(Math.round(cmToIn(p0.heightCm)) / 12)) : '',
    heightB: p0.heightCm && !metric ? Math.round(cmToIn(p0.heightCm)) % 12 : '',
    weight: lastW ? Math.round((metric ? lastW : kgToLb(lastW)) * 10) / 10 : '',
  };
  const year = new Date().getFullYear();
  const numIn = (key, ph, w = '64px') => h('input', { type: 'number', inputmode: 'decimal', placeholder: ph, value: st[key], style: { width: w, textAlign: 'right' }, onInput: (e) => { st[key] = e.target.value; } });
  const sel = (key, options) => h('select', { onChange: (e) => { st[key] = e.target.value || null; } }, h('option', { value: '' }, 'Choose'), options.map(([v, l]) => h('option', { value: v, selected: String(st[key]) === String(v) }, l)));
  const suffix = (t) => h('span', { class: 'c-2', style: { marginLeft: '4px' } }, t);
  let step = 0;
  const body = h('div', {});
  const dots = h('div', { class: 'wizard__dots' });
  const nav = h('div', { class: 'btn-row' });

  const choice = (title, sub, selected, onClick) => h('button', { class: 'choice', type: 'button', 'aria-pressed': String(selected), onClick: () => { haptic(); onClick(); render(); } },
    h('div', { class: 'choice__title' }, title), sub && h('div', { class: 'choice__sub' }, sub));
  const dayChips = (set) => h('div', { class: 'chips', style: { justifyContent: 'space-between' } }, DAY_SHORT.map((d, i) => h('button', { class: 'chip', type: 'button', style: { padding: 0, width: '13%' }, 'aria-pressed': String(set.has(i)), onClick: (e) => { set.has(i) ? set.delete(i) : set.add(i); e.currentTarget.setAttribute('aria-pressed', String(set.has(i))); haptic(); } }, d.slice(0, 2))));
  const time = (val, on) => TimeField({ value: val, onChange: on });
  const blockEditor = (b, title) => h('div', { class: 'stack' },
    h('div', { class: 't-footnote c-2', style: { fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em' } }, title),
    dayChips(b.days),
    List(FieldRow({ title: 'Starts', control: time(b.start, (v) => { b.start = v; }) }), FieldRow({ title: 'Ends', control: time(b.end, (v) => { b.end = v; }) })));

  const STEPS = [
    { q: 'Do you work or go to school?', hint: 'Kratos plans around anything you can’t move.', ok: () => st.commit, view: () => h('div', { class: 'choice-grid' },
      choice('Work', 'Job or shifts', st.commit === 'work', () => { st.commit = 'work'; }), choice('School', 'Classes', st.commit === 'school', () => { st.commit = 'school'; }),
      choice('Both', 'Work and school', st.commit === 'both', () => { st.commit = 'both'; }), choice('Neither', 'My days are open', st.commit === 'none', () => { st.commit = 'none'; })) },
    { q: 'When are you busy?', hint: 'Tap the days, then set the hours.', skip: () => st.commit === 'none', ok: () => true, view: () => h('div', { class: 'stack' },
      (st.commit === 'work' || st.commit === 'both') && blockEditor(st.work, 'Work'),
      (st.commit === 'school' || st.commit === 'both') && blockEditor(st.school, 'School')) },
    { q: 'When do you wake up and go to bed?', hint: 'Kratos keeps 30 minutes after waking and 90 before bed free.', ok: () => true, view: () => List(
      FieldRow({ title: 'Wake up', iconName: 'sunrise', control: time(st.wake, (v) => { st.wake = v; }) }),
      FieldRow({ title: 'Bedtime', iconName: 'moon', control: time(st.sleep, (v) => { st.sleep = v; }) })) },
    { q: 'How often can you train?', hint: 'Be honest. Consistency beats ambition.', ok: () => true, view: () => h('div', { class: 'stack' },
      List(FieldRow({ title: 'Days per week', control: Stepper({ value: st.days, min: 1, max: 6, onChange: (v) => { st.days = v; } }) })),
      h('div', { class: 'chips', style: { justifyContent: 'space-between' } }, [30, 45, 60, 75, 90].map((m) => h('button', { class: 'chip', type: 'button', style: { flex: 1, padding: 0 }, 'aria-pressed': String(st.minutes === m), onClick: () => { st.minutes = m; haptic(); render(); } }, `${m} min`)))) },
    { q: 'When do you like to train?', hint: 'Kratos picks the best slot that fits.', ok: () => st.pref, view: () => h('div', { class: 'choice-grid' },
      choice('Morning', 'Before the day starts', st.pref === 'morning', () => { st.pref = 'morning'; }), choice('Midday', 'Around lunch', st.pref === 'midday', () => { st.pref = 'midday'; }),
      choice('Evening', 'After work or school', st.pref === 'evening', () => { st.pref = 'evening'; }), choice('Whenever', 'Kratos decides', st.pref === 'any', () => { st.pref = 'any'; })) },
    { q: 'Where do you train?', hint: 'Fine-tune exact equipment anytime in Profile → Gear.', ok: () => st.env, view: () => h('div', { class: 'stack' },
      h('div', { class: 'choice-grid' }, ENVIRONMENTS.map((e) => choice(e.label, `${e.gear.length} items`, st.env === e.id, () => { st.env = e.id; }))),
      h('div', { class: 'choice-grid' }, ['beginner', 'intermediate', 'advanced'].map((x) => choice(x[0].toUpperCase() + x.slice(1), { beginner: '< 1 year', intermediate: '1–3 years', advanced: '3+ years' }[x], st.experience === x, () => { st.experience = x; })))) },
    { q: 'What’s your main goal?', hint: 'Sets your calorie and protein targets.', ok: () => st.goal, view: () => h('div', { class: 'choice-grid' },
      choice('Build muscle', 'Small surplus, high protein', st.goal === 'muscle', () => { st.goal = 'muscle'; }), choice('Lose fat', 'Moderate deficit, keep muscle', st.goal === 'fat_loss', () => { st.goal = 'fat_loss'; }),
      choice('Performance', 'Fuel training', st.goal === 'performance', () => { st.goal = 'performance'; }), choice('Maintain', 'Hold where you are', st.goal === 'maintain', () => { st.goal = 'maintain'; })) },
    { q: 'About your body', hint: 'Used only to calculate your nutrition targets. Stays on this device. Skip anything you’d rather not share.', ok: () => true, view: () => List(
      FieldRow({ title: 'Birth year', control: sel('birthYear', Array.from({ length: 80 }, (_, i) => [year - 10 - i, String(year - 10 - i)])) }),
      FieldRow({ title: 'Sex', control: sel('sex', [['male', 'Male'], ['female', 'Female'], ['unspecified', 'Prefer not to say']]) }),
      FieldRow({ title: 'Height', control: h('span', { class: 'row', style: { gap: '4px' } }, numIn('heightA', metric ? '178' : '5', metric ? '64px' : '36px'), suffix(metric ? 'cm' : 'ft'), !metric && numIn('heightB', '10', '36px'), !metric && suffix('in')) }),
      FieldRow({ title: 'Weight', control: h('span', { class: 'row', style: { gap: '4px' } }, numIn('weight', metric ? '80' : '180', '72px'), suffix(metric ? 'kg' : 'lb')) }),
      FieldRow({ title: 'Daily activity', control: sel('activity', Object.entries(ACTIVITY_LABELS).map(([k, l]) => [k, l.split(' (')[0]])) })) },
    { q: 'What are you building?', hint: 'This sets reps, rest and exercise choice.', ok: () => st.style, view: () => h('div', { class: 'list' }, STYLES.map((x) => h('button', { class: 'list-row', type: 'button', 'aria-pressed': String(st.style === x.id), onClick: () => { st.style = x.id; haptic(); render(); } },
      h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, x.label), h('div', { class: 'list-row__subtitle' }, x.blurb)),
      st.style === x.id ? h('span', { style: { color: '#fff' } }, icon('check', 18)) : null))) },
  ];

  const visible = () => STEPS.map((s, i) => i).filter((i) => !STEPS[i].skip?.());
  function render() {
    const vis = visible();
    const s = STEPS[step];
    dots.replaceChildren(...vis.map((i) => h('i', { class: i === step ? 'on' : '' })));
    body.replaceChildren(h('h2', { class: 'wizard__q' }, s.q), h('p', { class: 'wizard__hint' }, s.hint), s.view());
    const pos = vis.indexOf(step), last = pos === vis.length - 1;
    nav.replaceChildren(...[
      pos > 0 && Button({ label: 'Back', onClick: () => { step = vis[pos - 1]; render(); } }),
      Button({ label: last ? 'Build My Plan' : 'Next', variant: 'primary', iconName: last ? 'sparkle' : null, disabled: !s.ok(), onClick: () => (last ? finish() : (step = vis[pos + 1], render())) })].filter(Boolean));
  }

  async function finish() {
    const busy = [];
    const add = (b, label) => { for (const d of b.days) if (b.end > b.start) busy.push({ day: d, start: b.start, end: b.end, label }); };
    if (st.commit === 'work' || st.commit === 'both') add(st.work, 'Work');
    if (st.commit === 'school' || st.commit === 'both') add(st.school, 'School');
    const env = ENVIRONMENTS.find((e) => e.id === st.env);
    const availability = { ...av, kind: 'availability', busy, free: [], wakeTime: st.wake, sleepTime: st.sleep, daysPerWeek: st.days, sessionMinutes: st.minutes, preference: st.pref };
    const profilePatch = { environment: st.env, style: st.style, experience: st.experience ?? p0.experience, trainingDaysTarget: st.days, sessionMinutes: st.minutes, goal: st.goal };
    if (st.birthYear) profilePatch.birthYear = Number(st.birthYear);
    if (st.sex) profilePatch.sex = st.sex;
    if (st.activity) profilePatch.activityLevel = st.activity;
    const hcm = metric ? Number(st.heightA) : inToCm(Number(st.heightA || 0) * 12 + Number(st.heightB || 0));
    if (st.heightA !== '' && hcm >= 50 && hcm <= 272) profilePatch.heightCm = Math.round(hcm * 10) / 10;
    const wkg = st.weight === '' ? null : (metric ? Number(st.weight) : lbToKg(Number(st.weight)));
    if (wkg && wkg >= 20 && wkg <= 400 && (lastW == null || Math.abs(wkg - lastW) > 0.05)) await repo.create('bodyMetrics', { date: localDateKey(), weightKg: Math.round(wkg * 100) / 100, provenance: 'recorded' });
    if (env && (!p0.gear || p0.environment !== st.env)) profilePatch.gear = env.gear;
    await repo.updateProfile(profilePatch);
    await saveAvailability(availability);
    const profile = await repo.getProfile();
    const plan = planWeek({ availability, profile, today: new Date() });
    await savePlan(plan);
    haptic('success');
    island.flash({ icon: 'sparkle', title: 'Plan ready', subtitle: `${plan.sessions.length} sessions · ${plan.sessions.map((x) => DAY_SHORT[x.day]).join(', ')}`, duration: 4500 });
    navigate('#/kratos', { replace: true });
  }

  root.append(NavHeader({ title: 'Setup', back: { href: '#/kratos', label: 'Kratos' } }), dots, body, nav);
  document.body.classList.add('focus-flow');
  render();
  return () => document.body.classList.remove('focus-flow');
}

export { icon };
