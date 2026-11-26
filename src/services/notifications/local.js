/**
 * In-app reminder clock: while Hercules is open, due reminders show in the
 * Dynamic Island (and as a system notification if permission is granted and
 * push is not already covering them). Also re-syncs push after data changes.
 */
import * as repo from '../storage/repository.js';
import { dueAt } from '../../engines/notifications/schedule.js';
import { currentReminders, syncPush, pushEnabledHere } from './push.js';
import { island } from '../../components/island.js';
import { haptic } from '../../components/haptics.js';
import { navigate } from '../../navigation/nav.js';

const fired = new Set();
let syncTimer = null;

export function startReminderClock() {
  const check = async () => {
    const now = new Date();
    const due = dueAt(await currentReminders(), now);
    for (const r of due) {
      const key = `${r.id}@${now.toDateString()}`;
      if (fired.has(key)) continue;
      fired.add(key);
      if (document.visibilityState === 'visible') {
        haptic('success');
        island.flash({ icon: r.kind === 'water' ? 'drop' : r.kind === 'workout' ? 'training' : 'bell', title: r.title, subtitle: r.body, actionLabel: 'Open', onAction: () => navigate(r.url), duration: 6000 });
      } else if (!pushEnabledHere() && 'Notification' in window && Notification.permission === 'granted') {
        (await navigator.serviceWorker?.ready)?.showNotification(r.title, { body: r.body, tag: r.id, data: { url: r.url }, icon: 'assets/icons/icon-192.png' });
      }
    }
  };
  setTimeout(check, 2000);
  setInterval(check, 30000);

  // Keep the server's reminder list in step with plan/preference changes.
  repo.onChange(({ store }) => {
    if (store !== 'coach' && store !== 'settings') return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncPush, 1500);
  });
  syncPush();
}
