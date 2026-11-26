/**
 * Route table. `tab` = highlighted tab; `depth` drives push/pop animations.
 * Tabs: Home · Train · Cratos · Nutrition · Progress.
 * Screens export `mount` (default) or a named export given by `fn`.
 */
export const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'train', label: 'Train', icon: 'training' },
  { id: 'kratos', label: 'Cratos', icon: 'kratos' },
  { id: 'nutrition', label: 'Nutrition', icon: 'nutrition' },
  { id: 'progress', label: 'Progress', icon: 'analytics' },
];

const r = (tab, depth, load, fn = 'mount') => ({ tab, depth, load, fn });
export const ROUTES = {
  home: r('home', 0, () => import('../screens/home/home.js')),
  train: r('train', 0, () => import('../screens/training/training.js')),
  history: r('train', 1, () => import('../screens/training/lists.js'), 'history'),
  library: r('train', 1, () => import('../screens/training/lists.js'), 'library'),
  templates: r('train', 1, () => import('../screens/training/lists.js'), 'templates'),
  workout: r('train', 2, () => import('../screens/training/workout.js')),
  exercise: r('train', 3, () => import('../screens/training/exercise.js')),
  kratos: r('kratos', 0, () => import('../screens/kratos/kratos.js')),
  'kratos-setup': r('kratos', 1, () => import('../screens/kratos/setup.js')),
  'kratos-chat': r('kratos', 1, () => import('../screens/kratos/chat.js')),
  schedule: r('kratos', 1, () => import('../screens/kratos/schedule.js')),
  nutrition: r('nutrition', 0, () => import('../screens/nutrition/nutrition.js')),
  meal: r('nutrition', 1, () => import('../screens/nutrition/meal.js')),
  'add-food': r('nutrition', 2, () => import('../screens/nutrition/add-food.js')),
  'custom-food': r('nutrition', 3, () => import('../screens/nutrition/custom-food.js')),
  'nutrition-targets': r('nutrition', 1, () => import('../screens/nutrition/targets.js')),
  'nutrition-week': r('nutrition', 1, () => import('../screens/nutrition/week.js')),
  progress: r('progress', 0, () => import('../screens/progress/progress.js')),
  muscle: r('progress', 1, () => import('../screens/progress/muscle.js')),
  measurements: r('progress', 1, () => import('../screens/progress/measurements.js')),
  profile: r('home', 1, () => import('../screens/profile/profile.js')),
  'profile-personal': r('home', 2, () => import('../screens/profile/pages.js'), 'personal'),
  'profile-style': r('home', 2, () => import('../screens/profile/pages.js'), 'style'),
  gear: r('home', 2, () => import('../screens/profile/pages.js'), 'gear'),
  settings: r('home', 2, () => import('../screens/settings/settings.js')),
  widgets: r('home', 3, () => import('../screens/settings/widgets.js')),
  personalization: r('home', 3, () => import('../screens/settings/personalization.js')),
  notifications: r('home', 3, () => import('../screens/settings/notifications.js')),
};

// Legacy hashes keep working.
export const ALIASES = { training: 'train', analytics: 'progress', body: 'progress' };
