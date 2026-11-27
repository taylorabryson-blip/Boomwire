/**
 * Foods Hercules can suggest. Each entry points at USDA SR Legacy rows (ids),
 * so nutrition facts are USDA numbers. `parts` builds a simple recipe (PB&J)
 * from USDA ingredients. Roles drive N12 (engines/nutrition/suggest.js):
 *   protein  — high protein per serving        dense  — easy calories (bulking)
 *   quick    — fast-digesting sugar/carbs       fiber  — fiber-rich
 *   recovery — protein + carbs after training   light  — low calorie, filling
 * `step` is the smallest sensible quantity change (1 = whole items).
 */
export const SUGGESTION_FOODS = [
  // Protein
  { key: 'chicken', id: 171477, name: 'Chicken breast, roasted', portion: ['4 oz', 113], step: 0.5, roles: ['protein', 'recovery'] },
  { key: 'greek_yogurt', id: 170894, name: 'Greek yogurt, plain nonfat', portion: ['1 container', 170], step: 1, roles: ['protein', 'light', 'recovery'] },
  { key: 'eggs', id: 173424, name: 'Eggs, hard-boiled', portion: ['1 large egg', 50], step: 1, roles: ['protein'] },
  { key: 'cottage', id: 172182, name: 'Cottage cheese, 2%', portion: ['1/2 cup', 113], step: 0.5, roles: ['protein', 'light'] },
  { key: 'tuna', id: 173709, name: 'Tuna, canned in water', portion: ['1 can', 165], step: 0.5, roles: ['protein', 'light'] },
  { key: 'whey', id: 173177, name: 'Whey protein isolate', portion: ['1 scoop', 29], step: 1, roles: ['protein', 'recovery'] },
  { key: 'salmon', id: 175168, name: 'Salmon, cooked', portion: ['4 oz', 113], step: 0.5, roles: ['protein'] },
  { key: 'beef90', id: 171793, name: 'Ground beef 90/10, cooked', portion: ['4 oz', 113], step: 0.5, roles: ['protein', 'dense'] },
  { key: 'jerky', id: 167536, name: 'Beef jerky', portion: ['1 oz', 28.4], step: 1, roles: ['protein'] },
  { key: 'milk2', id: 170870, name: 'Milk, 2%', portion: ['1 cup', 245], step: 1, roles: ['protein', 'dense'] },
  { key: 'mozz', id: 171244, name: 'Mozzarella, part-skim', portion: ['1 oz', 28.4], step: 1, roles: ['protein'] },
  { key: 'tofu', id: 172448, name: 'Tofu, firm', portion: ['1/4 block', 81], step: 1, roles: ['protein', 'light'] },
  { key: 'edamame', id: 168411, name: 'Edamame', portion: ['1 cup', 155], step: 0.5, roles: ['protein', 'fiber'] },
  // Easy calories
  { key: 'pbj', name: 'PB&J sandwich', portion: ['1 sandwich', null], step: 1, roles: ['dense', 'quick', 'recovery'],
    parts: [[174924, 58, '2 slices white bread'], [174266, 32, '2 tbsp peanut butter'], [169642, 21, '1 tbsp jelly']] },
  { key: 'pb', id: 174266, name: 'Peanut butter', portion: ['2 tbsp', 32], step: 1, roles: ['dense'] },
  { key: 'trail_mix', id: 167561, name: 'Trail mix', portion: ['1/4 cup', 37.5], step: 1, roles: ['dense'] },
  { key: 'oats', id: 173904, name: 'Oats, dry', portion: ['1/2 cup', 40.5], step: 0.5, roles: ['dense', 'fiber'] },
  { key: 'bagel', id: 174899, name: 'Bagel, plain', portion: ['1 bagel', 105], step: 1, roles: ['dense', 'quick'] },
  { key: 'granola_bar', id: 167542, name: 'Granola bar', portion: ['1 bar', 28], step: 1, roles: ['dense', 'quick'] },
  { key: 'whole_milk', id: 171265, name: 'Whole milk', portion: ['1 cup', 244], step: 1, roles: ['dense'] },
  { key: 'almonds', id: 168596, name: 'Almonds, roasted', portion: ['1 oz', 28.4], step: 1, roles: ['dense'] },
  { key: 'rice', id: 169753, name: 'White rice, cooked', portion: ['1 cup', 158], step: 0.5, roles: ['dense', 'recovery', 'quick'] },
  { key: 'pasta', id: 169737, name: 'Pasta, cooked', portion: ['1 cup', 107], step: 0.5, roles: ['dense'] },
  { key: 'avocado', id: 171705, name: 'Avocado', portion: ['1/2 fruit', 68], step: 1, roles: ['dense', 'fiber'] },
  // Quick energy (sugar)
  { key: 'banana', id: 173944, name: 'Banana', portion: ['1 medium', 118], step: 1, roles: ['quick', 'recovery'] },
  { key: 'honey', id: 169640, name: 'Honey', portion: ['1 tbsp', 21], step: 1, roles: ['quick'] },
  { key: 'gummies', id: 167989, name: 'Gummy candy', portion: ['10 pieces', 63], step: 1, roles: ['quick'] },
  { key: 'jellybeans', id: 167991, name: 'Jelly beans', portion: ['1 oz', 28], step: 1, roles: ['quick'] },
  { key: 'dates', id: 168191, name: 'Medjool dates', portion: ['2 dates', 48], step: 1, roles: ['quick', 'fiber'] },
  { key: 'raisins', id: 168165, name: 'Raisins', portion: ['1 small box', 28.4], step: 1, roles: ['quick'] },
  { key: 'oj', id: 167794, name: 'Orange juice', portion: ['1 cup', 249], step: 1, roles: ['quick'] },
  { key: 'choc_milk', id: 170880, name: 'Chocolate milk', portion: ['1 cup', 250], step: 1, roles: ['recovery', 'quick'] },
  { key: 'fruit_snacks', id: 170279, name: 'Fruit snacks', portion: ['1 pouch', 26], step: 1, roles: ['quick'] },
  { key: 'pretzels', id: 167555, name: 'Pretzels', portion: ['1 oz', 28.4], step: 1, roles: ['quick'] },
  // Fiber / light
  { key: 'black_beans', id: 173735, name: 'Black beans', portion: ['1/2 cup', 86], step: 0.5, roles: ['fiber', 'protein'] },
  { key: 'lentils', id: 172421, name: 'Lentils', portion: ['1/2 cup', 99], step: 0.5, roles: ['fiber', 'protein'] },
  { key: 'apple', id: 171688, name: 'Apple', portion: ['1 medium', 182], step: 1, roles: ['fiber', 'light'] },
  { key: 'broccoli', id: 169967, name: 'Broccoli, cooked', portion: ['1 cup', 156], step: 1, roles: ['fiber', 'light'] },
  { key: 'sweet_potato', id: 168483, name: 'Sweet potato, baked', portion: ['1 medium', 114], step: 1, roles: ['fiber', 'recovery'] },
  { key: 'potato', id: 170033, name: 'Potato, baked', portion: ['1 medium', 156], step: 1, roles: ['light', 'recovery'] },
  { key: 'quinoa', id: 168917, name: 'Quinoa, cooked', portion: ['1 cup', 185], step: 0.5, roles: ['fiber'] },
  { key: 'popcorn', id: 168139, name: 'Popcorn, light', portion: ['3 cups', 24], step: 1, roles: ['light', 'fiber'] },
];
