import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, Section, Card, List, ListRow, EmptyState, Stat, Provenance } from '../../components/primitives.js';
import * as repo from '../../services/storage/repository.js';
import { localDateKey, addDays, formatLongDate, formatRelativeDay } from '../../utils/dates.js';
import { volumeString } from '../../utils/units.js';
import { dailyTotal } from '../../engines/calculations/hydration.js';
import { HydrationCard } from '../shared/hydration-ui.js';
import { liveScreen } from '../shared/live.js';

export function mount(root) {
  return liveScreen(root, async () => {
    const today = localDateKey();
    const weekStart = addDays(today, -6);
    const [settings, water, foodToday, workouts7, recovery7, recentWater] = await Promise.all([
      repo.getSettings(),
      repo.listByDate('hydrationLogs', today),
      repo.listByDate('foodLogs', today),
      repo.listByDate('workouts', weekStart, today),
      repo.listByDate('recoveryLogs', weekStart, today),
      repo.list('hydrationLogs'),
    ]);

    const totalMl = dailyTotal(water, today);
    const recent = recentWater.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);

    return [
      NavHeader({
        eyebrow: formatLongDate(today), title: 'Today',
        trailing: h('a', { class: 'icon-btn', href: '#/settings', 'aria-label': 'Settings' }, icon('settings', 20)),
      }),

      Section({ title: 'Hydration' }, HydrationCard({ totalMl, entries: water.length, settings })),

      Section({ title: 'Nutrition' },
        Card({ label: 'Calories', iconName: 'flame' },
          foodToday.length
            ? Stat({ value: String(foodToday.length), label: 'entries today' })
            : EmptyState({ inline: true, title: 'No food logged today', body: 'Calorie and macro tracking is built in Phase 5. Targets will appear here once set.' }))),

      Section({ title: 'This Week' },
        h('div', { class: 'grid-2' },
          Card({ label: 'Training', iconName: 'training' },
            Stat({ value: String(workouts7.length), unit: workouts7.length === 1 ? 'session' : 'sessions', label: 'last 7 days' })),
          Card({ label: 'Recovery', iconName: 'moon' },
            recovery7.length
              ? Stat({ value: String(recovery7.length), unit: 'logs', label: 'last 7 days' })
              : Stat({ value: '—', label: 'no sleep logged' })))),

      Section({ title: 'Recent Activity' },
        recent.length
          ? List(...recent.map((r) => ListRow({
              iconName: 'drop', title: `Water · ${volumeString(r.amountMl, settings.units)}`,
              subtitle: `${formatRelativeDay(r.date, today)} at ${r.time}`, trailing: Provenance(r.provenance),
            })))
          : Card({}, EmptyState({ inline: true, title: 'Nothing logged yet', body: 'Entries you record will show up here.' }))),
    ];
  });
}
