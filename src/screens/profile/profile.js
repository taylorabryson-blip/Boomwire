/** Profile — one screen of destinations (Apple Settings style). */
import { h } from '../../components/dom.js';
import { herculesMark } from '../../components/brand.js';
import { NavHeader, Card, List, ListRow } from '../../components/primitives.js';
import * as repo from '../../services/storage/repository.js';
import { approxAge } from '../../data/models.js';
import { STYLES } from '../../data/exercises/gear.js';
import { heightString } from '../../utils/units.js';
import { liveScreen } from '../shared/live.js';
import { activeTargets } from '../../services/nutrition/log.js';

export function mount(root) {
  return liveScreen(root, async () => {
    const [p, settings, targets] = await Promise.all([repo.getProfile(), repo.getSettings(), activeTargets()]);
    const age = approxAge(p);
    return [
      NavHeader({ title: 'Profile', back: { href: '#/home', label: 'Today' } }),
      Card({ glass: true, href: '#/profile-personal' }, h('div', { class: 'row' },
        h('div', { style: { width: '56px', height: '56px', borderRadius: '50%', background: 'var(--c-surface-3)', display: 'grid', placeItems: 'center', flex: 'none' } }, herculesMark(34)),
        h('div', { class: 'grow' }, h('div', { class: 't-title-3' }, p.displayName || 'Your profile'),
          h('div', { class: 't-footnote c-2' }, [age != null && `~${age} yrs`, p.heightCm && heightString(p.heightCm, settings.units), p.experience].filter(Boolean).join(' · ') || 'Tap to add your details')))),
      List(
        ListRow({ iconName: 'user', title: 'Personal Info', href: '#/profile-personal' }),
        p.mode === 'nutrition'
          ? ListRow({ iconName: 'target', title: 'Goals', value: { muscle: 'Bulk', fat_loss: 'Cut', maintain: 'Maintain' }[p.goal] ?? 'Not set', href: '#/profile-style' })
          : ListRow({ iconName: 'target', title: 'Goals & Style', value: STYLES.find((s) => s.id === p.style)?.label ?? 'Not set', href: '#/profile-style' }),
        p.mode !== 'nutrition' && ListRow({ iconName: 'gear', title: 'Equipment', value: p.gear ? `${p.gear.length} items` : 'Not set', href: '#/gear' }),
        ListRow({ iconName: 'apple', title: 'Nutrition Targets', value: targets && !targets.missing ? `${targets.kcal} kcal` : 'Not set', href: '#/nutrition-targets' })),
      List(ListRow({ iconName: 'settings', title: 'Settings', href: '#/settings' })),
    ];
  });
}
