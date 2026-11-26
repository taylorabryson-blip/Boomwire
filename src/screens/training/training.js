import { NavHeader, Section, Card, List, EmptyState, RoadmapRow } from '../../components/primitives.js';
import * as repo from '../../services/storage/repository.js';
import { liveScreen } from '../shared/live.js';

export function mount(root) {
  return liveScreen(root, async () => {
    const workouts = await repo.list('workouts');
    return [
      NavHeader({ title: 'Training' }),
      Card({}, EmptyState({ iconName: 'training', title: workouts.length ? `${workouts.length} workouts stored` : 'No workouts yet',
        body: 'The exercise database and workout logger are built in Phase 3. Your storage is already prepared for them.' })),
      Section({ title: 'Coming Next' },
        List(
          RoadmapRow({ iconName: 'database', title: 'Exercise database', subtitle: 'Muscles, equipment, movement patterns', phase: 3 }),
          RoadmapRow({ iconName: 'plus', title: 'Workout builder & logger', subtitle: 'Sets, reps, load, rest, notes', phase: 3 }),
          RoadmapRow({ iconName: 'analytics', title: 'Volume & progression', subtitle: 'Documented, testable formulas', phase: 3 }),
          RoadmapRow({ iconName: 'clock', title: 'Templates & schedules', subtitle: 'Reusable plans and reminders', phase: 7 }))),
    ];
  });
}
