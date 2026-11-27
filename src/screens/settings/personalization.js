/** Settings → Appearance & Personalization: coach voice, read-aloud, haptics, glass, motion. */
import { h } from '../../components/dom.js';
import { NavHeader, List, ListRow, FieldRow, SegmentedControl, Switch, Stepper } from '../../components/primitives.js';
import { openSheet } from '../../components/overlays.js';
import { icon } from '../../components/icons.js';
import { haptic, setHapticsEnabled, hapticsEnabled } from '../../components/haptics.js';
import { liveScreen } from '../shared/live.js';
import * as repo from '../../services/storage/repository.js';
import { VOICE_STYLES, voicePrefs, voices, speak, canSpeak, canListen } from '../../services/voice.js';

export const appearancePrefs = (s) => ({ glass: true, reduceMotion: false, ...(s?.appearance ?? {}) });
export function applyAppearance(a) {
  document.documentElement.dataset.glass = a.glass ? 'on' : 'off';
  document.documentElement.dataset.motion = a.reduceMotion ? 'reduce' : 'full';
}

export function mount(root) {
  return liveScreen(root, async () => {
    const settings = await repo.getSettings();
    const v = voicePrefs(settings);
    const a = appearancePrefs(settings);
    const setVoice = (patch) => repo.updateSettings({ voice: { ...v, ...patch } });
    const setLook = (patch) => { const next = { ...a, ...patch }; applyAppearance(next); return repo.updateSettings({ appearance: next }); };
    const all = voices();
    const chosen = all.find((x) => x.voiceURI === v.voiceURI);

    const pickVoice = () => {
      const { close } = openSheet({ title: 'System Voice', content: List(
        ListRow({ title: 'Automatic', subtitle: 'Best match for the style you picked', trailing: !v.voiceURI ? icon('check', 18) : null, chevron: false, onClick: () => { setVoice({ voiceURI: null }); close(); } }),
        ...all.map((x) => ListRow({ title: x.name, subtitle: x.lang, trailing: x.voiceURI === v.voiceURI ? icon('check', 18) : null, chevron: false,
          onClick: () => { setVoice({ voiceURI: x.voiceURI }); speak('I am Cratos. Let’s get to work.', { ...v, voiceURI: x.voiceURI }); close(); } }))) });
    };

    return [
      NavHeader({ title: 'Personalization', back: { href: '#/settings', label: 'Settings' } }),
      SegmentedControl({ label: 'Units', value: settings.units, options: [{ value: 'imperial', label: 'US · oz, lb, in' }, { value: 'metric', label: 'Metric' }], onChange: (units) => repo.updateSettings({ units }) }),
      SegmentedControl({ label: 'Cratos’ voice', value: v.style, options: VOICE_STYLES.map((x) => ({ value: x.id, label: x.label })),
        onChange: (style) => { setVoice({ style, voiceURI: null }); speak('I am Cratos. Let’s get to work.', { ...v, style, voiceURI: null }); } }),
      List(
        FieldRow({ title: 'Read replies aloud', iconName: 'speaker', control: h('select', { onChange: (e) => setVoice({ replies: e.target.value }) },
          [['voice', 'When I talk'], ['always', 'Always'], ['off', 'Off']].map(([val, l]) => h('option', { value: val, selected: v.replies === val }, l))) }),
        FieldRow({ title: 'Speaking speed', control: Stepper({ value: Math.round(v.rate * 10), min: 6, max: 14, format: (x) => `${(x / 10).toFixed(1)}×`, onChange: (x) => setVoice({ rate: x / 10 }) }) }),
        all.length > 0 && ListRow({ title: 'System voice', value: chosen?.name ?? 'Automatic', onClick: pickVoice }),
),
      !canSpeak() && h('p', { class: 'section__footer' }, 'This browser can’t speak aloud.'),
      List(
        FieldRow({ title: 'Haptics', control: Switch({ checked: hapticsEnabled(), label: 'Haptics', onChange: (on) => { setHapticsEnabled(on); haptic(); } }) }),
        FieldRow({ title: 'Liquid Glass lensing', control: Switch({ checked: a.glass, label: 'Liquid Glass lensing', onChange: (on) => setLook({ glass: on }) }) }),
        FieldRow({ title: 'Reduce motion', control: Switch({ checked: a.reduceMotion, label: 'Reduce motion', onChange: (on) => setLook({ reduceMotion: on }) }) })),
    ];
  });
}
