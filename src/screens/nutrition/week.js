/** Nutrition week: daily calories vs target, logged-day averages, adherence. */
import { h } from '../../components/dom.js';
import { NavHeader, Card, Provenance, SegmentedControl } from '../../components/primitives.js';
import { BarChart } from '../../components/bar-chart.js';
import * as repo from '../../services/storage/repository.js';
import { localDateKey, lastNDays, weekdayInitial } from '../../utils/dates.js';
import { dailySummaries, loggedAverages, adherence } from '../../engines/nutrition/nutrition.js';
import { activeTargets } from '../../services/nutrition/log.js';
import { liveScreen } from '../shared/live.js';

let metric = 'kcal';

export function mount(root, { params }) {
  const end = params.get('date') ?? localDateKey();
  return liveScreen(root, async (refresh) => {
    const keys = lastNDays(7, end);
    const [logs, targets] = await Promise.all([repo.listByDate('foodLogs', keys[0], end), activeTargets()]);
    const days = dailySummaries(logs, keys);
    const avg = loggedAverages(days);
    const t = targets && !targets.missing ? targets : null;
    const adh = adherence(days, t);
    const tile = (label, value, sub) => h('div', { class: 'tile' }, h('div', { class: 'tile__value' }, value), h('div', { class: 'tile__label' }, label), sub && h('div', { class: 'tile__delta flat' }, sub));
    return [
      NavHeader({ title: 'This Week', eyebrow: 'Last 7 days', back: { href: '#/nutrition', label: 'Nutrition' } }),
      SegmentedControl({ label: 'Metric', value: metric, onChange: (v) => { metric = v; refresh(); }, options: [{ value: 'kcal', label: 'Calories' }, { value: 'protein', label: 'Protein' }, { value: 'carbs', label: 'Carbs' }, { value: 'fat', label: 'Fat' }] }),
      Card({ badge: Provenance('recorded') }, BarChart({ bars: days.map((d) => ({ label: weekdayInitial(d.date), value: d.logged ? Math.round(d.totals[metric]) : null, highlight: d.date === end })), goal: t?.[metric] ?? null, formatMax: (v) => `${Math.round(v)}${metric === 'kcal' ? '' : ' g'}` })),
      h('div', { class: 'tiles' },
        tile(`avg ${metric === 'kcal' ? 'kcal' : metric}`, avg ? `${Math.round(avg[metric])}${metric === 'kcal' ? '' : ' g'}` : '—', t ? `target ${t[metric]}${metric === 'kcal' ? '' : ' g'}` : null),
        tile('days logged', `${avg?.days ?? 0}/7`),
        metric === 'protein'
          ? tile('hit protein', adh ? `${adh.proteinDays}/${adh.logged}` : '—', '≥ target')
          : tile('on target', adh ? `${adh.calorieDays}/${adh.logged}` : '—', 'kcal ±10%')),
      h('p', { class: 'section__footer' }, 'Averages count logged days only.'),
    ];
  });
}
