import { h } from '../../components/dom.js';
import { NavHeader, Section, Card, List, ListRow, Provenance, Stat, SegmentedControl } from '../../components/primitives.js';
import { BarChart } from '../../components/bar-chart.js';
import * as repo from '../../services/storage/repository.js';
import { STORE_LABELS } from '../../data/models.js';
import { lastNDays, localDateKey, weekdayInitial, parseDateKey } from '../../utils/dates.js';
import { formatVolume, volumeString } from '../../utils/units.js';
import { dailyTotals, loggedDayAverage, daysMeetingGoal } from '../../engines/calculations/hydration.js';
import { liveScreen } from '../shared/live.js';

let range = 7; // view state survives re-render

export function mount(root) {
  return liveScreen(root, async (refresh) => {
    const today = localDateKey();
    const keys = lastNDays(range, today);
    const [settings, logs] = await Promise.all([repo.getSettings(), repo.listByDate('hydrationLogs', keys[0], today)]);
    const totals = dailyTotals(logs, keys);
    const avg = loggedDayAverage(totals);
    const logged = totals.filter((t) => t.logged).length;
    const met = daysMeetingGoal(totals, settings.hydrationGoalMl);
    const avgV = formatVolume(avg, settings.units);

    const label = (k) => (range === 7 ? weekdayInitial(k) : (parseDateKey(k).getDate() % 5 === 0 ? String(parseDateKey(k).getDate()) : ''));
    const counts = await Promise.all(['hydrationLogs', 'workouts', 'foodLogs', 'bodyMetrics', 'recoveryLogs'].map(async (s) => [s, await repo.countAlive(s)]));

    return [
      NavHeader({ title: 'Analytics' }),
      Section({ title: 'Hydration', footer: 'Average = mean daily total across logged days only. Days with no entries are excluded, not counted as zero.' },
        Card({ label: 'Water intake', iconName: 'drop', badge: Provenance('recorded') },
          SegmentedControl({ label: 'Range', value: range, options: [{ value: 7, label: '7 Days' }, { value: 30, label: '30 Days' }],
            onChange: (v) => { range = v; refresh(); } }),
          h('div', { class: 'row row--between', style: { margin: '16px 0 12px', alignItems: 'flex-end' } },
            Stat({ value: avgV.value, unit: avgV.unit, label: 'daily average' }),
            h('div', { style: { textAlign: 'right' } },
              h('div', { class: 't-headline num' }, `${logged}/${range}`),
              h('div', { class: 't-footnote c-2' }, 'days logged'))),
          BarChart({ bars: totals.map((t) => ({ label: label(t.date), value: t.logged ? t.totalMl : null, highlight: t.date === today })),
            goal: settings.hydrationGoalMl, formatMax: (v) => volumeString(v, settings.units) }),
          met != null && h('div', { class: 't-footnote c-2', style: { marginTop: '10px' } }, `Goal met on ${met} of ${logged} logged days · dashed line = goal`))),
      Section({ title: 'Data Inventory', footer: 'Counts of records stored on this device.' },
        List(...counts.map(([s, n]) => ListRow({ title: STORE_LABELS[s], value: String(n) })))),
    ];
  });
}
