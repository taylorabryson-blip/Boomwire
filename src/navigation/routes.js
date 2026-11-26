/** Route table. `tab` = which primary tab is highlighted for this route. */
export const TABS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'training', label: 'Training', icon: 'training' },
  { id: 'body', label: 'Body', icon: 'body' },
  { id: 'nutrition', label: 'Nutrition', icon: 'nutrition' },
  { id: 'analytics', label: 'Analytics', icon: 'analytics' },
];

export const ROUTES = {
  home: { tab: 'home', load: () => import('../screens/home/home.js') },
  training: { tab: 'training', load: () => import('../screens/training/training.js') },
  body: { tab: 'body', load: () => import('../screens/body/body.js') },
  nutrition: { tab: 'nutrition', load: () => import('../screens/nutrition/nutrition.js') },
  analytics: { tab: 'analytics', load: () => import('../screens/analytics/analytics.js') },
  settings: { tab: 'home', load: () => import('../screens/settings/settings.js') },
};
