/** Settings → Schedule & Alarms: your day, real iPhone alarms (via Shortcuts) and calendar export — all scheduling in one place. */
import { h } from '../../components/dom.js';
import { NavHeader, List, ListRow, Button } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import { liveScreen } from '../shared/live.js';
import * as repo from '../../services/storage/repository.js';
import { getPlan } from '../../services/coach.js';
import { downloadPlanICS } from '../../services/calendar/ics.js';
import { enableSync, alarmShortcutURL, alarmFeedURL, alarmsFor, SHORTCUT_NAME } from '../../services/widgets.js';
import { fmt12, toMin } from '../../engines/coach/parser.js';
import { SLEEP_SHORTCUT, turnOnHealthSleep, importHealthSleep } from '../../services/sleep.js';

const steps = (items) => h('ol', { class: 'steps' }, items.map((t) => h('li', {}, t)));

async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); haptic('success'); toast(`${what} copied`, { iconName: 'copy' }); }
  catch { openSheet({ title: what, content: h('textarea', { class: 'code-box', readonly: true, rows: 4 }, text) }); }
}

export function openShortcutSetup() {
  openSheet({ title: `Create “${SHORTCUT_NAME}”`, content: h('div', { class: 'stack' },
    h('p', { class: 't-subhead c-2', style: { margin: 0 } }, 'One time, about a minute. Then Hercules sets real Clock alarms for you.'),
    steps([
      `Open Shortcuts → + → name it exactly “${SHORTCUT_NAME}”.`,
      'Add “Split Text” → Shortcut Input, separator: New Lines.',
      'Add “Repeat with Each” → Split Text.',
      'Inside the repeat: “Split Text” → Repeat Item, separator: Custom “|”.',
      'Add “Get Item from List” → First Item, then “Get Dates from Input”.',
      'Add “Get Item from List” → Last Item, from the second Split Text.',
      'Add “Create Alarm” → Time: Dates, Label: Item from List. Turn off “Show When Run”.',
    ]),
    h('div', { class: 't-headline' }, 'Make it automatic (optional)'),
    steps([
      'Shortcuts → Automation → + → Time of Day → 9:00 PM, Daily → Run Immediately.',
      'Add “Get Contents of URL” → paste your alarm feed.',
      `Add “Run Shortcut” → ${SHORTCUT_NAME}, input: Contents of URL.`,
    ]),
    Button({ label: 'Copy My Alarm Feed URL', iconName: 'copy', block: true, onClick: async () => { try { const key = await enableSync(); copy(alarmFeedURL(key), 'Alarm feed URL'); } catch { toast('Couldn’t reach the sync service', { iconName: 'info' }); } } })) });
}

/** One-time setup: send last night's sleep from Apple Health to Hercules every morning. */
export async function openSleepSetup() {
  const st = await repo.getSettings();
  const sheet = openSheet({ title: 'Sleep from Apple Health', content: h('div', { class: 'stack' },
    h('p', { class: 't-subhead c-2', style: { margin: 0 } }, 'Your iPhone already logs sleep in the Health app: time in bed from your Sleep Schedule, or real sleep if you wear an Apple Watch. This shortcut hands last night to Hercules each morning, so you never have to guess when you fell asleep.'),
    h('div', { class: 't-headline' }, `Create “${SLEEP_SHORTCUT}”`),
    steps([
      `Shortcuts → + → name it exactly “${SLEEP_SHORTCUT}”.`,
      'Add “Find Health Samples”: Type is Sleep, Start Date is in the last 1 day, Value is not Awake. Sort by Start Date, Oldest First.',
      'Add “Get Item from List” → First Item, then “Get Details of Health Sample” → Start Date, then “Format Date” → ISO 8601.',
      'Add “Get Item from List” → Last Item (from Health Samples), then “Get Details of Health Sample” → End Date, then “Format Date” → ISO 8601.',
      'Add “Get Contents of URL”: paste your sleep link, type &s= and pick the first Formatted Date, then &e= and pick the second.',
    ]),
    h('div', { class: 't-headline' }, 'Run it every morning'),
    steps([
      'Shortcuts → Automation → + → Alarm → Is Stopped → Wake-Up.',
      `Run Immediately → Run Shortcut → ${SLEEP_SHORTCUT}.`,
    ]),
    h('p', { class: 't-footnote c-2', style: { margin: 0 } }, 'No Apple Watch? Set a Sleep Schedule in Health → Browse → Sleep so your iPhone records time in bed.'),
    Button({ label: 'Copy My Sleep Link', variant: 'primary', iconName: 'copy', block: true, onClick: async () => {
      try { copy(await turnOnHealthSleep(), 'Sleep link'); } catch { toast('Couldn’t reach the sync service', { iconName: 'info' }); }
    } }),
    st.sleepFromHealth && Button({ label: 'Check for Last Night Now', block: true, onClick: async () => {
      const n = await importHealthSleep(); toast(n ? 'Sleep imported' : 'Nothing new from Health yet', { iconName: n ? 'check' : 'moon' });
    } }),
    st.sleepFromHealth && Button({ label: 'Turn Off', variant: 'danger', block: true, onClick: async () => { await repo.updateSettings({ sleepFromHealth: false }); sheet.close(); toast('Sleep import off', { iconName: 'moon' }); } })) });
}

export function mount(root) {
  return liveScreen(root, async () => {
    const [av, plan, settings] = await Promise.all([repo.get('coach', 'availability').catch(() => null), getPlan(), repo.getSettings()]);
    const now = new Date(); const nowMin = now.getHours() * 60 + now.getMinutes();
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
    const [todayAll, tAlarms] = await Promise.all([alarmsFor(now), alarmsFor(tomorrow)]);
    const todayLeft = todayAll.filter((a) => toMin(a.time) > nowMin);
    const list = (al) => al.map((a) => `${fmt12(toMin(a.time))} ${a.label}`).join(' · ');
    const fire = (al) => { if (!al.length) { toast('Nothing to set', { iconName: 'alarm' }); return; } haptic(); location.href = alarmShortcutURL(al); };

    return [
      NavHeader({ title: 'Schedule & Alarms', back: { href: '#/settings', label: 'Settings' } }),
      List(ListRow({ iconName: 'calendar', title: 'Schedule', value: av?.wakeTime ? `${fmt12(toMin(av.wakeTime))} – ${fmt12(toMin(av.sleepTime))}` : 'Not set', href: av ? '#/schedule' : '#/kratos-setup' }),
        ListRow({ iconName: 'moon', title: 'Sleep from Apple Health', value: settings.sleepFromHealth ? 'On' : 'Off',
          subtitle: settings.sleepFromHealth ? (settings.sleepLastImport ? `Last import ${new Date(settings.sleepLastImport).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}` : 'Waiting for your first morning') : 'Know exactly when you fell asleep', onClick: openSleepSetup })),
      h('div', {}, h('div', { class: 'section__header t-footnote c-2' }, 'ALARMS ON YOUR PHONE'), List(
        todayLeft.length > 0 && ListRow({ iconName: 'alarm', title: 'Set Today’s Alarms', subtitle: list(todayLeft), chevron: false, onClick: () => fire(todayLeft) }),
        ListRow({ iconName: 'alarm', title: 'Set Tomorrow’s Alarms', subtitle: tAlarms.length ? list(tAlarms) : 'Finish setup to get alarms', chevron: false, onClick: () => fire(tAlarms) }),
        ListRow({ iconName: 'info', title: 'One-Time Setup', subtitle: `Create the “${SHORTCUT_NAME}” shortcut`, onClick: openShortcutSetup }))),
      h('div', {}, h('div', { class: 'section__header t-footnote c-2' }, 'CALENDAR'), List(
        ListRow({ iconName: 'calendar', title: 'Add Week to Calendar', subtitle: plan?.sessions?.length ? 'Workouts and meal times as events' : 'Your meal times as events', chevron: false,
          onClick: async () => { if (!plan) { toast('Finish setup first', { iconName: 'info' }); return; } await downloadPlanICS(plan); toast('Calendar file ready', { iconName: 'calendar', subtitle: 'Tap Add All' }); } }))),
    ];
  });
}
