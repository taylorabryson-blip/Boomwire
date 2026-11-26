/**
 * Route table. `tab` = highlighted tab; `depth` drives push/pop animations.
 * Tabs: Home · Train · Kratos · Nutrition · Progress. The body/anatomy view
 * lives inside Progress so Home stays focused.
 */
export const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'train', label: 'Train', icon: 'training' },
  { id: 'kratos', label: 'Kratos', icon: 'kratos' },
  { id: 'nutrition', label: 'Nutrition', icon: 'nutrition' },
  { id: 'progress', label: 'Progress', icon: 'analytics' },
];

export const ROUTES = {
  home: { tab: 'home', depth: 0, load: () => import('../screens/home/home.js') },
  train: { tab: 'train', depth: 0, load: () => import('../screens/training/training.js') },
  workout: { tab: 'train', depth: 1, load: () => import('../screens/training/workout.js') },
  exercise: { tab: 'train', depth: 2, load: () => import('../screens/training/exercise.js') },
  kratos: { tab: 'kratos', depth: 0, load: () => import('../screens/kratos/kratos.js') },
  schedule: { tab: 'kratos', depth: 1, load: () => import('../screens/kratos/schedule.js') },
  nutrition: { tab: 'nutrition', depth: 0, load: () => import('../screens/nutrition/nutrition.js') },
  progress: { tab: 'progress', depth: 0, load: () => import('../screens/progress/progress.js') },
  measurements: { tab: 'progress', depth: 1, load: () => import('../screens/progress/measurements.js') },
  profile: { tab: 'home', depth: 1, load: () => import('../screens/profile/profile.js') },
  settings: { tab: 'home', depth: 1, load: () => import('../screens/settings/settings.js') },
  notifications: { tab: 'home', depth: 2, load: () => import('../screens/settings/notifications.js') },
};

// Legacy hashes from v0.1 keep working.
export const ALIASES = { training: 'train', analytics: 'progress', body: 'progress' };
