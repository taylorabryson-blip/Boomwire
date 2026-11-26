/** Notifications — permission, push on/off, reminder types, test, calendar fallback. */
import { h } from '../../components/dom.js';
import { NavHeader, Section, List, ListRow, FieldRow, Switch, Card, Button, Select } from '../../components/primitives.js';
import { toast } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { getPlan } from '../../services/coach.js';
import { DEFAULT_REMINDERS, buildReminders } from '../../engines/notifications/schedule.js';
import { capability, enablePush, disablePush, sendTestPush, pushEnabledHere, syncPush } from '../../services/notifications/push.js';
import { downloadPlanICS } from '../../services/calendar/ics.js';
import { DAY_NAMES, DAY_SHORT, fmt12, toMin } from '../../engines/coach/parser.js';
import { liveScreen } from '../shared/live.js';

export function mount(root) {
  return liveScreen(root, async (refresh) => {
    const [settings, plan] = await Promise.all([repo.getSettings(), getPlan()]);
    const prefs = { ...DEFAULT_REMINDERS, ...(settings.reminders ?? {}) };
    const set = (key, patch) => repo.updateSettings({ reminders: { ...prefs, [key]: { ...prefs[key], ...patch } } });
    const cap = capability();
    const on = pushEnabledHere() && cap.state === 'granted';
    const reminders = buildReminders(prefs, plan);

    return [
      NavHeader({ title: 'Notifications', back: { href: '#/profile', label: 'Profile' } }),
      Section({ first: true, footer: on ? 'Reminders are delivered by Hercules’ push server even when the app is closed.' : cap.text || 'Turn on to get reminders even when Hercules is closed.' },
        List(FieldRow({ title: 'Allow notifications', iconName: 'bell', control: Switch({ checked: on, label: 'Allow notifications', onChange: async (v) => {
          try {
            if (v) { await enablePush(); toast('Notifications on', { iconName: 'bell', subtitle: `${reminders.length} reminders scheduled` }); }
            else { await disablePush(); toast('Notifications off', { iconName: 'bell' }); }
          } catch (e) { toast('Couldn’t turn on', { iconName: 'info', subtitle: e.message, duration: 6000 }); }
          refresh();
        } }) })),
        on && h('div', { style: { marginTop: '12px' } }, Button({ label: 'Send Test Notification', block: true, onClick: async () => {
          try { await sendTestPush(); toast('Test sent', { iconName: 'bell', subtitle: 'Lock your phone to see it' }); } catch (e) { toast('Test failed', { iconName: 'info', subtitle: e.message }); }
        } }))),
      Section({ title: 'Reminders' },
        List(
          FieldRow({ title: 'Workouts', control: Switch({ checked: prefs.workout.enabled, label: 'Workout reminders', onChange: (v) => set('workout', { enabled: v }) }) }),
          prefs.workout.enabled && FieldRow({ title: 'Remind me', control: Select({ value: prefs.workout.leadMin, placeholder: '30 min before', onChange: (v) => set('workout', { leadMin: Number(v) || 30 }), options: [10, 15, 30, 45, 60, 90].map((m) => ({ value: m, label: `${m} min before` })) }) }),
          FieldRow({ title: 'Water', control: Switch({ checked: prefs.water.enabled, label: 'Water reminders', onChange: (v) => set('water', { enabled: v }) }) }),
          FieldRow({ title: 'Meals around training', control: Switch({ checked: prefs.meals.enabled, label: 'Meal reminders', onChange: (v) => set('meals', { enabled: v }) }) }),
          FieldRow({ title: 'Rest days', control: Switch({ checked: prefs.rest.enabled, label: 'Rest-day reminders', onChange: (v) => set('rest', { enabled: v }) }) }),
          FieldRow({ title: 'Weekly check-in', control: Switch({ checked: prefs.checkin.enabled, label: 'Weekly check-in', onChange: (v) => set('checkin', { enabled: v }) }) }),
          prefs.checkin.enabled && FieldRow({ title: 'Check-in day', control: Select({ value: prefs.checkin.day, onChange: (v) => set('checkin', { day: Number(v) }), options: DAY_NAMES.map((d, i) => ({ value: i, label: d })) }) }))),
      Section({ title: 'Scheduled', footer: plan ? 'Workout and meal reminders follow Kratos’ plan and update automatically when it changes.' : 'Workout reminders appear once Kratos has built your plan.' },
        reminders.length ? List(...reminders.slice(0, 20).map((r) => ListRow({ title: r.title, subtitle: `${r.days.length === 7 ? 'Every day' : r.days.map((d) => DAY_SHORT[d]).join(', ')} · ${fmt12(toMin(r.time))}` })))
          : Card({}, h('div', { class: 't-subhead c-2' }, 'Nothing scheduled yet.'))),
      plan?.sessions?.length && Section({ title: 'Calendar Backup', footer: 'Adds your sessions to the iPhone Calendar with a 30-minute alert — works even without push.' },
        Button({ label: 'Add Plan to Calendar', iconName: 'calendar', block: true, onClick: () => downloadPlanICS(plan) })),
    ];
  });
}

export { syncPush };
