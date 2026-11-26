/**
 * Live Activities in the Dynamic Island:
 *  - workout in progress: elapsed time (tap → open workout)
 *  - rest timer: countdown with progress; haptic + alert when done
 */
import * as repo from '../../services/storage/repository.js';
import { island } from '../../components/island.js';
import { haptic } from '../../components/haptics.js';
import { navigate } from '../../navigation/nav.js';

let workout = null, ticker = null, rest = null;

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`;
const hms = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}:${mmss(s % 3600).padStart(5, '0')}` : mmss(s));

function render() {
  if (rest) {
    const left = Math.max(0, (rest.endsAt - Date.now()) / 1000);
    if (left <= 0) {
      rest = null;
      haptic('success');
      island.flash({ icon: 'timer', title: 'Rest over', subtitle: 'Next set. Let’s go.', duration: 3000 });
      notifyIfHidden('Rest over', 'Next set. Let’s go.');
    } else {
      island.live({ id: 'rest', icon: 'timer', compactText: 'Rest', title: 'Resting', subtitle: rest.label, trail: mmss(Math.ceil(left)), progress: 1 - left / rest.total, accent: '#64d2ff',
        actionLabel: '+30s', onAction: () => { rest.endsAt += 30000; rest.total += 30; } });
      return;
    }
  }
  if (workout) {
    const s = (Date.now() - Date.parse(workout.startedAt)) / 1000;
    island.live({ id: 'workout', icon: 'training', compactText: workout.name, title: workout.name, subtitle: 'Workout in progress', trail: hms(s), accent: '#30d158',
      actionLabel: 'Open', onAction: () => navigate(`#/workout?id=${workout.id}`), onTap: () => navigate(`#/workout?id=${workout.id}`) });
  } else {
    island.clear();
  }
}

async function refresh() {
  workout = (await repo.list('workouts')).find((w) => w.status === 'in_progress') ?? null;
  ensureTicker();
  render();
}

function ensureTicker() {
  if ((workout || rest) && !ticker) ticker = setInterval(render, 1000);
  if (!workout && !rest && ticker) { clearInterval(ticker); ticker = null; }
}

async function notifyIfHidden(title, body) {
  if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return;
  (await navigator.serviceWorker?.ready)?.showNotification(title, { body, tag: 'rest', icon: 'assets/icons/icon-192.png', data: { url: '#/train' } });
}

export function startRest(seconds, label = '') {
  if (!seconds) return;
  rest = { endsAt: Date.now() + seconds * 1000, total: seconds, label };
  ensureTicker();
  render();
}
export function stopRest() { rest = null; ensureTicker(); render(); }

export function startWorkoutActivity() {
  repo.onChange(({ store }) => { if (store === 'workouts') refresh(); });
  refresh();
}
