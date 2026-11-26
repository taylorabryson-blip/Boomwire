/**
 * Update visibility: after an update installs, the Dynamic Island announces
 * the new version and "What's New" lists the changes. Settings → About shows
 * the running version and lets you check for updates.
 */
import { h } from '../../components/dom.js';
import { island } from '../../components/island.js';
import { openSheet } from '../../components/overlays.js';
import { Button } from '../../components/primitives.js';
import * as repo from '../storage/repository.js';
import { APP_VERSION } from '../../app/version.js';

export const CHANGELOG = [
  { version: '0.8.0', items: [
    'Real Liquid Glass: clear glass with light catching the edges and corners (true refraction where the browser supports it); the touch bubble is gone',
    'Smooth iOS page transitions, and swipe left/right to move between tabs',
    'Diet-only mode: bulk, cut or maintain with meal times, no workouts required',
    'Equipment is just your equipment; every exercise now shows the equipment it needs',
    'Settings reorganized: Schedule & Alarms (schedule, phone alarms, calendar), Notifications, Personalization, Widgets',
    'Water goal moved into Nutrition Targets',
  ] },
  { version: '0.7.0', items: [
    'Say what you ate: tap the mic, say “two eggs and a banana”, log it all in one tap',
    'One-tap “same as yesterday”, your usual foods, and suggestions to fill your remaining protein',
    'Daily water goal now calculated from your body weight (more on training days)',
    'Talk to Cratos by voice; he answers out loud in a deep voice (or male/female in Personalization)',
    'Real iPhone alarms via Shortcuts, and Home + Lock Screen widgets via Scriptable',
    '187 pieces of equipment, smart home gyms (Tonal, Bowflex…), and add your own',
    'iOS-style notification banners, swipe from the left edge to go back',
    'Coach renamed Cratos (Latin spelling); header overlap fixed',
  ] },
  { version: '0.6.0', items: [
    'Nutrition: 7,283 USDA-verified foods, brand search (Open Food Facts), barcode lookup, meals, macros and personalized targets',
    'Saved meals, custom foods, recent & frequent foods, weekly summaries',
    'Cratos is buttons-first: guided setup, weekly plan, start workouts in one tap',
    'Full gear catalog (78 items) and 110 exercises',
    'Recovery check-ins: sleep, soreness, energy, readiness',
    'Week-over-week comparisons in Progress',
    'Liquid Glass touch effects on iPhone, Material design on Android',
    'Cratos setup now asks your goal and body stats, so calorie and protein targets work right away',
    'Every screen redesigned to fit on one screen, Apple-style',
  ] },
  { version: '0.5.0', items: ['Real human anatomy model from BodyParts3D scan data'] },
  { version: '0.4.1', items: ['Fixed taps being ignored on iPhone', 'Updates now load cleanly'] },
];

export function openWhatsNew() {
  const entry = CHANGELOG.find((c) => c.version === APP_VERSION) ?? CHANGELOG[0];
  const sheet = openSheet({
    title: `What’s New in ${entry.version}`,
    content: h('div', { class: 'stack' },
      h('div', { class: 'list' }, entry.items.map((t) => h('div', { class: 'list-row' }, h('div', { class: 'list-row__main t-subhead' }, t)))),
      Button({ label: 'Continue', variant: 'primary', block: true, onClick: () => sheet.close() })),
  });
}

export async function announceUpdate() {
  const s = await repo.getSettings();
  if (s.lastSeenVersion === APP_VERSION) return;
  const firstRun = !s.lastSeenVersion && !(await repo.list('hydrationLogs')).length && !(await repo.list('workouts')).length;
  await repo.updateSettings({ lastSeenVersion: APP_VERSION });
  if (firstRun) return;
  island.flash({ icon: 'download', title: `Updated to ${APP_VERSION}`, subtitle: 'Tap to see what’s new', actionLabel: 'View', onAction: openWhatsNew, duration: 7000 });
}

/** Live "updating" indicator while a new version downloads. */
export function watchForUpdates(reg) {
  reg.addEventListener('updatefound', () => {
    if (!navigator.serviceWorker.controller) return;
    island.flash({ icon: 'download', title: 'Downloading update', subtitle: 'Hercules will refresh in a moment', duration: 5000 });
  });
}
