import { h } from '../../components/dom.js';
import { NavHeader, Section, Card, List, ListRow, EmptyState, RoadmapRow, Provenance } from '../../components/primitives.js';
import { openSheet } from '../../components/overlays.js';
import { Button } from '../../components/primitives.js';
import * as repo from '../../services/storage/repository.js';
import { localDateKey } from '../../utils/dates.js';
import { volumeString } from '../../utils/units.js';
import { dailyTotal } from '../../engines/calculations/hydration.js';
import { HydrationCard } from '../shared/hydration-ui.js';
import { liveScreen } from '../shared/live.js';
import { toast } from '../../components/overlays.js';
import { getPlan } from '../../services/coach.js';
import { DAY_SHORT, fmt12, toMin } from '../../engines/coach/parser.js';
import { kratosAvatar } from '../../components/brand.js';

function confirmDelete(entry, settings) {
  const sheet = openSheet({ title: 'Delete Entry', content: h('div', { class: 'stack' },
    h('p', { class: 't-subhead c-2', style: { margin: 0 } }, `Remove ${volumeString(entry.amountMl, settings.units)} logged at ${entry.time}?`),
    Button({ label: 'Delete', variant: 'danger', block: true, onClick: async () => {
      sheet.close();
      await repo.remove('hydrationLogs', entry.id);
      toast('Entry deleted', { actionLabel: 'Undo', onAction: () => repo.restore('hydrationLogs', entry.id) });
    } })) });
}

export function mount(root) {
  return liveScreen(root, async () => {
    const today = localDateKey();
    const [settings, water, plan] = await Promise.all([repo.getSettings(), repo.listByDate('hydrationLogs', today), getPlan()]);
    const todayIdx = (new Date().getDay() + 6) % 7;
    const meals = plan?.nutrition?.meals ?? [];
    const entries = water.sort((a, b) => b.time.localeCompare(a.time) || b.createdAt.localeCompare(a.createdAt));
    return [
      NavHeader({ title: 'Nutrition' }),
      Section({ title: 'Water' }, HydrationCard({ totalMl: dailyTotal(water, today), entries: water.length, settings })),
      Section({ title: 'Today’s Entries', footer: entries.length ? 'Tap an entry to delete it.' : null },
        entries.length
          ? List(...entries.map((e) => ListRow({ title: volumeString(e.amountMl, settings.units), subtitle: e.time, trailing: Provenance(e.provenance), onClick: () => confirmDelete(e, settings), chevron: false })))
          : Card({}, EmptyState({ inline: true, title: 'No water logged today', body: 'Use the buttons above to log an entry.' }))),
      meals.length && Section({ title: 'Fuel Timing', footer: 'From Kratos’ plan: a meal about 2 hours before training (or a light snack if that’s too early) and a protein-rich meal within about 2 hours after.' },
        List(...meals.map((m) => ListRow({ iconNode: kratosAvatar(30), title: `${DAY_SHORT[m.day]}${m.day === todayIdx ? ' · today' : ''}`,
          subtitle: `${m.pre.kind === 'snack' ? 'Snack' : 'Meal'} ${fmt12(toMin(m.pre.time))} · Protein meal by ${fmt12(toMin(m.post.time))}` })))),
      Section({ title: 'Food', footer: 'Nutrient values will come from verified sources such as USDA FoodData Central. User-entered foods will be labelled as such.' },
        List(
          RoadmapRow({ iconName: 'flame', title: 'Calorie & macro tracking', subtitle: 'Meals, servings, daily targets', phase: 5 }),
          RoadmapRow({ iconName: 'database', title: 'Food database', subtitle: 'Search, custom foods, saved meals', phase: 5 }),
          RoadmapRow({ iconName: 'target', title: 'Personalized targets', subtitle: 'Estimates with stated limitations', phase: 5 }))),
    ];
  });
}
