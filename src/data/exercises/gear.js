/**
 * Training environment & equipment catalog.
 * Users tick the gear they own; every exercise declares what it needs as
 * "all of these groups, any item within a group" (e.g. squat = barbell AND
 * (power rack OR squat stand OR Smith machine)).
 */
import { EXERCISES } from './exercises.js';

export const GEAR_CATEGORIES = [
  { id: 'free', label: 'Free Weights', items: [
    ['dumbbells', 'Dumbbells'], ['adjustable_dumbbells', 'Adjustable dumbbells'], ['barbell', 'Olympic barbell'],
    ['plates', 'Weight plates'], ['ez_bar', 'EZ curl bar'], ['trap_bar', 'Trap / hex bar'], ['ssb', 'Safety squat bar'],
    ['swiss_bar', 'Swiss / football bar'], ['fixed_barbells', 'Fixed barbells'], ['kettlebells', 'Kettlebells'],
    ['medicine_ball', 'Medicine ball'], ['slam_ball', 'Slam ball'], ['wall_ball', 'Wall ball'], ['sandbag', 'Sandbag'],
    ['weighted_vest', 'Weighted vest'], ['dip_belt', 'Dip / weight belt'], ['landmine', 'Landmine attachment'], ['clubbell', 'Clubbells / maces'],
  ] },
  { id: 'racks', label: 'Racks & Benches', items: [
    ['power_rack', 'Power rack / cage'], ['squat_stand', 'Squat stands'], ['smith_machine', 'Smith machine'],
    ['flat_bench', 'Flat bench'], ['adjustable_bench', 'Adjustable bench'], ['decline_bench', 'Decline bench'],
    ['preacher_bench', 'Preacher bench'], ['ghd', 'Glute-ham developer (GHD)'], ['hyperextension', 'Back extension bench'],
    ['pullup_bar', 'Pull-up bar'], ['dip_station', 'Dip station / bars'], ['captains_chair', 'Captain’s chair (knee raise)'],
    ['plyo_box', 'Plyo box / step'], ['platform', 'Lifting platform'],
  ] },
  { id: 'cable', label: 'Cables & Machines', items: [
    ['cable_station', 'Cable station / crossover'], ['lat_pulldown', 'Lat pulldown machine'], ['seated_row', 'Seated row machine'],
    ['chest_press_machine', 'Chest press machine'], ['pec_deck', 'Pec deck / rear delt fly'], ['shoulder_press_machine', 'Shoulder press machine'],
    ['leg_press', 'Leg press'], ['hack_squat', 'Hack squat'], ['pendulum_squat', 'Pendulum squat'], ['belt_squat', 'Belt squat'],
    ['leg_extension', 'Leg extension'], ['leg_curl', 'Leg curl (lying or seated)'], ['hip_thrust_machine', 'Hip thrust machine'],
    ['abductor_machine', 'Hip abductor / adductor'], ['calf_machine', 'Calf raise machine'], ['assisted_pullup', 'Assisted pull-up / dip machine'],
    ['tbar_row', 'T-bar row'], ['preacher_machine', 'Preacher curl machine'], ['triceps_machine', 'Triceps / dip machine'],
    ['ab_machine', 'Ab crunch machine'], ['reverse_hyper', 'Reverse hyper'], ['glute_kickback_machine', 'Glute kickback machine'],
  ] },
  { id: 'bodyweight', label: 'Bodyweight & Accessories', items: [
    ['resistance_bands', 'Resistance bands (loop)'], ['mini_bands', 'Mini bands'], ['suspension_trainer', 'Suspension trainer (TRX)'],
    ['rings', 'Gymnastics rings'], ['parallettes', 'Parallettes'], ['ab_wheel', 'Ab wheel'], ['stability_ball', 'Stability ball'],
    ['bosu', 'BOSU / balance trainer'], ['jump_rope', 'Jump rope'], ['battle_ropes', 'Battle ropes'], ['sled', 'Sled / prowler'],
    ['foam_roller', 'Foam roller'], ['mat', 'Exercise mat'], ['grip_trainer', 'Grip trainer'], ['nordic_anchor', 'Nordic curl anchor / strap'],
  ] },
  { id: 'cardio', label: 'Cardio', items: [
    ['treadmill', 'Treadmill'], ['bike', 'Stationary bike'], ['air_bike', 'Air / assault bike'], ['rower', 'Rowing machine'],
    ['ski_erg', 'Ski erg'], ['elliptical', 'Elliptical'], ['stair_climber', 'Stair climber'], ['outdoor', 'Outdoor space (run, track)'],
    ['pool', 'Swimming pool'],
  ] },
];

export const GEAR = GEAR_CATEGORIES.flatMap((c) => c.items.map(([id, label]) => ({ id, label, category: c.id })));
export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]));

const ALL = GEAR.map((g) => g.id);
export const ENVIRONMENTS = [
  { id: 'gym', label: 'Commercial gym', gear: ALL.filter((g) => g !== 'pool') },
  { id: 'home', label: 'Home gym', gear: ['adjustable_dumbbells', 'dumbbells', 'barbell', 'plates', 'power_rack', 'adjustable_bench', 'flat_bench', 'pullup_bar', 'resistance_bands', 'kettlebells', 'mat'] },
  { id: 'apartment', label: 'Apartment / small space', gear: ['adjustable_dumbbells', 'adjustable_bench', 'resistance_bands', 'mini_bands', 'pullup_bar', 'mat', 'jump_rope'] },
  { id: 'minimal', label: 'Bodyweight only', gear: ['mat'] },
];

/** Equipment groups (any-of) reused by requirements. */
const DB = ['dumbbells', 'adjustable_dumbbells'];
const BAR = ['barbell'];
const RACK = ['power_rack', 'squat_stand', 'smith_machine'];
const BENCH = ['flat_bench', 'adjustable_bench'];
const INCLINE = ['adjustable_bench'];
const CABLE = ['cable_station'];
const PULLUP = ['pullup_bar', 'power_rack', 'rings', 'captains_chair'];

/**
 * Requirements per exercise id: array of groups; the user needs ≥1 item from
 * EVERY group. Bodyweight exercises need nothing (empty array).
 */
export const REQUIREMENTS = {
  bench_press: [BAR, BENCH, RACK], incline_bench_press: [BAR, INCLINE, RACK], close_grip_bench_press: [BAR, BENCH, RACK],
  dumbbell_bench_press: [DB, BENCH], incline_dumbbell_press: [DB, INCLINE], dumbbell_fly: [DB, BENCH],
  push_up: [], incline_push_up: [], dips: [['dip_station', 'parallettes', 'rings', 'power_rack', 'captains_chair']],
  cable_fly: [CABLE], machine_chest_press: [['chest_press_machine']],
  pull_up: [PULLUP], chin_up: [PULLUP], assisted_pull_up: [['assisted_pullup', 'resistance_bands']], lat_pulldown: [['lat_pulldown', 'cable_station']],
  barbell_row: [BAR], dumbbell_row: [DB, BENCH], seated_cable_row: [['seated_row', 'cable_station']],
  inverted_row: [['power_rack', 'smith_machine', 'rings', 'suspension_trainer']], face_pull: [['cable_station', 'resistance_bands']],
  shrug: [DB], deadlift: [BAR], trap_bar_deadlift: [['trap_bar']], back_extension: [['hyperextension', 'ghd']],
  overhead_press: [BAR, RACK], dumbbell_shoulder_press: [DB], pike_push_up: [], lateral_raise: [DB], cable_lateral_raise: [CABLE], reverse_fly: [DB],
  barbell_curl: [['barbell', 'ez_bar', 'fixed_barbells']], dumbbell_curl: [DB], hammer_curl: [DB],
  triceps_pushdown: [['cable_station', 'resistance_bands']], overhead_triceps_extension: [DB], skull_crusher: [['ez_bar', 'barbell'], BENCH],
  wrist_curl: [DB], reverse_wrist_curl: [DB],
  back_squat: [BAR, RACK], front_squat: [BAR, RACK], goblet_squat: [['dumbbells', 'adjustable_dumbbells', 'kettlebells']], bodyweight_squat: [],
  leg_press: [['leg_press']], romanian_deadlift: [BAR], dumbbell_romanian_deadlift: [DB],
  hip_thrust: [BAR, BENCH], glute_bridge: [], walking_lunge: [DB], bulgarian_split_squat: [DB, BENCH],
  leg_extension: [['leg_extension']], leg_curl: [['leg_curl']], hip_abduction: [['abductor_machine']], hip_adduction: [['abductor_machine']],
  standing_calf_raise: [['calf_machine', 'smith_machine', 'dumbbells', 'adjustable_dumbbells']], seated_calf_raise: [['calf_machine']], tibialis_raise: [],
  plank: [], side_plank: [], hanging_leg_raise: [['pullup_bar', 'captains_chair', 'power_rack']], crunch: [], cable_crunch: [['cable_station', 'ab_machine']],
  russian_twist: [], farmers_carry: [['dumbbells', 'kettlebells', 'trap_bar']],
};

/** Does the user's gear satisfy an exercise's requirements? Unknown gear → yes. */
export function canDo(exerciseId, gear) {
  if (!Array.isArray(gear)) return true;
  const owned = new Set(gear);
  const req = REQUIREMENTS[exerciseId] ?? EXERCISES.find((e) => e.id === exerciseId)?.requires ?? [];
  return req.every((group) => group.some((g) => owned.has(g)));
}

/** @param {string[]|null} gear owned gear ids; null = unknown → everything */
export function exercisesForGear(gear) {
  return EXERCISES.filter((e) => canDo(e.id, gear));
}

/** Physique / training-style goals. Shapes rep schemes and emphasis; never promises an outcome. */
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
