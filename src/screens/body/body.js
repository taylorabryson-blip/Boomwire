import { NavHeader, Section, Card, List, EmptyState, RoadmapRow } from '../../components/primitives.js';
import { liveScreen } from '../shared/live.js';

export function mount(root) {
  return liveScreen(root, async () => [
    NavHeader({ title: 'Body' }),
    Card({}, EmptyState({ iconName: 'body', title: 'Anatomy engine not built yet',
      body: 'The interactive 3D muscular model (Three.js + GLB assets) arrives in Phase 4. Heat maps will show estimated training involvement — never measured activation.' })),
    Section({ title: 'Coming Next' },
      List(
        RoadmapRow({ iconName: 'ruler', title: 'Body profile', subtitle: 'Height, weight history, measurements', phase: 2 }),
        RoadmapRow({ iconName: 'target', title: 'Goals & preferences', subtitle: 'Training experience and objectives', phase: 2 }),
        RoadmapRow({ iconName: 'body', title: '3D muscular anatomy', subtitle: 'Rotate, zoom, select individual muscles', phase: 4 }),
        RoadmapRow({ iconName: 'flame', title: 'Workload heat map', subtitle: 'Today · 7 · 30 · 90 days · All time', phase: 4 }))),
  ]);
}
