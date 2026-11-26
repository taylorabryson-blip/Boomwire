/**
 * Profile — who you are and how you train. Saves as you go (iOS Settings style).
 * Gear, environment, style and focus areas drive Kratos' exercise selection.
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { herculesMark } from '../../components/brand.js';
import { NavHeader, Section, List, ListRow, FieldRow, Select, Stepper, Card, Button } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { getAvailability, regeneratePlan } from '../../services/coach.js';
import { GEAR, ENVIRONMENTS, STYLES, FOCUS_AREAS } from '../../data/exercises/gear.js';
import { approxAge, isDeveloping } from '../../data/models.js';
import { heightString, cmToIn, inToCm } from '../../utils/units.js';
import { liveScreen } from '../shared/live.js';

let replanTimer = null;
async function save(patch) {
  await repo.updateProfile(patch);
  clearTimeout(replanTimer);
  replanTimer = setTimeout(async () => { if (await getAvailability()) await regeneratePlan(); }, 600);
}

export function mount(root) {
  return liveScreen(root, async () => {
    const [p, settings] = await Promise.all([repo.getProfile(), repo.getSettings()]);
    const u = settings.units;
    const year = new Date().getFullYear();
    const gear = new Set(p.gear ?? []);
    const focus = new Set(p.focusAreas ?? []);
    const age = approxAge(p);

    const nameInput = h('input', { type: 'text', placeholder: 'Name', value: p.displayName ?? '', maxlength: '40', autocomplete: 'given-name',
      onChange: (e) => save({ displayName: e.target.value.trim() || null }) });

    return [
      NavHeader({ title: 'Profile', back: { href: '#/home', label: 'Today' } }),
      Section({ first: true },
        Card({ glass: true }, h('div', { class: 'row' },
          h('div', { style: { width: '56px', height: '56px', borderRadius: '50%', background: 'var(--c-surface-3)', display: 'grid', placeItems: 'center', flex: 'none' } }, herculesMark(32)),
          h('div', { class: 'grow' }, h('div', { class: 't-title-3' }, p.displayName || 'Your profile'),
            h('div', { class: 't-footnote c-2' }, [age != null && `~${age} yrs`, p.heightCm && heightString(p.heightCm, u), p.experience].filter(Boolean).join(' · ') || 'Fill this in so Kratos can coach you properly.'))))),
      Section({ title: 'About You', footer: isDeveloping(p) ? 'You’re still growing: Hercules never suggests calorie restriction or aggressive weight goals for you.' : 'Used for planning now and nutrition estimates later. Stays on this device.' },
        List(
          FieldRow({ title: 'Name', control: nameInput }),
          FieldRow({ title: 'Birth year', control: Select({ value: p.birthYear, onChange: (v) => save({ birthYear: v ? Number(v) : null }), options: Array.from({ length: 80 }, (_, i) => ({ value: year - 10 - i, label: String(year - 10 - i) })) }) }),
          FieldRow({ title: 'Sex', control: Select({ value: p.sex, onChange: (v) => save({ sex: v }), options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'unspecified', label: 'Prefer not to say' }] }) }),
          ListRow({ title: 'Height', value: p.heightCm ? heightString(p.heightCm, u) : 'Not set', onClick: () => heightSheet(p, u) }),
          FieldRow({ title: 'Experience', control: Select({ value: p.experience, onChange: (v) => save({ experience: v }), options: [{ value: 'beginner', label: 'Beginner (< 1 yr)' }, { value: 'intermediate', label: 'Intermediate (1–3 yrs)' }, { value: 'advanced', label: 'Advanced (3+ yrs)' }] }) }),
          FieldRow({ title: 'Main goal', control: Select({ value: p.goal, onChange: (v) => save({ goal: v }), options: [{ value: 'muscle', label: 'Build muscle' }, { value: 'performance', label: 'Athletic performance' }, { value: 'consistency', label: 'Be consistent' }, { value: 'maintain', label: 'Maintain' }] }) }))),
      Section({ title: 'Desired Build', footer: 'Shapes reps, rest and exercise choice in Kratos’ plans. Genetics, sleep and nutrition matter too — no app can promise a physique.' },
        List(...STYLES.map((s) => ListRow({ title: s.label, subtitle: s.blurb, chevron: false, onClick: () => save({ style: s.id }),
          trailing: p.style === s.id ? h('span', { style: { color: '#30d158' } }, icon('check', 20)) : null })))),
      Section({ title: 'Focus Areas', footer: 'Pick up to three areas you want to bring up.' },
        h('div', { class: 'chips' }, FOCUS_AREAS.map((f) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(focus.has(f.id)), onClick: () => {
          if (focus.has(f.id)) focus.delete(f.id); else if (focus.size < 3) focus.add(f.id); else { toast('Three max', { iconName: 'info' }); return; }
          save({ focusAreas: [...focus] });
        } }, f.label)))),
      Section({ title: 'Where You Train' },
        h('div', { class: 'chips' }, ENVIRONMENTS.map((e) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String(p.environment === e.id), onClick: () => save({ environment: e.id, gear: e.gear }) }, e.label)))),
      Section({ title: 'Your Gear', footer: 'Kratos only programs exercises you can do with this equipment.' },
        List(...GEAR.map((g) => ListRow({ title: g.label, chevron: false, onClick: () => { gear.has(g.id) ? gear.delete(g.id) : gear.add(g.id); save({ gear: [...gear] }); },
          trailing: h('span', { class: 'set-check', style: gear.has(g.id) ? { background: '#30d158', color: '#000' } : null }, icon('check', 16)) })))),
      Section({ title: 'Training Defaults', footer: 'Kratos uses these unless you tell him otherwise in chat.' },
        List(
          FieldRow({ title: 'Days per week', control: Stepper({ value: p.trainingDaysTarget ?? 3, min: 1, max: 6, onChange: (v) => save({ trainingDaysTarget: v }) }) }),
          FieldRow({ title: 'Session length', control: Stepper({ value: p.sessionMinutes ?? 60, min: 20, max: 120, step: 5, format: (v) => `${v}m`, onChange: (v) => save({ sessionMinutes: v }) }) }))),
      Section({}, List(
        ListRow({ iconName: 'bell', title: 'Notifications', href: '#/notifications' }),
        ListRow({ iconName: 'settings', title: 'Settings', href: '#/settings' }))),
    ];
  });
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
