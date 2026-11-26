/** Exercise picker sheet: search, filter by muscle group, multi-select. */
import { h } from '../../components/dom.js';
import { icon } from '../../components/icons.js';
import { Search, Button } from '../../components/primitives.js';
import { openSheet } from '../../components/overlays.js';
import { haptic } from '../../components/haptics.js';
import { EXERCISES, EQUIPMENT_LABELS } from '../../data/exercises/exercises.js';
import { exercisesForGear } from '../../data/exercises/gear.js';
import { GROUPS, MUSCLE_BY_ID } from '../../data/anatomy/muscles.js';

export function filterExercises(list, query, group) {
  const q = query.trim().toLowerCase();
  return list.filter((e) => (!group || e.primary.some((m) => MUSCLE_BY_ID[m]?.group === group))
    && (!q || e.name.toLowerCase().includes(q) || e.primary.some((m) => MUSCLE_BY_ID[m]?.short.toLowerCase().includes(q)) || e.equipment.includes(q)));
}

export function exerciseSubtitle(e) {
  return `${e.primary.map((m) => MUSCLE_BY_ID[m]?.short).join(', ')} · ${EQUIPMENT_LABELS[e.equipment] ?? e.equipment}`;
}

/** @returns {Promise<string[]>} chosen exercise ids */
export function pickExercises({ gear = null, title = 'Add Exercises' } = {}) {
  return new Promise((resolve) => {
    let query = '', group = null, onlyMine = Array.isArray(gear);
    const chosen = new Set();
    const listEl = h('div', { class: 'list', style: { marginTop: '12px' } });
    const addBtn = Button({ label: 'Add', variant: 'primary', block: true, disabled: true, onClick: () => { done = true; resolve([...chosen]); sheet.close(); } });
    let done = false;
    const render = () => {
      const base = onlyMine ? exercisesForGear(gear) : EXERCISES;
      const items = filterExercises(base, query, group);
      listEl.replaceChildren(...items.map((e) => {
        const on = chosen.has(e.id);
        const b = h('button', { class: 'list-row', type: 'button', onClick: () => { haptic(); on ? chosen.delete(e.id) : chosen.add(e.id); render(); } },
          h('div', { class: 'list-row__main' }, h('div', { class: 'list-row__title' }, e.name), h('div', { class: 'list-row__subtitle' }, exerciseSubtitle(e))),
          h('span', { class: 'set-check', style: on ? { background: '#fff', color: '#000' } : null }, icon(on ? 'check' : 'plus', 16)));
        return b;
      }));
      if (!items.length) listEl.replaceChildren(h('div', { class: 'list-row c-2' }, 'No matches'));
      addBtn.disabled = !chosen.size;
      addBtn.lastChild.textContent = chosen.size ? `Add ${chosen.size}` : 'Add';
    };
    const chips = h('div', { class: 'chips chips--scroll', style: { marginTop: '12px' } },
      [{ id: null, label: 'All' }, ...GROUPS].map((g) => {
        const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(group === g.id), onClick: () => { group = g.id; chips.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b))); render(); } }, g.label);
        return b;
      }),
      Array.isArray(gear) && h('button', { class: 'chip', type: 'button', 'aria-pressed': String(onlyMine), onClick: (e) => { onlyMine = !onlyMine; e.currentTarget.setAttribute('aria-pressed', String(onlyMine)); render(); } }, 'My gear'));
    const sheet = openSheet({
      title,
      onClose: () => { if (!done) resolve([]); },
      content: h('div', {},
        Search({ placeholder: 'Search exercises or muscles', onInput: (v) => { query = v; render(); } }),
        chips, listEl,
        h('div', { style: { position: 'sticky', bottom: '0', paddingTop: '12px' } }, addBtn)),
    });
    render();
  });
}
