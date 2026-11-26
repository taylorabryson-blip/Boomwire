/**
 * Food sources:
 *  - USDA SR Legacy (bundled, 7,283 foods, public domain) — "Verified"
 *  - Open Food Facts (live, branded/packaged, community-edited) — "Community"
 *  - Your custom foods — "Your entry"
 * Every food is normalized to { name, brand, source, sourceId, verification,
 * basisLabel, basisGrams, nutrients (per basis), portions [[label, grams]] }.
 */
import * as repo from '../storage/repository.js';

let usda = null, loading = null;
const URL_USDA = 'src/data/foods/usda-sr-legacy.json';

export async function loadUSDA() {
  if (usda) return usda;
  if (!loading) loading = fetch(URL_USDA).then((r) => { if (!r.ok) throw new Error('Food database failed to load'); return r.json(); }).then((d) => {
    usda = { ...d, index: d.foods.map((f) => f[1].toLowerCase()) };
    return usda;
  });
  return loading;
}

export function fromUSDARow(row, cats = usda?.categories ?? []) {
  const [id, name, cat, kcal, protein, carbs, fat, fiber, sugars, sodium, satfat, portions] = row;
  return {
    name: name.replace(/\s*\(Includes foods for USDA's Food Distribution Program\)/, ''), brand: null, source: 'usda', sourceId: String(id), verification: 'verified', category: cats[cat] ?? null,
    basisLabel: '100 g', basisGrams: 100,
    nutrients: { kcal, protein, carbs, fat, fiber: fiber ?? null, sugars: sugars ?? null, sodium: sodium ?? null, satfat: satfat ?? null },
    portions: portions ?? [],
  };
}

/** Everyday staples: exact USDA descriptions shown first for common searches. */
const FDP = " (Includes foods for USDA's Food Distribution Program)";
const PINNED = {
  egg: ['Egg, whole, raw, fresh', 'Egg, whole, cooked, hard-boiled', 'Egg, whole, cooked, scrambled', 'Egg, whole, cooked, fried', 'Egg, white, raw, fresh'],
  milk: ['Milk, whole, 3.25% milkfat, with added vitamin D', 'Milk, reduced fat, fluid, 2% milkfat, with added vitamin A and vitamin D', 'Milk, lowfat, fluid, 1% milkfat, with added vitamin A and vitamin D', 'Milk, nonfat, fluid, with added vitamin A and vitamin D (fat free or skim)'],
  'chicken breast': ['Chicken, broilers or fryers, breast, meat only, cooked, roasted', 'Chicken, broilers or fryers, breast, meat only, raw', 'Chicken, broilers or fryers, breast, skinless, boneless, meat only, cooked, grilled', 'Chicken, broilers or fryers, breast, skinless, boneless, meat only, raw'],
  chicken: ['Chicken, broilers or fryers, breast, meat only, cooked, roasted', 'Chicken, broilers or fryers, thigh, meat only, cooked, roasted', 'Chicken, broilers or fryers, drumstick, meat only, cooked, roasted', 'Chicken, broilers or fryers, wing, meat and skin, cooked, roasted'],
  tuna: ['Fish, tuna, light, canned in water, drained solids' + FDP, 'Fish, tuna, light, canned in oil, drained solids'],
  steak: ['Beef, top sirloin, steak, separable lean and fat, trimmed to 1/8" fat, all grades, cooked, broiled', 'Beef, loin, top sirloin cap steak, boneless, separable lean and fat, trimmed to 1/8" fat, all grades, cooked, grilled'],
  'white rice': ['Rice, white, long-grain, regular, cooked, enriched, with salt', 'Rice, white, medium-grain, cooked, unenriched'],
  'brown rice': ['Rice, brown, long-grain, cooked' + FDP, 'Rice, brown, medium-grain, cooked' + FDP],
  rice: ['Rice, white, long-grain, regular, cooked, enriched, with salt', 'Rice, white, medium-grain, cooked, unenriched', 'Rice, brown, long-grain, cooked' + FDP, 'Rice, brown, medium-grain, cooked' + FDP],
  oats: ['Cereals, oats, regular and quick, not fortified, dry', 'Cereals, oats, regular and quick and instant, unenriched, cooked with water (includes boiling and microwaving), with salt', 'Oats' + FDP],
  oatmeal: ['Cereals, oats, regular and quick and instant, unenriched, cooked with water (includes boiling and microwaving), with salt', 'Cereals, oats, regular and quick, not fortified, dry'],
  bread: ['Bread, white, commercially prepared (includes soft bread crumbs)', 'Bread, whole-wheat, commercially prepared', 'Bread, rye', 'Bread, wheat'],
  'peanut butter': ['Peanut butter, smooth style, with salt' + FDP, 'Peanut butter, smooth style, without salt', 'Peanut butter, chunk style, with salt'],
  salmon: ['Fish, salmon, Atlantic, farmed, cooked, dry heat', 'Fish, salmon, Atlantic, wild, cooked, dry heat', 'Fish, salmon, Atlantic, farmed, raw', 'Fish, salmon, Atlantic, wild, raw'],
  'ground beef': ['Beef, ground, 80% lean meat / 20% fat, crumbles, cooked, pan-browned', 'Beef, ground, 90% lean meat / 10% fat, crumbles, cooked, pan-browned', 'Beef, ground, 85% lean meat / 15% fat, raw' + FDP, 'Beef, ground, 93% lean meat / 7% fat, raw'],
  potato: ['Potatoes, baked, flesh and skin, without salt', 'Potatoes, boiled, cooked without skin, flesh, without salt'],
  'sweet potato': ['Sweet potato, cooked, baked in skin, flesh, without salt', 'Sweet potato, cooked, boiled, without skin'],
  pasta: ['Pasta, cooked, enriched, without added salt', 'Pasta, cooked, enriched, with added salt'],
  apple: ['Apples, raw, with skin' + FDP], avocado: ['Avocados, raw, all commercial varieties'], 'olive oil': ['Oil, olive, salad or cooking'],
  butter: ['Butter, salted', 'Butter, without salt'], cheese: ['Cheese, cheddar' + FDP, 'Cheese, mozzarella, whole milk', 'Cheese, swiss', 'Cheese, parmesan, grated'],
  yogurt: ['Yogurt, Greek, plain, nonfat' + FDP, 'Yogurt, Greek, plain, whole milk', 'Yogurt, plain, whole milk', 'Yogurt, plain, low fat'],
  'greek yogurt': ['Yogurt, Greek, plain, nonfat' + FDP, 'Yogurt, Greek, plain, lowfat', 'Yogurt, Greek, plain, whole milk'],
  spinach: ['Spinach, raw'], strawberries: ['Strawberries, raw'], blueberries: ['Blueberries, raw'], banana: ['Bananas, raw'],
  turkey: ['Turkey, ground, 93% lean, 7% fat, pan-broiled crumbles', 'Turkey, ground, 93% lean, 7% fat, raw'],
  'black beans': ['Beans, black, mature seeds, cooked, boiled, without salt'], almonds: ['Nuts, almonds'],
  bacon: ['Pork, cured, bacon, cooked, baked', 'Pork, cured, bacon, unprepared'], 'orange juice': ['Orange juice, raw' + FDP],
  tortilla: ['Tortillas, ready-to-bake or -fry, flour, shelf stable', 'Tortillas, ready-to-bake or -fry, corn'],
};
const PENALTY = /\b(roll|breaded|nuggets?|tenders|patties|frozen|shakes?|bar|mixture|dehydrated|powder|flour|prepared from recipe|fast foods?|school lunch|babyfood|imitation|substitute|eggnog|candied|frosted|sauce|soup|salad|sandwich|pie|cake|cookies?)\b/g;
const BOOST = /\b(raw|cooked|roasted|boiled|grilled|whole|plain|fluid|fresh|baked)\b/g;

/**
 * Ranked local search. Every query word must appear in the description.
 * Whole-word matches beat partial ones ("egg" ≠ "eggplant"); matches at the
 * start of the name or of a comma-part rank higher; plain/whole foods rank
 * above processed variants; common staples are pinned first.
 */
export async function searchUSDA(query, limit = 40) {
  const db = await loadUSDA();
  const norm = query.toLowerCase().trim().replace(/\s+/g, ' ');
  const q = norm.replace(/[^a-z0-9%\s-]/g, ' ').split(/\s+/).filter(Boolean);
  if (!q.length) return [];
  const key = PINNED[norm] ? norm : PINNED[norm.replace(/e?s$/, '')] ? norm.replace(/e?s$/, '') : null;
  const pinned = key ? PINNED[key].map((n) => db.index.indexOf(n.toLowerCase())).filter((i) => i >= 0) : [];
  const results = [];
  for (let i = 0; i < db.index.length; i++) {
    if (pinned.includes(i)) continue;
    const n = db.index[i];
    let ok = true, score = 0;
    for (const w of q) {
      const re = new RegExp(`(^|[\\s,(/-])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(e?s)?(?=$|[\\s,)/-])`);
      const whole = re.exec(n);
      if (whole) { score += 25; if (whole.index === 0) score += 25; else if (n[whole.index] === ',' || n.slice(whole.index - 1, whole.index + 1).includes(',')) score += 8; continue; }
      const at = n.indexOf(w);
      if (at < 0) { ok = false; break; }
      score += 2; // partial word (e.g. inside a longer word)
    }
    if (!ok) continue;
    score -= n.length * 0.1 + (n.split(',').length - 1) * 1.5;
    score -= (n.match(PENALTY)?.length ?? 0) * 8;
    score += Math.min(2, n.match(BOOST)?.length ?? 0) * 3;
    if (/[A-Z]{3,}/.test(db.foods[i][1])) score -= 10; // branded items (e.g. "QUAKER") below generic foods
    results.push([score, i]);
  }
  results.sort((a, b) => b[0] - a[0]);
  return [...pinned, ...results.map(([, i]) => i)].slice(0, limit).map((i) => fromUSDARow(db.foods[i]));
}

/** Open Food Facts search (branded products). Needs internet; CORS-enabled public API. */
export async function searchOFF(query, { signal } = {}) {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=25&fields=code,product_name,brands,nutriments,serving_size,serving_quantity`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('Brand search is unavailable right now.');
  const data = await res.json();
  return (data.products ?? []).map(fromOFF).filter(Boolean);
}

export async function lookupBarcode(code) {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity`);
  if (!res.ok) return null;
  const d = await res.json();
  return d.status === 1 ? fromOFF(d.product) : null;
}

export function fromOFF(p) {
  const n = p.nutriments ?? {};
  const kcal = n['energy-kcal_100g'] ?? (n.energy_100g != null ? n.energy_100g / 4.184 : null);
  if (kcal == null || !p.product_name) return null;
  const num = (v) => (v == null || v === '' ? null : Math.max(0, Number(v)));
  const portions = [];
  const sq = Number(p.serving_quantity);
  if (sq > 0) portions.push([`1 serving (${p.serving_size ?? `${sq} g`})`.slice(0, 48), sq]);
  return {
    name: p.product_name.trim(), brand: (p.brands ?? '').split(',')[0].trim() || null, source: 'off', sourceId: String(p.code ?? ''),
    verification: 'community', basisLabel: '100 g', basisGrams: 100,
    nutrients: {
      kcal: Math.round(kcal), protein: num(n.proteins_100g) ?? 0, carbs: num(n.carbohydrates_100g) ?? 0, fat: num(n.fat_100g) ?? 0,
      fiber: num(n.fiber_100g), sugars: num(n.sugars_100g), sodium: n.sodium_100g != null ? Math.round(Number(n.sodium_100g) * 1000) : null,
      satfat: num(n['saturated-fat_100g']),
    },
    portions,
  };
}

/** Your foods: custom entries and starred favourites. */
export async function myFoods() {
  return (await repo.list('foods')).sort((a, b) => a.name.localeCompare(b.name));
}

/** Recent + frequent foods from your log (unique by source/sourceId/name). */
export async function recentFoods(limit = 30) {
  const logs = (await repo.list('foodLogs')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const seen = new Map();
  for (const e of logs) {
    const key = `${e.source}|${e.sourceId ?? e.name}`;
    const cur = seen.get(key);
    if (cur) cur.count++;
    else seen.set(key, { count: 1, food: { name: e.name, brand: e.brand, source: e.source, sourceId: e.sourceId, verification: e.verification, basisLabel: e.basisLabel, basisGrams: e.basisGrams, nutrients: e.nutrients, portions: e.portionLabel && e.portionGrams ? [[e.portionLabel, e.portionGrams]] : [], lastPortion: e.portionLabel ? { label: e.portionLabel, grams: e.portionGrams, quantity: e.quantity } : null } });
  }
  return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, limit).map((x) => ({ ...x.food, timesLogged: x.count }));
}

export const VERIFICATION_LABEL = { verified: 'USDA verified', community: 'Open Food Facts', user: 'Your entry' };
