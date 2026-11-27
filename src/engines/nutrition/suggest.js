/**
 * N12 — Personalized food suggestions.
 *
 * Inputs: today's targets and what's been eaten, latest body weight, goal,
 * workout timing, and the foods this person actually logs (what they have and
 * like). Output: a few short groups of foods with portions sized to the person.
 *
 * Sizing conventions (sports-nutrition practice, not guarantees):
 *  - Protein per sitting ≈ 0.4 g/kg body weight, clamped to 20–50 g.
 *  - Pre-workout quick carbs ≈ 0.5 g/kg (20–60 g) in the 2 hours before training.
 *  - After training: protein dose as above plus carbs.
 * Foods only ever add to a gap that exists; nothing is suggested to "make up"
 * calories on a cut once the target is reached.
 */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;

/** Nutrients for a food at a portion ({grams, qty} or servings for per-serving foods). */
export function nutrientsFor(food, grams, qty) {
  const servings = food.basisGrams ? (grams * qty) / food.basisGrams : qty;
  return Object.fromEntries(Object.entries(food.nutrients).map(([k, v]) => [k, v == null ? null : v * servings]));
}

/** Pick a quantity of the base portion that delivers ≈ `want` of nutrient `key`. */
function sizeFor(item, key, want, maxQty = 3) {
  const per = nutrientsFor(item.food, item.grams, 1)[key] || 0;
  if (!per || !want) return 1;
  const raw = want / per;
  const step = item.step ?? 1;
  return clamp(Math.round(raw / step) * step, step, maxQty);
}

function entry(item, qty, reason) {
  const n = nutrientsFor(item.food, item.grams, qty);
  const label = qty === 1 ? item.label : `${qty} × ${item.label}`;
  return { key: item.key, food: item.food, portion: { label: item.label, grams: item.grams, quantity: qty }, portionText: label, nutrients: n, reason };
}

const short = (n) => `${Math.round(n.protein)} g protein · ${Math.round(n.kcal)} kcal`;

/**
 * @param o.targets   {kcal, protein, carbs, fat, fiber, goalApplied} | null
 * @param o.eaten     totals so far today {kcal, protein, carbs, fat, fiber}
 * @param o.weightKg  latest body weight or null
 * @param o.workout   { minutesUntil } (negative = minutes since it started) | null
 * @param o.catalog   [{ key, food, label, grams, step, roles }]
 * @param o.favorites [{ food, timesLogged, portion: {label, grams, quantity} }]
 * @param o.hour      local hour 0–23
 * @returns [{ id, title, subtitle, items: [entry] }]
 */
export function suggestFoods({ targets, eaten, weightKg, workout = null, catalog, favorites = [], hour = 12 }) {
  const has = targets && !targets.missing && targets.kcal;
  const goal = targets?.goalApplied ?? 'maintain';
  const left = has ? {
    kcal: targets.kcal - eaten.kcal, protein: targets.protein - eaten.protein,
    carbs: targets.carbs - eaten.carbs, fiber: (targets.fiber ?? 0) - (eaten.fiber ?? 0),
  } : null;
  const perSitting = weightKg ? clamp(Math.round(weightKg * 0.4), 20, 50) : 30;
  const preCarbs = weightKg ? clamp(Math.round(weightKg * 0.5), 20, 60) : 30;
  const groups = [];
  const used = new Set();
  const take = (items, n) => {
    const out = [];
    for (const it of items) { if (out.length >= n) break; if (used.has(it.key)) continue; used.add(it.key); out.push(it); }
    return out;
  };
  const byRole = (role) => catalog.filter((c) => c.roles.includes(role));
  const per100kcal = (c, k) => { const n = nutrientsFor(c.food, c.grams, 1); return n.kcal ? (n[k] ?? 0) / n.kcal : 0; };
  const cutting = goal === 'fat_loss';
  const bulking = goal === 'muscle' || goal === 'performance';
  const kcalRoom = left ? left.kcal : Infinity;

  // 1. Around training.
  const mu = workout?.minutesUntil;
  if (mu != null && mu > 0 && mu <= 120) {
    const quick = byRole('quick').filter((c) => { const n = nutrientsFor(c.food, c.grams, 1); return (n.fat ?? 0) < 12 && (n.fiber ?? 0) < 5; })
      .sort((a, b) => per100kcal(b, 'carbs') - per100kcal(a, 'carbs'));
    const items = take(quick, 3).map((c) => { const q = sizeFor(c, 'carbs', preCarbs, 2); return entry(c, q, `${Math.round(nutrientsFor(c.food, c.grams, q).carbs)} g fast carbs · light on the stomach`); });
    if (items.length) groups.push({ id: 'pre', tab: 'Pre-Lift', title: 'Before Your Workout', subtitle: `About ${preCarbs} g of quick carbs ${mu <= 45 ? 'now' : 'in the next hour'}${weightKg ? ' for your weight' : ''}`, items });
  } else if (mu != null && mu <= 0 && mu >= -180) {
    const rec = byRole('recovery').sort((a, b) => per100kcal(b, 'protein') + per100kcal(b, 'carbs') * 0.5 - (per100kcal(a, 'protein') + per100kcal(a, 'carbs') * 0.5));
    const items = take(rec, 3).map((c) => {
      const pr = nutrientsFor(c.food, c.grams, 1).protein;
      const q = pr >= 8 ? sizeFor(c, 'protein', perSitting, 2) : 1;
      return entry(c, q, short(nutrientsFor(c.food, c.grams, q)));
    });
    if (items.length) groups.push({ id: 'post', tab: 'Recovery', title: 'After Your Workout', subtitle: `Aim for ~${perSitting} g protein plus carbs`, items });
  }

  // 2. What they already eat, when it helps the biggest gap.
  if (favorites.length && has) {
    const proteinGap = left.protein >= 15;
    const calGap = bulking && left.kcal >= 300;
    const fits = favorites.filter((f) => f.timesLogged >= 2).map((f) => {
      const q = f.portion?.quantity ?? 1, g = f.portion?.grams ?? f.food.basisGrams ?? 100;
      const n = nutrientsFor(f.food, g, q);
      const score = proteinGap ? (n.kcal ? n.protein / n.kcal : 0) * 100 : calGap ? n.kcal / 100 : 0;
      return { f, n, q, g, score };
    }).filter((x) => x.score > (proteinGap ? 4 : calGap ? 1.5 : Infinity) && x.n.kcal <= Math.max(kcalRoom, bulking ? 900 : 0) + 50)
      .sort((a, b) => b.score - a.score).slice(0, 3);
    if (fits.length) groups.push({ id: 'favorites', tab: 'Yours', title: 'From What You Eat', subtitle: proteinGap ? 'Foods you log often that close your protein gap' : 'Foods you log often that add easy calories',
      items: fits.map((x) => ({ key: `fav:${x.f.food.sourceId ?? x.f.food.name}`, food: x.f.food, portion: { label: x.f.portion?.label ?? x.f.food.basisLabel, grams: x.g, quantity: x.q },
        portionText: x.f.portion?.label ? `${x.q === 1 ? '' : `${x.q} × `}${x.f.portion.label}` : x.f.food.basisLabel, nutrients: x.n,
        reason: `Logged ${x.f.timesLogged}× · ${short(x.n)}` })) });
  }

  // 3. The main gap.
  if (has && left.protein >= 15 && kcalRoom > 80) {
    const want = Math.min(left.protein, perSitting);
    const pool = byRole('protein').sort((a, b) => cutting ? per100kcal(b, 'protein') - per100kcal(a, 'protein')
      : (nutrientsFor(b.food, b.grams, 1).protein - nutrientsFor(a.food, a.grams, 1).protein) + (per100kcal(b, 'protein') - per100kcal(a, 'protein')) * 20);
    const items = take(pool.filter((c) => nutrientsFor(c.food, c.grams, 1).kcal <= kcalRoom + 100), 3).map((c) => {
      const q = sizeFor(c, 'protein', want); return entry(c, q, short(nutrientsFor(c.food, c.grams, q)));
    });
    if (items.length) groups.push({ id: 'protein', tab: 'Protein', title: 'Close Your Protein Gap', subtitle: `${Math.round(left.protein)} g to go · ~${want} g per sitting${weightKg ? ' for your weight' : ''}`, items });
  }
  if (has && bulking && left.kcal >= 400) {
    const pool = byRole('dense').sort((a, b) => nutrientsFor(b.food, b.grams, 1).kcal - nutrientsFor(a.food, a.grams, 1).kcal);
    const items = take(pool, 3).map((c) => entry(c, 1, short(nutrientsFor(c.food, c.grams, 1))));
    if (items.length) groups.push({ id: 'dense', tab: 'Calories', title: 'Easy Calories', subtitle: `${Math.round(left.kcal)} kcal left to hit your bulk`, items });
  }
  const fiberGroup = () => {
    if (!(has && left.fiber >= 8 && kcalRoom > 100)) return;
    const pool = byRole('fiber').sort((a, b) => per100kcal(b, 'fiber') - per100kcal(a, 'fiber'));
    const items = take(pool, 3).map((c) => entry(c, 1, `${r1(nutrientsFor(c.food, c.grams, 1).fiber)} g fiber · ${Math.round(nutrientsFor(c.food, c.grams, 1).kcal)} kcal`));
    if (items.length) groups.push({ id: 'fiber', tab: 'Fiber', title: 'Add Fiber', subtitle: `${Math.round(left.fiber)} g fiber to go`, items });
  };

  // 4. Quick energy (sugar): when there's room for it and it's useful.
  if (!groups.some((g) => g.id === 'pre') && (!has || (kcalRoom >= 200 && (bulking || mu != null || hour < 17)))) {
    const items = take(['pbj', 'banana', 'honey', 'gummies', 'dates', 'oj'].map((k) => catalog.find((c) => c.key === k)).filter(Boolean), 3)
      .map((c) => entry(c, 1, `${Math.round(nutrientsFor(c.food, c.grams, 1).sugars ?? 0)} g sugar · ${Math.round(nutrientsFor(c.food, c.grams, 1).kcal)} kcal`));
    if (items.length) groups.push({ id: 'quick', tab: 'Sugar', title: 'Quick Energy', subtitle: 'Sugar your body uses fast: good before training or when you’re dragging', items });
  }

  fiberGroup();

  // 5. On target: lighter options only.
  if (has && left.kcal < 150 && left.protein < 15) {
    const items = take(byRole('light').sort((a, b) => nutrientsFor(a.food, a.grams, 1).kcal - nutrientsFor(b.food, b.grams, 1).kcal), 3)
      .map((c) => entry(c, 1, `${Math.round(nutrientsFor(c.food, c.grams, 1).kcal)} kcal · filling`));
    groups.unshift({ id: 'done', tab: 'Light', title: 'You’re on Target', subtitle: 'If you’re still hungry, these are light', items });
  }

  return groups.slice(0, 4);
}

/** One-line teaser for the Nutrition screen. */
export function headline(groups) {
  const g = groups[0]; const it = g?.items?.[0];
  if (!it) return null;
  return { title: g.title, text: `${it.food.displayName ?? it.food.name} · ${it.portionText}` };
}
