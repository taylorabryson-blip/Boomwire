/**
 * Muscle catalog — the single ID space shared by:
 *   - the 3D model (mesh names `muscle:<id>:<l|r|c>` in assets/models/muscles.glb)
 *   - the exercise database (primary/secondary muscle lists)
 *   - the workload / heat-map engine and analytics
 * Never rename an id; add new ones instead.
 */
export const GROUPS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'arms', label: 'Arms' },
  { id: 'core', label: 'Core' },
  { id: 'legs', label: 'Legs' },
];

export const MUSCLES = [
  { id: 'pectoralis_major', name: 'Pectoralis major', short: 'Chest', group: 'chest', view: 'front' },
  { id: 'serratus_anterior', name: 'Serratus anterior', short: 'Serratus', group: 'chest', view: 'front' },
  { id: 'deltoid_anterior', name: 'Anterior deltoid', short: 'Front delts', group: 'shoulders', view: 'front' },
  { id: 'deltoid_lateral', name: 'Lateral deltoid', short: 'Side delts', group: 'shoulders', view: 'both' },
  { id: 'deltoid_posterior', name: 'Posterior deltoid', short: 'Rear delts', group: 'shoulders', view: 'back' },
  { id: 'biceps_brachii', name: 'Biceps brachii', short: 'Biceps', group: 'arms', view: 'front' },
  { id: 'triceps_brachii', name: 'Triceps brachii', short: 'Triceps', group: 'arms', view: 'back' },
  { id: 'forearm_flexors', name: 'Forearm flexors', short: 'Forearms (front)', group: 'arms', view: 'front' },
  { id: 'forearm_extensors', name: 'Forearm extensors', short: 'Forearms (back)', group: 'arms', view: 'back' },
  { id: 'trapezius', name: 'Trapezius', short: 'Traps', group: 'back', view: 'back' },
  { id: 'rhomboids', name: 'Rhomboids', short: 'Rhomboids', group: 'back', view: 'back' },
  { id: 'infraspinatus', name: 'Infraspinatus & teres', short: 'Rotator cuff', group: 'back', view: 'back' },
  { id: 'latissimus_dorsi', name: 'Latissimus dorsi', short: 'Lats', group: 'back', view: 'back' },
  { id: 'erector_spinae', name: 'Erector spinae', short: 'Lower back', group: 'back', view: 'back' },
  { id: 'rectus_abdominis', name: 'Rectus abdominis', short: 'Abs', group: 'core', view: 'front' },
  { id: 'obliques', name: 'External obliques', short: 'Obliques', group: 'core', view: 'front' },
  { id: 'gluteus_maximus', name: 'Gluteus maximus', short: 'Glutes', group: 'legs', view: 'back' },
  { id: 'gluteus_medius', name: 'Gluteus medius', short: 'Side glutes', group: 'legs', view: 'back' },
  { id: 'quadriceps', name: 'Quadriceps', short: 'Quads', group: 'legs', view: 'front' },
  { id: 'adductors', name: 'Adductors', short: 'Inner thighs', group: 'legs', view: 'front' },
  { id: 'hamstrings', name: 'Hamstrings', short: 'Hamstrings', group: 'legs', view: 'back' },
  { id: 'gastrocnemius', name: 'Gastrocnemius', short: 'Calves', group: 'legs', view: 'back' },
  { id: 'soleus', name: 'Soleus', short: 'Soleus', group: 'legs', view: 'back' },
  { id: 'tibialis_anterior', name: 'Tibialis anterior', short: 'Shins', group: 'legs', view: 'front' },
];

export const MUSCLE_BY_ID = Object.fromEntries(MUSCLES.map((m) => [m.id, m]));
export const muscleName = (id) => MUSCLE_BY_ID[id]?.name ?? id;
export const musclesInGroup = (g) => MUSCLES.filter((m) => m.group === g).map((m) => m.id);
