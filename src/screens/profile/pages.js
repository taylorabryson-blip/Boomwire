/** Profile drill-downs: Personal Info, Goals & Style, Gear. Each saves as you go. */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, List, ListRow, FieldRow, Select, Stepper, Button, Search, Card } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { regeneratePlan } from '../../services/coach.js';
import { GEAR_CATEGORIES, GEAR, ENVIRONMENTS, STYLES, FOCUS_AREAS, exercisesForGear } from '../../data/exercises/gear.js';
import { EXERCISES } from '../../data/exercises/exercises.js';
import { ACTIVITY_LABELS } from '../../engines/nutrition/nutrition.js';
import { isDeveloping } from '../../data/models.js';
import { heightString, cmToIn, inToCm, weightString, kgToLb, lbToKg } from '../../utils/units.js';
import { localDateKey } from '../../utils/dates.js';
import { liveScreen } from '../shared/live.js';

let replanTimer = null;
async function save(patch) {
  await repo.updateProfile(patch);
  clearTimeout(replanTimer);
  replanTimer = setTimeout(() => regeneratePlan().catch(() => {}), 500);
}

/* --------------------------------------------------------------- Personal */
export function personal(root) {
  return liveScreen(root, async () => {
    const [p, settings, metrics] = await Promise.all([repo.getProfile(), repo.getSettings(), repo.list('bodyMetrics')]);
    const lastW = metrics.filter((m) => m.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0];
    const year = new Date().getFullYear();
    const name = h('input', { type: 'text', placeholder: 'Name', value: p.displayName ?? '', maxlength: '40', autocomplete: 'given-name', onChange: (e) => save({ displayName: e.target.value.trim() || null }) });
    return [
      NavHeader({ title: 'Personal Info', back: { href: '#/profile', label: 'Profile' } }),
      List(
        FieldRow({ title: 'Name', control: name }),
        FieldRow({ title: 'Birth year', control: Select({ value: p.birthYear, onChange: (v) => save({ birthYear: v ? Number(v) : null }), options: Array.from({ length: 80 }, (_, i) => ({ value: year - 10 - i, label: String(year - 10 - i) })) }) }),
        FieldRow({ title: 'Sex', control: Select({ value: p.sex, onChange: (v) => save({ sex: v }), options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'unspecified', label: 'Prefer not to say' }] }) }),
        ListRow({ title: 'Height', value: p.heightCm ? heightString(p.heightCm, settings.units) : 'Not set', onClick: () => heightSheet(p, settings.units) }),
        FieldRow({ title: 'Activity', control: Select({ value: p.activityLevel, onChange: (v) => save({ activityLevel: v }), options: Object.entries(ACTIVITY_LABELS).map(([k, l]) => ({ value: k, label: l.split(' (')[0] })) }) }),
        ListRow({ title: 'Weight', value: lastW ? weightString(lastW.weightKg, settings.units) : 'Not set', onClick: () => weightSheet(lastW, settings.units) })),
      h('p', { class: 'section__footer' }, isDeveloping(p) ? 'You’re still growing: Hercules never suggests calorie restriction for you.' : 'Used for nutrition targets and planning. Stays on this device.'),
    ];
  });
}

function weightSheet(last, u) {
  const metric = u === 'metric';
  const a = h('input', { type: 'number', inputmode: 'decimal', placeholder: metric ? '80' : '180', value: last ? Math.round((metric ? last.weightKg : kgToLb(last.weightKg)) * 10) / 10 : '' });
  const err = h('div', { class: 'field-error' });
  const sheet = openSheet({ title: 'Today’s Weight', content: h('div', { class: 'stack' },
    h('label', { class: 'field' }, a, h('span', { class: 'field__suffix' }, metric ? 'kg' : 'lb')), err,
    Button({ label: 'Save', variant: 'primary', block: true, onClick: async () => {
      const kg = metric ? Number(a.value) : lbToKg(Number(a.value));
      if (!(kg >= 20 && kg <= 400)) { err.textContent = 'That weight doesn’t look right.'; return; }
      await repo.create('bodyMetrics', { date: localDateKey(), weightKg: Math.round(kg * 100) / 100, provenance: 'recorded' });
      haptic('success'); sheet.close(); regeneratePlan().catch(() => {});
    } })) });
}

function heightSheet(p, u) {
  const metric = u === 'metric';
  const totalIn = p.heightCm ? Math.round(cmToIn(p.heightCm)) : null;
  const a = h('input', { type: 'number', inputmode: 'numeric', placeholder: metric ? '178' : '5', value: metric ? (p.heightCm ? Math.round(p.heightCm) : '') : (totalIn != null ? Math.floor(totalIn / 12) : '') });
  const b = h('input', { type: 'number', inputmode: 'numeric', placeholder: '10', value: totalIn != null ? totalIn % 12 : '' });
  const err = h('div', { class: 'field-error' });
  const sheet = openSheet({ title: 'Height', content: h('div', { class: 'stack' },
    h('div', { class: 'row' }, h('label', { class: 'field grow' }, a, h('span', { class: 'field__suffix' }, metric ? 'cm' : 'ft')), !metric && h('label', { class: 'field grow' }, b, h('span', { class: 'field__suffix' }, 'in'))),
    err,
    Button({ label: 'Save', variant: 'primary', block: true, onClick: async () => {
      const cm = metric ? Number(a.value) : inToCm(Number(a.value) * 12 + Number(b.value || 0));
      if (!Number.isFinite(cm) || cm < 50 || cm > 272) { err.textContent = 'That height doesn’t look right.'; return; }
      haptic('success'); await save({ heightCm: cm }); sheet.close();
    } })) });
}

/* ------------------------------------------------------------ Goals/style */
export function style(root) {
  return liveScreen(root, async () => {
    const p = await repo.getProfile();
    const focus = new Set(p.focusAreas ?? []);
    return [
      NavHeader({ title: 'Goals & Style', back: { href: '#/profile', label: 'Profile' } }),
      List(
        FieldRow({ title: 'Experience', control: Select({ value: p.experience, onChange: (v) => save({ experience: v }), options: [{ value: 'beginner', label: 'Beginner (< 1 yr)' }, { value: 'intermediate', label: 'Intermediate (1–3 yrs)' }, { value: 'advanced', label: 'Advanced (3+ yrs)' }] }) }),
        FieldRow({ title: 'Main goal', control: Select({ value: p.goal, onChange: (v) => save({ goal: v }), options: [{ value: 'muscle', label: 'Build muscle' }, { value: 'fat_loss', label: 'Lose fat' }, { value: 'performance', label: 'Performance' }, { value: 'consistency', label: 'Consistency' }, { value: 'maintain', label: 'Maintain' }] }) }),
        ListRow({ iconName: 'target', title: 'Focus areas', value: focus.size ? FOCUS_AREAS.filter((f) => focus.has(f.id)).map((f) => f.label).join(', ') : 'None', onClick: () => {
        const chips = h('div', { class: 'chips' });
        const paint = () => chips.replaceChildren(...FOCUS_AREAS.map((f) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(focus.has(f.id)), onClick: () => {
          if (focus.has(f.id)) focus.delete(f.id); else if (focus.size < 3) focus.add(f.id); else { toast('Three max', { iconName: 'info' }); return; }
          haptic(); paint();
        } }, f.label)));
        paint();
        openSheet({ title: 'Focus Areas', content: h('div', { class: 'stack' }, h('p', { class: 't-footnote c-2', style: { margin: 0 } }, 'Pick up to three. Kratos adds extra volume here.'), chips), onClose: () => save({ focusAreas: [...focus] }) });
      } })),
      h('div', {},
        h('div', { class: 'list' }, STYLES.map((s) => h('button', { class: 'list-row', type: 'button', 'aria-pressed': String(p.style === s.id), onClick: () => { haptic(); save({ style: s.id }); } },
          h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, s.label)),
          p.style === s.id ? h('span', { style: { color: '#fff' } }, icon('check', 18)) : null))),
        h('p', { class: 'section__footer' }, STYLES.find((s) => s.id === p.style)?.blurb ?? 'Pick a style — it sets reps, rest and exercise choice.')),
    ];
  });
}

/* ------------------------------------------------------------------- Gear */
let gearQuery = '';
export async function gear(root) {
  let p = await repo.getProfile();
  let owned = new Set(p.gear ?? []);
  const summary = h('div', { class: 't-footnote c-2', style: { padding: '0 4px' } });
  const listWrap = h('div', {});
  const persist = async () => { await save({ gear: [...owned] }); p = await repo.getProfile(); updateSummary(); };
  const updateSummary = () => {
    summary.textContent = p.gear == null
      ? `Not set — all ${EXERCISES.length} exercises available. Pick a preset or your items.`
      : `${owned.size} of ${GEAR.length} items · ${exercisesForGear([...owned]).length} of ${EXERCISES.length} exercises available`;
  };
  const check = (on) => h('span', { class: 'set-check', style: on ? { background: '#30d158', color: '#000' } : null }, icon('check', 16));

  function openCategory(c) {
    const body = h('div', {});
    const allBtn = h('button', { class: 'btn btn--sm', type: 'button', onClick: () => {
      const all = c.items.every(([id]) => owned.has(id));
      c.items.forEach(([id]) => (all ? owned.delete(id) : owned.add(id))); haptic(); persist(); paint();
    } });
    function paint() {
      allBtn.textContent = c.items.every(([id]) => owned.has(id)) ? 'Select None' : 'Select All';
      body.replaceChildren(h('div', { class: 'list' }, c.items.map(([id, label]) => row({ id, label }, paint))));
    }
    paint();
    openSheet({ title: c.label, content: h('div', { class: 'stack' }, allBtn, body), onClose: render });
  }

  function render() {
    const q = gearQuery.trim().toLowerCase();
    if (q) {
      const items = GEAR.filter((g) => g.label.toLowerCase().includes(q));
      listWrap.replaceChildren(items.length ? h('div', { class: 'list' }, items.slice(0, 8).map((g) => row(g, render))) : Card({}, h('div', { class: 't-subhead c-2' }, 'No equipment matches.')));
      return;
    }
    listWrap.replaceChildren(h('div', { class: 'list' }, GEAR_CATEGORIES.map((c) => {
      const n = c.items.filter(([id]) => owned.has(id)).length;
      return ListRow({ title: c.label, value: `${n} of ${c.items.length}`, onClick: () => openCategory(c) });
    })));
  }
  function row(g, after) {
    return h('button', { class: 'list-row', type: 'button', onClick: () => { owned.has(g.id) ? owned.delete(g.id) : owned.add(g.id); haptic(); persist(); after(); } },
      h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, g.label)), check(owned.has(g.id)));
  }

  root.append(
    NavHeader({ title: 'Gear', back: { href: '#/profile', label: 'Profile' } }),
    h('div', { class: 'chips chips--scroll' }, ENVIRONMENTS.map((e) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(p.environment === e.id), onClick: async (ev) => {
      owned = new Set(e.gear); await save({ environment: e.id, gear: e.gear }); p = await repo.getProfile();
      ev.currentTarget.parentElement.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === ev.currentTarget)));
      haptic('success'); toast(`${e.label} preset`, { subtitle: `${e.gear.length} items selected` }); updateSummary(); render();
    } }, e.label))),
    Search({ placeholder: `Search ${GEAR.length} items`, value: gearQuery, onInput: (v) => { gearQuery = v; render(); } }),
    summary, listWrap);
  updateSummary(); render();
}

export const mountPersonal = personal, mountStyle = style, mountGear = gear;
