/**
 * Workout logger. Every edit is saved (debounced) so a workout survives the
 * app closing. Checking a set starts the rest timer in the Dynamic Island.
 */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { NavHeader, Section, Card, Button, EmptyState, List, ListRow, Provenance } from '../../components/primitives.js';
import { openSheet, confirmSheet, toast } from '../../components/overlays.js';
import { island } from '../../components/island.js';
import { haptic } from '../../components/haptics.js';
import * as repo from '../../services/storage/repository.js';
import { finishWorkout, saveAsTemplate } from '../../services/training.js';
import { navigate } from '../../navigation/nav.js';
import { EXERCISE_BY_ID } from '../../data/exercises/exercises.js';
import { MUSCLE_BY_ID } from '../../data/anatomy/muscles.js';
import { previousSets, personalRecords, workoutVolume, workoutSetCount } from '../../engines/training/metrics.js';
import { weightValue, weightInputToKg, weightUnit, weightString } from '../../utils/units.js';
import { formatRelativeDay } from '../../utils/dates.js';
import { pickExercises } from './exercise-picker.js';
import { startRest, stopRest } from './live-activity.js';

export async function mount(root, { params }) {
  const id = params.get('id');
  let w = id ? await repo.get('workouts', id) : null;
  const [settings, profile, all] = await Promise.all([repo.getSettings(), repo.getProfile(), repo.list('workouts')]);
  const u = settings.units;
  if (!w) {
    root.append(NavHeader({ title: 'Workout', back: { href: '#/train', label: 'Train' } }),
      Card({}, EmptyState({ iconName: 'training', title: 'Workout not found', body: 'It may have been deleted.' })));
    return;
  }

  let saveTimer = null;
  const persist = (immediate = false) => {
    clearTimeout(saveTimer);
    const run = async () => { w = await repo.update('workouts', w.id, { name: w.name, notes: w.notes, exercises: w.exercises, durationMin: w.durationMin ?? null }); };
    if (immediate) return run();
    saveTimer = setTimeout(run, 400);
  };

  const live = w.status === 'in_progress';
  const exWrap = h('div', {});

  function setRow(ex, exIdx, s, j, prev) {
    const def = EXERCISE_BY_ID[ex.exerciseId];
    const timed = def?.metric === 'time';
    const p = prev[j];
    const prevText = p ? (timed ? `${p.durationSec ?? '—'}s` : `${p.weightKg != null ? weightValue(p.weightKg, u) : 'BW'} × ${p.reps ?? '—'}`) : '—';
    const wIn = h('input', { class: 'set-input', type: 'number', inputmode: 'decimal', step: 'any', min: '0',
      value: s.weightKg != null ? String(weightValue(s.weightKg, u)) : '', placeholder: p?.weightKg != null ? String(weightValue(p.weightKg, u)) : (def?.loadType === 'bodyweight' ? 'BW' : '0'),
      onInput: (e) => { const kg = weightInputToKg(e.target.value, u); s.weightKg = Number.isFinite(kg) ? kg : null; persist(); } });
    const rIn = h('input', { class: 'set-input', type: 'number', inputmode: 'numeric', step: '1', min: '0',
      value: timed ? (s.durationSec ?? '') : (s.reps ?? ''), placeholder: timed ? String(p?.durationSec ?? s.durationSec ?? 30) : String(p?.reps ?? s.reps ?? '0'),
      onInput: (e) => { const n = e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))); if (timed) s.durationSec = n; else s.reps = n; persist(); } });
    const tr = h('tr', { class: s.completed ? 'is-done' : '' },
      h('td', {}, String(j + 1)),
      h('td', { class: 'prev' }, prevText),
      h('td', {}, wIn),
      h('td', {}, rIn),
      h('td', {}, h('button', { class: 'set-check', type: 'button', 'aria-label': `Complete set ${j + 1}`, onClick: () => {
        s.completed = !s.completed;
        if (s.completed) {
          // Fill empty fields from what was shown as the suggestion.
          // Use the exact stored previous values (not the rounded display) so no false PRs.
          if (timed && s.durationSec == null) s.durationSec = p?.durationSec ?? (Number(rIn.placeholder) || null);
          if (!timed && s.reps == null) s.reps = p?.reps ?? (Number(rIn.placeholder) || null);
          if (s.weightKg == null && p?.weightKg != null) s.weightKg = p.weightKg;
          haptic('success');
          if (live) startRest(ex.restSec ?? 90, def?.name ?? '');
        } else { haptic(); stopRest(); }
        persist(true).then(render);
      } }, icon('check', 18))));
    return tr;
  }

  function exerciseCard(ex, i) {
    const def = EXERCISE_BY_ID[ex.exerciseId];
    const prev = previousSets(all, ex.exerciseId, w.id);
    const timed = def?.metric === 'time';
    return Card({ style: { marginTop: i ? '12px' : 0 } },
      h('div', { class: 'row row--between' },
        h('button', { type: 'button', class: 'grow', style: { textAlign: 'left' }, onClick: () => navigate(`#/exercise?id=${ex.exerciseId}`) },
          h('div', { class: 'ex-card__title' }, def?.name ?? 'Unknown exercise'),
          h('div', { class: 'ex-card__muscles' }, (def?.primary ?? []).map((m) => MUSCLE_BY_ID[m]?.short).join(', '), ` · rest ${ex.restSec ?? 90}s`)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Exercise options', onClick: () => exerciseMenu(i) }, icon('more', 18))),
      h('table', { class: 'set-table' },
        h('thead', {}, h('tr', {}, h('th', {}, 'Set'), h('th', {}, 'Prev'), h('th', {}, timed ? `+${weightUnit(u)}` : weightUnit(u)), h('th', {}, timed ? 'Secs' : 'Reps'), h('th', {}, ''))),
        h('tbody', {}, ex.sets.map((s, j) => setRow(ex, i, s, j, prev)))),
      h('div', { class: 'btn-row', style: { marginTop: '6px' } },
        Button({ label: 'Add Set', size: 'small', iconName: 'plus', onClick: () => {
          const last = ex.sets.at(-1);
          ex.sets.push({ reps: last?.reps ?? null, weightKg: last?.weightKg ?? null, durationSec: last?.durationSec ?? null, completed: false });
          persist(true).then(render);
        } }),
        ex.sets.length > 1 && Button({ label: 'Remove Set', size: 'small', onClick: () => { ex.sets.pop(); persist(true).then(render); } })));
  }

  function exerciseMenu(i) {
    const ex = w.exercises[i];
    const sheet = openSheet({ title: EXERCISE_BY_ID[ex.exerciseId]?.name ?? 'Exercise', content: h('div', { class: 'stack' },
      h('div', { class: 't-footnote c-2' }, 'Rest between sets'),
      h('div', { class: 'chips' }, [45, 60, 90, 120, 180, 240].map((sec) => h('button', { class: 'chip', type: 'button', 'aria-pressed': String((ex.restSec ?? 90) === sec),
        onClick: () => { ex.restSec = sec; persist(true).then(render); sheet.close(); } }, sec < 60 ? `${sec}s` : `${sec / 60}${sec % 60 ? '.5' : ''} min`))),
      h('div', { class: 'btn-row' },
        i > 0 && Button({ label: 'Move Up', onClick: () => { [w.exercises[i - 1], w.exercises[i]] = [w.exercises[i], w.exercises[i - 1]]; persist(true).then(render); sheet.close(); } }),
        i < w.exercises.length - 1 && Button({ label: 'Move Down', onClick: () => { [w.exercises[i + 1], w.exercises[i]] = [w.exercises[i], w.exercises[i + 1]]; persist(true).then(render); sheet.close(); } })),
      Button({ label: 'Remove Exercise', variant: 'danger', block: true, onClick: () => { w.exercises.splice(i, 1); persist(true).then(render); sheet.close(); } })) });
  }

  function render() {
    exWrap.replaceChildren(...(w.exercises.length ? w.exercises.map(exerciseCard)
      : [Card({}, EmptyState({ iconName: 'training', title: 'Empty workout', body: 'Add exercises to start logging sets.' }))]));
  }

  const notes = h('textarea', { class: 'textarea selectable', placeholder: 'Notes (how it felt, form cues, pain…)', onInput: (e) => { w.notes = e.target.value; persist(); } });
  notes.value = w.notes ?? '';

  async function finish() {
    const doneSets = w.exercises.reduce((s, ex) => s + ex.sets.filter((x) => x.completed).length, 0);
    if (!doneSets) {
      if (await confirmSheet({ title: 'No sets completed', message: 'Check off at least one set to save this workout, or discard it.', confirmLabel: 'Discard Workout' })) await discard(true);
      return;
    }
    clearTimeout(saveTimer);
    const before = Object.fromEntries(w.exercises.map((ex) => [ex.exerciseId, personalRecords(all.filter((x) => x.id !== w.id), ex.exerciseId)]));
    w = await finishWorkout(w);
    stopRest();
    const after = await repo.list('workouts');
    const prs = w.exercises.flatMap((ex) => {
      const b = before[ex.exerciseId], a = personalRecords(after, ex.exerciseId);
      return a?.heaviest && b?.heaviest && a.heaviest.value > b.heaviest.value + 1e-9 ? [`${EXERCISE_BY_ID[ex.exerciseId]?.name} ${weightString(a.heaviest.value, u)}`] : [];
    });
    haptic('success');
    island.flash({ icon: prs.length ? 'trophy' : 'check', title: prs.length ? `New PR: ${prs[0]}` : 'Workout saved', subtitle: `${workoutSetCount(w)} sets · ${weightString(workoutVolume(w), u, 0)} volume`, duration: 4500, accent: '#ffd60a' });
    navigate('#/train', { replace: true });
  }

  async function discard(skipConfirm = false) {
    if (!skipConfirm && !(await confirmSheet({ title: 'Discard workout?', message: 'Logged sets in this workout will be deleted.', confirmLabel: 'Discard' }))) return;
    clearTimeout(saveTimer);
    stopRest();
    await repo.remove('workouts', w.id);
    toast('Workout discarded', { iconName: 'trash' });
    navigate('#/train', { replace: true });
  }

  const header = NavHeader({
    title: w.name, back: { href: '#/train', label: 'Train' },
    eyebrow: live ? `In progress · started ${w.startTime}` : `${formatRelativeDay(w.date)} · ${w.durationMin ?? '—'} min`,
    trailing: h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Rename', onClick: rename }, icon('edit', 18)),
  });
  function rename() {
    const input = h('input', { value: w.name, maxlength: '60', style: { fontSize: '20px' } });
    const sheet = openSheet({ title: 'Rename Workout', content: h('div', { class: 'stack' }, h('label', { class: 'field' }, input),
      Button({ label: 'Save', variant: 'primary', block: true, onClick: async () => { w.name = input.value.trim() || 'Workout'; await persist(true); header.querySelector('.nav-header__title').textContent = w.name; sheet.close(); } })) });
  }

  render();
  root.append(
    header,
    exWrap,
    h('div', { style: { marginTop: '12px' } }, Button({ label: 'Add Exercises', iconName: 'plus', block: true, onClick: async () => {
      const ids = await pickExercises({ gear: profile.gear });
      if (!ids.length) return;
      w.exercises.push(...ids.map((exerciseId) => ({ exerciseId, restSec: EXERCISE_BY_ID[exerciseId]?.category === 'compound' ? 120 : 75, sets: [0, 1, 2].map(() => ({ reps: null, weightKg: null, durationSec: null, completed: false })) })));
      await persist(true); render();
    } })),
    Section({ title: 'Notes' }, notes),
    Section({},
      live
        ? h('div', { class: 'stack' }, Button({ label: 'Finish Workout', variant: 'primary', block: true, iconName: 'check', onClick: finish }), Button({ label: 'Discard', variant: 'danger', block: true, onClick: () => discard() }))
        : h('div', { class: 'stack' },
          Button({ label: 'Save as Template', block: true, iconName: 'list', onClick: async () => { await saveAsTemplate(w); toast('Template saved', { subtitle: w.name }); } }),
          Button({ label: 'Delete Workout', variant: 'danger', block: true, onClick: () => discard() }))),
  );
  return () => { if (saveTimer) { clearTimeout(saveTimer); persist(true); } };
}
