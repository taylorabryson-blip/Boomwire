import { h } from '../../components/dom.js';
import { NavHeader, Section, List, ListRow, SegmentedControl, Card } from '../../components/primitives.js';
import { toast } from '../../components/overlays.js';
import * as repo from '../../services/storage/repository.js';
import { SCHEMA_VERSION, isPersisted, requestPersistence } from '../../services/storage/db.js';
import { downloadBackup, importBackup } from '../../services/storage/backup.js';
import { volumeString } from '../../utils/units.js';
import { openGoalSheet } from '../shared/hydration-ui.js';
import { liveScreen } from '../shared/live.js';
import { APP_VERSION } from '../../app/version.js';

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

export function mount(root) {
  return liveScreen(root, async (refresh) => {
    const [settings, persisted] = await Promise.all([repo.getSettings(), isPersisted()]);
    return [
      NavHeader({ title: 'Settings', back: { href: '#/profile', label: 'Profile' } }),
      Section({ first: true, title: 'Units', footer: 'Data is always stored precisely and converted for display, so switching never changes your records.' },
        Card({}, SegmentedControl({ label: 'Units', value: settings.units,
          options: [{ value: 'imperial', label: 'US · oz, lb, in' }, { value: 'metric', label: 'Metric' }],
          onChange: (units) => repo.updateSettings({ units }) }))),
      Section({ title: 'Goals' },
        List(ListRow({ iconName: 'drop', title: 'Daily water goal', value: settings.hydrationGoalMl ? volumeString(settings.hydrationGoalMl, settings.units) : 'Not set', onClick: () => openGoalSheet(settings) }))),
      Section({ title: 'Reminders' },
        List(ListRow({ iconName: 'bell', title: 'Notifications', href: '#/notifications' }))),
      Section({ title: 'Your Data', footer: 'Everything is stored on this device. Imports merge by most-recent edit and never delete existing records.' },
        List(
          ListRow({ iconName: 'download', title: 'Export backup', subtitle: 'JSON file of all records', onClick: downloadBackup }),
          ListRow({ iconName: 'upload', title: 'Import backup', subtitle: 'Merge a Hercules backup file', onClick: pickBackupFile }),
          ListRow({ iconName: 'shield', title: 'Protected storage',
            subtitle: persisted ? 'The browser will not evict your data' : 'Ask the browser to keep data under storage pressure',
            value: persisted == null ? 'Unsupported' : persisted ? 'On' : 'Off',
            onClick: persisted ? null : async () => { const ok = await requestPersistence(); toast(ok ? 'Storage protected' : 'Browser declined', { iconName: 'shield', subtitle: ok ? '' : 'Adding Hercules to your Home Screen usually helps.' }); refresh(); } }))),
      Section({ title: 'About', footer: 'Kratos plans are generated on your device from your schedule. Muscle heat maps are estimates from logged sets — not measured activation.' },
        List(
          ListRow({ title: 'Version', value: APP_VERSION }),
          ListRow({ title: 'Data schema', value: `v${SCHEMA_VERSION}` }),
          ListRow({ title: 'Build phase', value: '4 · Anatomy + Kratos' }))),
    ];
  });
}
