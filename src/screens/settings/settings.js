import { h } from '../../components/dom.js';
import { NavHeader, List, ListRow, SegmentedControl } from '../../components/primitives.js';
import { toast, openSheet } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { SCHEMA_VERSION, isPersisted, requestPersistence } from '../../services/storage/db.js';
import { downloadBackup, importBackup } from '../../services/storage/backup.js';
import { volumeString } from '../../utils/units.js';
import { openGoalSheet } from '../shared/hydration-ui.js';
import { liveScreen } from '../shared/live.js';
import { APP_VERSION } from '../../app/version.js';
import { openWhatsNew } from '../../services/pwa/whats-new.js';
import { waterGoal } from '../../services/nutrition/log.js';

function pickBackupFile() {
  const input = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.remove();
    if (!file) return;
    try {
      const s = await importBackup(JSON.parse(await file.text()));
      toast('Backup imported', { subtitle: `${s.added} new, ${s.updated} updated, ${s.skipped} kept${s.invalid ? `, ${s.invalid} invalid` : ''}`, duration: 6000 });
    } catch (e) {
      toast('Import failed', { iconName: 'info', subtitle: e instanceof SyntaxError ? 'That file is not valid JSON.' : e.message, duration: 6000 });
    }
  });
  document.body.append(input);
  input.click();
}

function openDataSheet(persisted, refresh) {
  const { close } = openSheet({ title: 'Your Data', content: h('div', { class: 'stack' },
    List(
      ListRow({ iconName: 'download', title: 'Export backup', subtitle: 'JSON file of all records', onClick: downloadBackup }),
      ListRow({ iconName: 'upload', title: 'Import backup', subtitle: 'Merges by most-recent edit; never deletes', onClick: () => { close(); pickBackupFile(); } }),
      ListRow({ iconName: 'shield', title: 'Protected storage',
        value: persisted == null ? 'Unsupported' : persisted ? 'On' : 'Off',
        onClick: persisted ? null : async () => { const ok = await requestPersistence(); toast(ok ? 'Storage protected' : 'Browser declined', { iconName: 'shield', subtitle: ok ? '' : 'Adding Hercules to your Home Screen usually helps.' }); close(); refresh(); } })),
    h('p', { class: 't-footnote c-2', style: { padding: '0 4px' } }, 'Everything is stored on this device.')) });
}

function openAboutSheet() {
  openSheet({ title: 'About Hercules', content: h('div', { class: 'stack' },
    List(
      ListRow({ title: 'Version', value: APP_VERSION }),
      ListRow({ title: 'Data schema', value: `v${SCHEMA_VERSION}` }),
      ListRow({ title: 'Build', value: 'Phases 1–7' }),
      ListRow({ iconName: 'sparkle', title: 'What’s New', onClick: () => { openWhatsNew(); } }),
      ListRow({ title: '3D anatomy', subtitle: 'BodyParts3D © DBCLS · CC BY-SA 2.1 JP' }),
      ListRow({ title: 'Food data', subtitle: 'USDA FoodData Central · Open Food Facts (ODbL)' })),
    h('p', { class: 't-footnote c-2', style: { padding: '0 4px' } }, 'Cratos plans are generated on your device. Muscle heat maps are estimates from logged sets — not measured activation.')) });
}

async function checkForUpdates() {
  const reg = window.__herculesSWReg;
  if (!reg) { toast('Updates check unavailable', { iconName: 'info', subtitle: 'Open Hercules from your Home Screen.' }); return; }
  await reg.update().catch(() => {});
  toast(reg.installing || reg.waiting ? 'Update found — installing' : 'You’re up to date', { iconName: 'download', subtitle: `Version ${APP_VERSION}` });
}

export function mount(root) {
  return liveScreen(root, async (refresh) => {
    const [settings, persisted] = await Promise.all([repo.getSettings(), isPersisted()]);
    const wg = await waterGoal(settings);
    return [
      NavHeader({ title: 'Settings', back: { href: '#/profile', label: 'Profile' } }),
      SegmentedControl({ label: 'Units', value: settings.units,
        options: [{ value: 'imperial', label: 'US · oz, lb, in' }, { value: 'metric', label: 'Metric' }],
        onChange: (units) => repo.updateSettings({ units }) }),
      List(
        ListRow({ iconName: 'drop', title: 'Daily water goal', value: wg.ml ? `${wg.auto ? 'Auto · ' : ''}${volumeString(wg.ml, settings.units)}` : 'Not set', onClick: () => openGoalSheet(settings) }),
        ListRow({ iconName: 'palette', title: 'Appearance & Personalization', href: '#/personalization' }),
        ListRow({ iconName: 'bell', title: 'Notifications', href: '#/notifications' }),
        ListRow({ iconName: 'widget', title: 'Widgets & Alarms', href: '#/widgets' }),
        ListRow({ iconName: 'shield', title: 'Your Data', value: persisted ? 'Protected' : '', onClick: () => openDataSheet(persisted, refresh) })),
      List(
        ListRow({ iconName: 'download', title: 'Check for Updates', value: APP_VERSION, onClick: checkForUpdates }),
        ListRow({ iconName: 'info', title: 'About', onClick: openAboutSheet })),
    ];
  });
}
