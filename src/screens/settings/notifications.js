/** Notifications — permission, push on/off, reminder types, test, calendar fallback. */
import { h } from '../../components/dom.js';
import { NavHeader, List, ListRow, FieldRow, Switch, Card, Button, Select } from '../../components/primitives.js';
import { toast, openSheet } from '../../components/overlays.js';
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
      List(FieldRow({ title: 'Allow notifications', iconName: 'bell', control: Switch({ checked: on, label: 'Allow notifications', onChange: async (v) => {
        try {
          if (v) { await enablePush(); toast('Notifications on', { iconName: 'bell', subtitle: `${reminders.length} reminders scheduled` }); }
          else { await disablePush(); toast('Notifications off', { iconName: 'bell' }); }
        } catch (e) { toast('Couldn’t turn on', { iconName: 'info', subtitle: e.message, duration: 6000 }); }
        refresh();
      } }) })),
      !on && h('p', { class: 'section__footer' }, cap.state === 'needs-home-screen' ? 'iPhone: Share → Add to Home Screen first.' : cap.text || 'Reminders and rest timers arrive even when Hercules is closed or your phone is locked.'),
      List(
        FieldRow({ title: 'Workouts', control: prefs.workout.enabled
          ? h('span', { class: 'row', style: { gap: '10px' } }, Select({ value: prefs.workout.leadMin, placeholder: '30 min', onChange: (v) => set('workout', { leadMin: Number(v) || 30 }), options: [10, 15, 30, 45, 60, 90].map((m) => ({ value: m, label: `${m} min before` })) }), Switch({ checked: true, label: 'Workout reminders', onChange: (v) => set('workout', { enabled: v }) }))
          : Switch({ checked: false, label: 'Workout reminders', onChange: (v) => set('workout', { enabled: v }) }) }),
        FieldRow({ title: 'Water', control: Switch({ checked: prefs.water.enabled, label: 'Water reminders', onChange: (v) => set('water', { enabled: v }) }) }),
        FieldRow({ title: 'Meals around training', control: Switch({ checked: prefs.meals.enabled, label: 'Meal reminders', onChange: (v) => set('meals', { enabled: v }) }) }),
        FieldRow({ title: 'Rest days', control: Switch({ checked: prefs.rest.enabled, label: 'Rest-day reminders', onChange: (v) => set('rest', { enabled: v }) }) }),
        FieldRow({ title: 'Weekly check-in', control: prefs.checkin.enabled
          ? h('span', { class: 'row', style: { gap: '10px' } }, Select({ value: prefs.checkin.day, onChange: (v) => set('checkin', { day: Number(v) }), options: DAY_NAMES.map((d, i) => ({ value: i, label: d.slice(0, 3) })) }), Switch({ checked: true, label: 'Weekly check-in', onChange: (v) => set('checkin', { enabled: v }) }))
          : Switch({ checked: false, label: 'Weekly check-in', onChange: (v) => set('checkin', { enabled: v }) }) })),
      List(ListRow({ iconName: 'clock', title: 'Scheduled', value: String(reminders.length), onClick: () => openSheet({ title: 'Scheduled Reminders', content: h('div', { class: 'stack' },
        reminders.length ? List(...reminders.map((r) => ListRow({ title: r.title, subtitle: `${r.days.length === 7 ? 'Every day' : r.days.map((d) => DAY_SHORT[d]).join(', ')} · ${fmt12(toMin(r.time))}` })))
          : Card({}, h('div', { class: 't-subhead c-2' }, plan ? 'Nothing scheduled yet.' : 'Workout reminders appear once Cratos has built your plan.')),
        List(
          on && ListRow({ iconName: 'bell', title: 'Send Test Notification', onClick: async () => {
            try { await sendTestPush(); toast('Test sent', { iconName: 'bell', subtitle: 'Lock your phone to see it' }); } catch (e) { toast('Test failed', { iconName: 'info', subtitle: e.message }); }
          } }),
          ListRow({ iconName: 'alarm', title: 'Schedule & Alarms', subtitle: 'Phone alarms and calendar', href: '#/alarms' })),
        h('p', { class: 't-footnote c-2', style: { padding: '0 4px' } }, 'Workout and meal reminders follow Cratos’ plan and update automatically.')) }) })),
    ];
  });
}

export { syncPush };
