/** Settings → Widgets: Home Screen and Lock Screen widgets via Scriptable. */
import { h, svg } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, List, ListRow, FieldRow, Switch, Button } from '../../components/primitives.js';
import { openSheet, toast } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import { liveScreen } from '../shared/live.js';
import * as repo from '../../services/storage/repository.js';
import { enableSync, disableSync, publish, snapshot, scriptableSource, lastSyncedAt, SCRIPTABLE_APP } from '../../services/widgets.js';


async function copy(text, what) {
  try { await navigator.clipboard.writeText(text); haptic('success'); toast(`${what} copied`, { iconName: 'copy' }); }
  catch { openSheet({ title: what, content: h('textarea', { class: 'code-box', readonly: true, rows: 10 }, text) }); }
}

const steps = (items) => h('ol', { class: 'steps' }, items.map((t) => h('li', {}, t)));

function ringSvg(p, color, size = 44) {
  const r = size / 2 - 4, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, p || 0));
  return svg(`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-opacity=".22" stroke-width="6"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`);
}
function LockPreview(d) {
  const pct = (a, b) => (b ? a / b : 0);
  return h('div', { class: 'wp__lock' },
    h('div', { class: 'wp__circ' }, ringSvg(pct(d.protein.eaten, d.protein.target), '#fff', 50), h('b', {}, d.protein.target ? String(Math.max(0, d.protein.target - d.protein.eaten)) : String(d.kcal.eaten)), h('span', {}, d.protein.target ? 'g left' : 'kcal')),
    h('div', { class: 'wp__rect' }, h('b', {}, 'HERCULES'), h('div', {}, d.kcal.target ? `${d.kcal.eaten} / ${d.kcal.target} kcal` : `${d.kcal.eaten} kcal`),
      h('span', {}, d.protein.target ? `${d.protein.eaten}/${d.protein.target} g protein · ${d.water.display}` : d.water.display),
      d.next && h('span', {}, `${d.next.focus} · ${d.next.when} ${d.next.time}`)));
}

/** Visual preview of what the Scriptable widgets render (same data, same layout). */
function Preview(d) {
  const ring = ringSvg;
  const pct = (a, b) => (b ? a / b : 0);
  const cell = (p, color, v, l) => h('div', { class: 'wp__cell' }, ring(p, color), h('b', {}, v), h('span', {}, l));
  return h('div', { class: 'wp' },
    h('div', { class: 'wp__medium' },
      h('div', { class: 'wp__head' }, h('b', {}, 'HERCULES'), d.next && h('span', {}, `${d.next.when} · ${d.next.time}`)),
      h('div', { class: 'wp__rings' },
        cell(pct(d.kcal.eaten, d.kcal.target), '#ffffff', String(d.kcal.eaten), d.kcal.target ? `of ${d.kcal.target} kcal` : 'kcal'),
        cell(pct(d.protein.eaten, d.protein.target), '#ff9f0a', `${d.protein.eaten} g`, d.protein.target ? `of ${d.protein.target} g` : 'protein'),
        cell(pct(d.water.ml, d.water.target), '#64d2ff', d.water.display, d.water.targetDisplay ? `of ${d.water.targetDisplay}` : 'water')),
      h('div', { class: 'wp__line' }, d.line)));
}

export function mount(root) {
  return liveScreen(root, async (refresh) => {
    const s = await repo.getSettings();
    const on = !!s.widgetKey;
    const data = await snapshot();
    const synced = lastSyncedAt();

    const widgetSetup = () => openSheet({ title: 'Add Hercules Widgets', content: h('div', { class: 'stack' },
      steps([
        h('span', {}, 'Install ', h('a', { href: SCRIPTABLE_APP, target: '_blank', rel: 'noopener' }, 'Scriptable'), ' (free) from the App Store.'),
        'Tap “Copy Widget Script” below.',
        'Open Scriptable → + → paste → name it “Hercules”.',
        'Long-press your Home Screen → Edit → Add Widget → Scriptable → pick a size → Add.',
        'Tap the new widget while jiggling → Script: Hercules.',
        'Lock Screen: long-press it → Customize → Lock Screen → add Scriptable (circle or rectangle) → Script: Hercules.',
      ]),
      Button({ label: 'Copy Widget Script', iconName: 'copy', variant: 'primary', block: true, onClick: () => copy(scriptableSource(s.widgetKey), 'Widget script') }),
      h('p', { class: 't-footnote c-2', style: { margin: 0 } }, 'Widgets refresh about every 15 minutes (iOS decides exactly when). Tapping one opens Hercules.')) });

    const lockSheet = () => openSheet({ title: 'Lock Screen Widgets', content: h('div', { class: 'stack' }, LockPreview(data),
      steps(['Copy the widget script (Home Screen Widgets) if you haven’t.', 'Long-press the Lock Screen → Customize → Lock Screen.', 'Tap the widget area → Scriptable → circle or rectangle.', 'Tap it → Script: Hercules → Done.']),
      Button({ label: 'Sync Now', iconName: 'rotate', block: true, onClick: async () => { const ok = await publish(true); toast(ok ? 'Widgets updated' : 'Offline — will retry', { iconName: 'widget' }); } }),
      h('p', { class: 't-footnote c-2', style: { margin: 0 } }, 'Only today’s totals, targets, next session and alarm times sync, under a random key stored on this phone.')) });
    return [
      NavHeader({ title: 'Widgets', back: { href: '#/settings', label: 'Settings' } }),
      Preview(data),
      List(
        FieldRow({ title: 'Sync to widgets', iconName: 'widget', control: Switch({ checked: on, label: 'Sync to widgets', onChange: async (v) => {
          try { if (v) { await enableSync(); toast('Widget sync on', { iconName: 'widget', subtitle: 'Now add the widget' }); } else { await disableSync(); toast('Widget sync off', { iconName: 'widget', subtitle: 'Snapshot deleted' }); } }
          catch { toast('Couldn’t reach the sync service', { iconName: 'info' }); }
          refresh();
        } }) }),
        on && ListRow({ iconName: 'plus', title: 'Home Screen Widgets', subtitle: 'Small, medium and large', onClick: widgetSetup }),
        on && ListRow({ iconName: 'plus', title: 'Lock Screen Widgets', subtitle: synced ? `Synced ${new Date(synced).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Circle, rectangle and inline', onClick: lockSheet })),
      h('p', { class: 'section__footer' }, 'Alarms and calendar live in Settings → Schedule & Alarms.'),
    ];
  });
}
