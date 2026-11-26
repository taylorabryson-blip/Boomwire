/**
 * Training environment & equipment. Users pick where they train and tick the
 * gear they own; exercise selection everywhere (Kratos plans, pickers) uses it.
 */
import { EXERCISES } from './exercises.js';

export const GEAR = [
  { id: 'dumbbell', label: 'Dumbbells' },
  { id: 'barbell', label: 'Barbell & plates' },
  { id: 'rack', label: 'Squat rack' },
  { id: 'bench', label: 'Bench' },
  { id: 'pullup_bar', label: 'Pull-up bar' },
  { id: 'dip_bars', label: 'Dip bars' },
  { id: 'cable', label: 'Cable machine' },
  { id: 'machine', label: 'Weight machines' },
  { id: 'kettlebell', label: 'Kettlebells' },
  { id: 'band', label: 'Resistance bands' },
];

export const ENVIRONMENTS = [
  { id: 'gym', label: 'Commercial gym', gear: GEAR.map((g) => g.id) },
  { id: 'home', label: 'Home gym', gear: ['dumbbell', 'bench', 'pullup_bar'] },
  { id: 'minimal', label: 'Bodyweight only', gear: [] },
];

/** What each exercise needs beyond bodyweight. Missing gear → not suggested. */
const NEEDS = {
  bench_press: ['barbell', 'bench', 'rack'], incline_bench_press: ['barbell', 'bench', 'rack'],
  close_grip_bench_press: ['barbell', 'bench', 'rack'], back_squat: ['barbell', 'rack'], front_squat: ['barbell', 'rack'],
  skull_crusher: ['barbell', 'bench'], hip_thrust: ['barbell', 'bench'],
  dumbbell_bench_press: ['dumbbell', 'bench'], incline_dumbbell_press: ['dumbbell', 'bench'], dumbbell_fly: ['dumbbell', 'bench'],
  dumbbell_row: ['dumbbell', 'bench'], back_extension: ['bench'],
  pull_up: ['pullup_bar'], chin_up: ['pullup_bar'], hanging_leg_raise: ['pullup_bar'], inverted_row: ['barbell', 'rack'],
  dips: ['dip_bars'],
};
function requirements(ex) {
  if (NEEDS[ex.id]) return NEEDS[ex.id];
  switch (ex.equipment) {
    case 'bodyweight': return [];
    case 'bench': return ['bench'];
    default: return [ex.equipment];
  }
}

/** @param {string[]|null} gear owned gear ids; null/undefined = unknown → everything */
export function exercisesForGear(gear) {
  if (!Array.isArray(gear)) return EXERCISES;
  const owned = new Set(gear);
  return EXERCISES.filter((e) => requirements(e).every((r) => owned.has(r)));
}

/** Physique / training-style goals. Shapes rep schemes and emphasis; it does not promise an outcome. */
export const STYLES = [
  { id: 'muscle', label: 'Build muscle', blurb: 'Bigger, fuller muscles. Moderate reps, more sets.' },
  { id: 'strength', label: 'Get strong', blurb: 'Heavier weights, lower reps, longer rests.' },
  { id: 'athletic', label: 'Athletic', blurb: 'Strength plus power and conditioning for sport.' },
  { id: 'lean', label: 'Lean & defined', blurb: 'Higher reps, shorter rests, more conditioning.' },
  { id: 'general', label: 'General fitness', blurb: 'Feel good, move well, stay consistent.' },
];

export const FOCUS_AREAS = [
  { id: 'chest', label: 'Chest' }, { id: 'back', label: 'Back' }, { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' }, { id: 'core', label: 'Core' }, { id: 'legs', label: 'Legs' },
];
