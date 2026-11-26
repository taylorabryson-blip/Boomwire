/** Calorie & macro targets: Auto (Mifflin-St Jeor, shown with its working) or Manual. */
import { h } from '../../components/dom.js';
import { NavHeader, Section, Card, List, ListRow, FieldRow, Select, SegmentedControl, Button, Provenance } from '../../components/primitives.js';
import { toast, openSheet } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { navigate } from '../../navigation/nav.js';
import { computeTargets, ACTIVITY_LABELS, ACTIVITY_FACTORS } from '../../engines/nutrition/nutrition.js';
import { approxAge } from '../../data/models.js';
import { weightString, heightString } from '../../utils/units.js';
import { liveScreen } from '../shared/live.js';

const GOAL_OPTS = [{ value: 'maintain', label: 'Maintain weight' }, { value: 'muscle', label: 'Build muscle (+10%)' }, { value: 'fat_loss', label: 'Lose fat (−15%)' }, { value: 'performance', label: 'Performance (+5%)' }, { value: 'consistency', label: 'Consistency' }];

export function mount(root) {
  return liveScreen(root, async (refresh) => {
    const [settings, profile, metrics] = await Promise.all([repo.getSettings(), repo.getProfile(), repo.list('bodyMetrics')]);
    const mode = settings.nutritionTargets?.mode ?? 'auto';
    const w = metrics.filter((m) => m.weightKg != null).sort((a, b) => b.date.localeCompare(a.date))[0];
    const age = approxAge(profile);
    const t = computeTargets({ weightKg: w?.weightKg, heightCm: profile.heightCm, age, sex: profile.sex, activityLevel: profile.activityLevel, goal: profile.goal });
    const setMode = (m) => repo.updateSettings({ nutritionTargets: { ...(settings.nutritionTargets ?? {}), mode: m } });
    const header = NavHeader({ title: 'Targets', back: { href: '#/nutrition', label: 'Nutrition' } });
    const seg = SegmentedControl({ label: 'Mode', value: mode, onChange: setMode, options: [{ value: 'auto', label: 'Personalized' }, { value: 'manual', label: 'Manual' }] });

    if (mode === 'manual') {
      const cur = settings.nutritionTargets ?? {};
      const inp = (k, ph) => h('input', { type: 'number', inputmode: 'numeric', min: '0', placeholder: ph, value: cur[k] ?? '', style: { width: '110px' }, 'data-k': k });
      const fields = { kcal: inp('kcal', '2400'), protein: inp('protein', '160'), carbs: inp('carbs', '260'), fat: inp('fat', '75'), fiber: inp('fiber', '30') };
      return [header, seg,
        List(FieldRow({ title: 'Calories', control: fields.kcal }), FieldRow({ title: 'Protein (g)', control: fields.protein }), FieldRow({ title: 'Carbs (g)', control: fields.carbs }), FieldRow({ title: 'Fat (g)', control: fields.fat }), FieldRow({ title: 'Fiber (g)', control: fields.fiber })),
        Button({ label: 'Save Targets', variant: 'primary', block: true, onClick: async () => {
          const v = Object.fromEntries(Object.entries(fields).map(([k, el]) => [k, el.value === '' ? null : Math.round(Number(el.value))]));
          if (!(v.kcal >= 800 && v.kcal <= 8000)) { toast('Calories must be 800–8000', { iconName: 'info' }); return; }
          await repo.updateSettings({ nutritionTargets: { mode: 'manual', ...v } }); toast('Targets saved', { iconName: 'target' }); navigate('#/nutrition');
        } })];
    }

    const explain = t.missing?.length ? '' : `Mifflin-St Jeor resting energy ${t.bmr} kcal × activity ${ACTIVITY_FACTORS[profile.activityLevel]} = ${t.tdee} kcal maintenance${t.goalApplied !== 'maintain' && t.goalApplied !== 'consistency' ? `, then ${t.goalApplied === 'fat_loss' ? '−15%' : t.goalApplied === 'muscle' ? '+10%' : '+5%'} for your goal` : ''}. Protein is set per kg of body weight for your goal. Fat is 27.5% of calories, carbs fill the rest, fiber 14 g per 1,000 kcal.${t.developing ? ' You’re still growing, so targets never go below maintenance.' : ''} These are estimates — real needs vary ±10% or more. Adjust with Manual mode anytime.`;
    return [header, seg,
      Card({ badge: Provenance('estimated') },
        t.missing?.length
          ? h('div', {}, h('div', { class: 't-headline' }, 'A few details needed'), h('p', { class: 't-subhead c-2', style: { margin: '4px 0 0' } }, `Add your ${t.missing.join(', ')} to personalize targets.`))
          : h('div', { class: 'tiles', style: { gridTemplateColumns: 'repeat(4, minmax(0,1fr))' } },
            ...[['kcal', t.kcal, ''], ['protein', t.protein, 'g'], ['carbs', t.carbs, 'g'], ['fat', t.fat, 'g']].map(([l, v, u]) => h('div', {}, h('div', { class: 'tile__value' }, String(v), h('span', { class: 'stat__unit' }, u)), h('div', { class: 'tile__label' }, l))))),
      List(
        FieldRow({ title: 'Activity', control: Select({ value: profile.activityLevel, onChange: (v) => repo.updateProfile({ activityLevel: v }), options: Object.entries(ACTIVITY_LABELS).map(([k, l]) => ({ value: k, label: l.split(' (')[0] })) }) }),
        FieldRow({ title: 'Goal', control: Select({ value: profile.goal, onChange: (v) => repo.updateProfile({ goal: v }), options: GOAL_OPTS }) }),
        ListRow({ title: 'Weight', value: w ? weightString(w.weightKg, settings.units) : 'Add', href: '#/profile-personal' }),
        ListRow({ title: 'Height · age · sex', value: [profile.heightCm ? heightString(profile.heightCm, settings.units) : null, age ? `${age}` : null, profile.sex && profile.sex !== 'unspecified' ? profile.sex[0].toUpperCase() : null].filter(Boolean).join(' · ') || 'Add', href: '#/profile-personal' }),
        !t.missing?.length && ListRow({ iconName: 'info', title: 'How it’s calculated', onClick: () => openSheet({ title: 'How Targets Work', content: h('p', { class: 't-subhead c-2', style: { margin: 0, lineHeight: 1.45 } }, explain) }) })),
    ];
  });
}
