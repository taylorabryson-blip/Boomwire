/**
 * Training environment & equipment catalog.
 * Users tick the gear they own; every exercise declares what it needs as
 * "all of these groups, any item within a group" (e.g. squat = barbell AND
 * (power rack OR squat stand OR Smith machine)).
 */
import { EXERCISES } from './exercises.js';

export const GEAR_CATEGORIES = [
  { id: 'free', label: 'Free Weights', short: 'Free Weights', items: [
    ['dumbbells', 'Dumbbells'], ['adjustable_dumbbells', 'Adjustable dumbbells'], ['barbell', 'Olympic barbell'],
    ['plates', 'Weight plates'], ['ez_bar', 'EZ curl bar'], ['trap_bar', 'Trap / hex bar'], ['ssb', 'Safety squat bar'],
    ['swiss_bar', 'Swiss / football bar'], ['fixed_barbells', 'Fixed barbells'], ['kettlebells', 'Kettlebells'],
    ['medicine_ball', 'Medicine ball'], ['slam_ball', 'Slam ball'], ['wall_ball', 'Wall ball'], ['sandbag', 'Sandbag'],
    ['weighted_vest', 'Weighted vest'], ['dip_belt', 'Dip / weight belt'], ['landmine', 'Landmine attachment'], ['clubbell', 'Clubbells / maces'],
  ] },
  { id: 'racks', label: 'Racks & Benches', short: 'Racks', items: [
    ['power_rack', 'Power rack / cage'], ['squat_stand', 'Squat stands'], ['smith_machine', 'Smith machine'],
    ['flat_bench', 'Flat bench'], ['adjustable_bench', 'Adjustable bench'], ['decline_bench', 'Decline bench'],
    ['preacher_bench', 'Preacher bench'], ['ghd', 'Glute-ham developer (GHD)'], ['hyperextension', 'Back extension bench'],
    ['pullup_bar', 'Pull-up bar'], ['dip_station', 'Dip station / bars'], ['captains_chair', 'Captain’s chair (knee raise)'],
    ['plyo_box', 'Plyo box / step'], ['platform', 'Lifting platform'],
  ] },
  { id: 'cable', label: 'Cables & Machines', short: 'Cables', items: [
    ['cable_station', 'Cable station / crossover'], ['lat_pulldown', 'Lat pulldown machine'], ['seated_row', 'Seated row machine'],
    ['chest_press_machine', 'Chest press machine'], ['pec_deck', 'Pec deck / rear delt fly'], ['shoulder_press_machine', 'Shoulder press machine'],
    ['leg_press', 'Leg press'], ['hack_squat', 'Hack squat'], ['pendulum_squat', 'Pendulum squat'], ['belt_squat', 'Belt squat'],
    ['leg_extension', 'Leg extension'], ['leg_curl', 'Leg curl (lying or seated)'], ['hip_thrust_machine', 'Hip thrust machine'],
    ['abductor_machine', 'Hip abductor / adductor'], ['calf_machine', 'Calf raise machine'], ['assisted_pullup', 'Assisted pull-up / dip machine'],
    ['tbar_row', 'T-bar row'], ['preacher_machine', 'Preacher curl machine'], ['triceps_machine', 'Triceps / dip machine'],
    ['ab_machine', 'Ab crunch machine'], ['reverse_hyper', 'Reverse hyper'], ['glute_kickback_machine', 'Glute kickback machine'],
  ] },
  { id: 'bodyweight', label: 'Bodyweight & Accessories', short: 'Bodyweight', items: [
    ['resistance_bands', 'Resistance bands (loop)'], ['mini_bands', 'Mini bands'], ['suspension_trainer', 'Suspension trainer (TRX)'],
    ['rings', 'Gymnastics rings'], ['parallettes', 'Parallettes'], ['ab_wheel', 'Ab wheel'], ['stability_ball', 'Stability ball'],
    ['bosu', 'BOSU / balance trainer'], ['jump_rope', 'Jump rope'], ['battle_ropes', 'Battle ropes'], ['sled', 'Sled / prowler'],
    ['foam_roller', 'Foam roller'], ['mat', 'Exercise mat'], ['grip_trainer', 'Grip trainer'], ['nordic_anchor', 'Nordic curl anchor / strap'],
  ] },
  { id: 'cardio', label: 'Cardio', short: 'Cardio', items: [
    ['treadmill', 'Treadmill'], ['bike', 'Stationary bike'], ['air_bike', 'Air / assault bike'], ['rower', 'Rowing machine'],
    ['ski_erg', 'Ski erg'], ['elliptical', 'Elliptical'], ['stair_climber', 'Stair climber'], ['outdoor', 'Outdoor space (run, track)'],
    ['pool', 'Swimming pool'], ['upright_bike', 'Upright / spin bike'], ['recumbent_bike', 'Recumbent bike'], ['curved_treadmill', 'Curved / manual treadmill'],
    ['vertical_climber', 'Vertical climber'], ['jacobs_ladder', 'Jacob’s ladder'], ['arc_trainer', 'Arc trainer'], ['bike_erg', 'Bike erg'],
    ['stepmill', 'Stepmill'], ['hill', 'Hill / stairs outside'], ['track', 'Running track'],
  ] },
  { id: 'machines2', label: 'More Machines', short: 'Machines', items: [
    ['chest_supported_row', 'Chest-supported row'], ['incline_press_machine', 'Incline press machine'], ['plate_loaded_press', 'Plate-loaded / iso-lateral press'],
    ['plate_loaded_row', 'Plate-loaded / iso-lateral row'], ['pullover_machine', 'Pullover machine'], ['lateral_raise_machine', 'Lateral raise machine'],
    ['rear_delt_machine', 'Rear delt machine'], ['bicep_curl_machine', 'Biceps curl machine'], ['seated_dip_machine', 'Seated dip machine'],
    ['rotary_torso', 'Rotary torso machine'], ['back_extension_machine', 'Back extension machine'], ['vertical_leg_press', 'Vertical leg press'],
    ['standing_calf', 'Standing calf raise'], ['seated_calf', 'Seated calf raise'], ['sissy_squat', 'Sissy squat bench'], ['glute_drive', 'Glute drive / bridge machine'],
    ['hip_adductor', 'Hip adductor machine'], ['multi_gym', 'Multi-station home gym'], ['functional_trainer', 'Functional trainer (dual cable)'],
    ['cable_pulley_diy', 'Loading-pin pulley (DIY cable)'], ['dual_pulley_rack', 'Rack-mounted pulley'], ['lat_tower', 'Lat / low-row tower'],
  ] },
  { id: 'bars', label: 'Specialty Bars', short: 'Special Bars', items: [
    ['cambered_bar', 'Cambered bar'], ['axle_bar', 'Axle / fat bar'], ['multigrip_bar', 'Multi-grip bar'], ['open_trap_bar', 'Open trap bar'],
    ['womens_bar', '15 kg / 35 lb bar'], ['technique_bar', 'Technique bar'], ['curl_bar_fixed', 'Fixed EZ / straight curl bars'], ['tricep_bar', 'Triceps bar'],
  ] },
  { id: 'strongman', label: 'Strongman', short: 'Strongman', items: [
    ['atlas_stones', 'Atlas stones'], ['log', 'Log'], ['yoke', 'Yoke'], ['farmers_handles', 'Farmer’s walk handles'], ['keg', 'Keg'],
    ['husafell', 'Husafell stone'], ['tire', 'Tire (flip)'], ['sledgehammer', 'Sledgehammer'], ['circus_db', 'Circus dumbbell'], ['frame', 'Carry frame'],
  ] },
  { id: 'smart', label: 'Smart & Home Systems', short: 'Smart Gyms', items: [
    ['tonal', 'Tonal'], ['speediance', 'Speediance'], ['bowflex_home', 'Bowflex home gym'], ['bowflex_selecttech', 'Bowflex SelectTech dumbbells'],
    ['nuobell', 'NÜOBELL / quick-select dumbbells'], ['total_gym', 'Total Gym'], ['peloton_bike', 'Peloton Bike'], ['peloton_tread', 'Peloton Tread'],
    ['hydrow', 'Hydrow / smart rower'], ['tempo', 'Tempo'], ['mirror', 'Lululemon Studio Mirror'], ['vitruvian', 'Vitruvian trainer'],
    ['zwift_trainer', 'Smart bike trainer'], ['hoist_home', 'Hoist / Marcy home gym'], ['wall_mounted_rack', 'Folding wall rack'],
  ] },
  { id: 'combat', label: 'Combat & Conditioning', short: 'Combat', items: [
    ['heavy_bag', 'Heavy bag'], ['speed_bag', 'Speed bag'], ['double_end_bag', 'Double-end bag'], ['boxing_gloves', 'Boxing gloves'],
    ['agility_ladder', 'Agility ladder'], ['cones', 'Cones'], ['hurdles', 'Mini hurdles'], ['speed_parachute', 'Speed parachute'],
    ['tire_drag', 'Drag harness'], ['climbing_rope', 'Climbing rope'], ['pegboard', 'Pegboard'], ['stall_bars', 'Stall bars'],
    ['plyo_platforms', 'Plyo platforms / stacked boxes'], ['reaction_ball', 'Reaction ball'],
  ] },
  { id: 'mobility', label: 'Mobility & Recovery', short: 'Mobility', items: [
    ['massage_gun', 'Massage gun'], ['lacrosse_ball', 'Lacrosse / massage ball'], ['stretch_strap', 'Stretching strap'], ['yoga_blocks', 'Yoga blocks'],
    ['slant_board', 'Slant board'], ['peanut_ball', 'Peanut ball'], ['inversion_table', 'Inversion table'], ['compression_boots', 'Compression boots'],
    ['sauna', 'Sauna'], ['cold_plunge', 'Cold plunge'], ['mobility_stick', 'PVC / mobility stick'],
  ] },
  { id: 'accessories', label: 'Accessories', short: 'Accessories', items: [
    ['chains', 'Lifting chains'], ['ankle_weights', 'Ankle / wrist weights'], ['sliders', 'Core sliders'], ['step_platform', 'Aerobic step'],
    ['pullup_assist_band', 'Pull-up assist bands'], ['hip_belt', 'Hip / glute band'], ['dip_belt_chain', 'Weight belt with chain'], ['wrist_roller', 'Wrist roller'],
    ['grip_handles', 'Thick grip handles'], ['cable_attachments', 'Cable attachments (rope, V-bar, straps)'], ['ab_straps', 'Hanging ab straps'],
    ['doorway_bar', 'Doorway pull-up bar'], ['door_anchor', 'Band door anchor'], ['weight_tree', 'Weight tree / storage'], ['lifting_straps', 'Lifting straps'],
    ['lifting_belt', 'Lifting belt'], ['knee_sleeves', 'Knee sleeves'], ['chalk', 'Chalk'], ['heart_rate_strap', 'Heart-rate strap'],
  ] },
];

/**
 * Equivalents: owning the key also counts as owning each listed catalog item
 * (a Tonal is a cable station; SelectTechs are adjustable dumbbells).
 * Custom equipment registers here too via registerCustomGear().
 */
export const EQUIVALENTS = {
  functional_trainer: ['cable_station'], cable_pulley_diy: ['cable_station'], dual_pulley_rack: ['cable_station'], lat_tower: ['lat_pulldown', 'seated_row'],
  multi_gym: ['cable_station', 'lat_pulldown', 'seated_row', 'chest_press_machine', 'leg_extension', 'leg_curl'],
  hoist_home: ['cable_station', 'lat_pulldown', 'seated_row', 'chest_press_machine', 'leg_extension', 'leg_curl'],
  bowflex_home: ['cable_station', 'lat_pulldown', 'seated_row', 'leg_extension', 'leg_curl', 'flat_bench'],
  tonal: ['cable_station', 'lat_pulldown', 'seated_row'], speediance: ['cable_station', 'lat_pulldown', 'seated_row', 'flat_bench'], vitruvian: ['cable_station'],
  bowflex_selecttech: ['adjustable_dumbbells', 'dumbbells'], nuobell: ['adjustable_dumbbells', 'dumbbells'], tempo: ['dumbbells', 'barbell', 'plates', 'mat'],
  chest_supported_row: ['seated_row'], plate_loaded_row: ['seated_row', 'tbar_row'], incline_press_machine: ['chest_press_machine'], plate_loaded_press: ['chest_press_machine'],
  rear_delt_machine: ['pec_deck'], bicep_curl_machine: ['preacher_machine'], seated_dip_machine: ['triceps_machine'], back_extension_machine: ['hyperextension'],
  vertical_leg_press: ['leg_press'], standing_calf: ['calf_machine'], seated_calf: ['calf_machine'], glute_drive: ['hip_thrust_machine'], hip_adductor: ['abductor_machine'],
  peloton_bike: ['bike'], upright_bike: ['bike'], recumbent_bike: ['bike'], zwift_trainer: ['bike'], bike_erg: ['bike'], peloton_tread: ['treadmill'], curved_treadmill: ['treadmill'],
  hydrow: ['rower'], stepmill: ['stair_climber'], arc_trainer: ['elliptical'], track: ['outdoor'], hill: ['outdoor'],
  cambered_bar: ['barbell'], axle_bar: ['barbell'], multigrip_bar: ['swiss_bar'], open_trap_bar: ['trap_bar'], womens_bar: ['barbell'], technique_bar: ['barbell'],
  curl_bar_fixed: ['fixed_barbells', 'ez_bar'], farmers_handles: ['trap_bar'], circus_db: ['dumbbells'], frame: ['trap_bar'],
  doorway_bar: ['pullup_bar'], stall_bars: ['pullup_bar'], ab_straps: ['pullup_bar'], wall_mounted_rack: ['power_rack', 'squat_stand'],
  pullup_assist_band: ['resistance_bands'], door_anchor: ['resistance_bands'], hip_belt: ['mini_bands'], dip_belt_chain: ['dip_belt'],
  step_platform: ['plyo_box'], plyo_platforms: ['plyo_box'], tire_drag: ['sled'], total_gym: ['suspension_trainer'], mirror: ['mat'],
};
const customEquivalents = {};
/** Register user-created equipment: { id: 'custom:x', like: ['cable_station', …] }. */
export function registerCustomGear(items = []) {
  for (const k of Object.keys(customEquivalents)) delete customEquivalents[k];
  for (const it of items) if (it?.id) customEquivalents[it.id] = it.like ?? [];
}
/** Owned ids expanded through equivalents (one level). */
export function expandGear(gear) {
  const out = new Set(gear);
  for (const g of gear) for (const e of (EQUIVALENTS[g] ?? customEquivalents[g] ?? [])) out.add(e);
  return out;
}

export const GEAR = GEAR_CATEGORIES.flatMap((c) => c.items.map(([id, label]) => ({ id, label, category: c.id })));
export const GEAR_BY_ID = Object.fromEntries(GEAR.map((g) => [g.id, g]));

const ALL = GEAR.map((g) => g.id);
export const ENVIRONMENTS = [
  { id: 'gym', label: 'Commercial gym', gear: GEAR.filter((g) => !['smart', 'strongman', 'combat', 'mobility'].includes(g.category) && g.id !== 'pool').map((g) => g.id) },
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
  const owned = expandGear(gear);
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
