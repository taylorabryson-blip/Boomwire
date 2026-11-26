/**
 * N10 — Natural-language meal parser (pure, no I/O).
 * "two eggs, a cup of oatmeal and a banana" →
 *   [{qty:2, unit:null, food:'eggs'}, {qty:1, unit:'cup', food:'oatmeal'}, {qty:1, unit:null, food:'banana'}]
 * and portion matching against USDA household measures.
 */
const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, half: 0.5, couple: 2, few: 3, some: 1 };
const UNITS = {
  cup: ['cup', 'cups'], tbsp: ['tbsp', 'tablespoon', 'tablespoons', 'tbs'], tsp: ['tsp', 'teaspoon', 'teaspoons'],
  oz: ['oz', 'ounce', 'ounces'], floz: ['fl oz', 'fluid ounce', 'fluid ounces'], g: ['g', 'gram', 'grams', 'gr'], kg: ['kg', 'kilo', 'kilos'],
  lb: ['lb', 'lbs', 'pound', 'pounds'], ml: ['ml', 'milliliter', 'milliliters'], slice: ['slice', 'slices'], piece: ['piece', 'pieces', 'pc', 'pcs'],
  scoop: ['scoop', 'scoops'], serving: ['serving', 'servings'], can: ['can', 'cans'], bowl: ['bowl', 'bowls'], glass: ['glass', 'glasses'],
  breast: ['breast', 'breasts'], fillet: ['fillet', 'fillets'], stick: ['stick', 'sticks'], handful: ['handful', 'handfuls'],
};
const SIZES = ['small', 'medium', 'large', 'extra large', 'jumbo'];
const UNIT_LOOKUP = Object.entries(UNITS).flatMap(([k, ws]) => ws.map((w) => [w, k])).sort((a, b) => b[0].length - a[0].length);
const FILLER = /^(i\s+(had|ate|drank|got)|for\s+(breakfast|lunch|dinner|snack)s?\s+i\s+(had|ate)|i'?m\s+having|log|add|and|with|plus|also|then)\s+/i;

/** Split a sentence into item phrases. */
export function splitItems(text) {
  return String(text).toLowerCase()
    .replace(/(?<!\d)\.|\.(?!\d)|[;!?]/g, ',')
    .split(/,|\band\b|\bwith\b|\bplus\b|&|\bthen\b|\balso\b|\n/)
    .map((s) => s.trim().replace(FILLER, '').replace(FILLER, '').trim())
    .filter((s) => s && !/^(i|had|ate|for|breakfast|lunch|dinner)$/.test(s));
}

function parseQty(tokens) {
  let qty = null, i = 0;
  const t0 = tokens[0];
  if (t0 == null) return { qty: 1, i: 0 };
  const frac = t0.match(/^(\d+)\/(\d+)$/);
  const mixed = t0.match(/^(\d+(?:\.\d+)?)$/);
  if (frac) { qty = Number(frac[1]) / Number(frac[2]); i = 1; }
  else if (mixed) {
    qty = Number(mixed[1]); i = 1;
    const f2 = tokens[1]?.match(/^(\d+)\/(\d+)$/);
    if (f2) { qty += Number(f2[1]) / Number(f2[2]); i = 2; }
  } else if (/^\d+(\.\d+)?[a-z]+$/.test(t0)) { // "200g", "8oz"
    const m = t0.match(/^(\d+(?:\.\d+)?)([a-z]+)$/); return { qty: Number(m[1]), i: 1, glued: m[2] };
  } else if (t0 in NUM_WORDS) {
    qty = NUM_WORDS[t0]; i = 1;
    if ((t0 === 'a' || t0 === 'an') && tokens[1] === 'half') { qty = 0.5; i = 2; }
    if (t0 === 'couple' || t0 === 'few') { if (tokens[1] === 'of') i = 2; }
    if (tokens[i] === 'and' && tokens[i + 1] === 'a' && tokens[i + 2] === 'half') { qty += 0.5; i += 3; }
  }
  return { qty: qty ?? 1, i };
}

/** Parse one phrase → { qty, unit, size, food }. */
export function parseItem(phrase) {
  let tokens = phrase.trim().split(/\s+/).filter(Boolean);
  const { qty, i, glued } = parseQty(tokens);
  tokens = tokens.slice(i);
  let unit = null, size = null;
  const rest = tokens.join(' ');
  if (glued) unit = UNIT_LOOKUP.find(([w]) => w === glued)?.[1] ?? null;
  let body = rest;
  if (!unit) {
    for (const [w, k] of UNIT_LOOKUP) {
      if (body === w || body.startsWith(w + ' ')) { unit = k; body = body.slice(w.length).trim(); break; }
    }
  }
  for (const s of SIZES.slice().reverse()) if (body.startsWith(s + ' ')) { size = s; body = body.slice(s.length).trim(); break; }
  body = body.replace(/^of\s+/, '').replace(/^(a|an|the|some)\s+/, '').trim();
  // "chicken breast" keeps "breast" as food, not unit, when nothing follows
  if (!body && unit && ['breast', 'fillet', 'stick'].includes(unit)) { body = phrase.replace(/^\S+\s+/, ''); unit = null; }
  return { qty: Math.round(qty * 100) / 100, unit, size, food: body, explicit: i > 0 || !!glued };
}

export function parseMeal(text) {
  return splitItems(text).map(parseItem).filter((x) => x.food && x.food.length > 1);
}

const MASS = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
const VOLUME_ML = { ml: 1, floz: 29.5735 };
const WORDS = { cup: ['cup'], tbsp: ['tbsp', 'tablespoon'], tsp: ['tsp', 'teaspoon'], slice: ['slice'], piece: ['piece', 'item', 'each', 'unit'], scoop: ['scoop'],
  can: ['can'], breast: ['breast', 'half breast'], fillet: ['fillet'], stick: ['stick'], serving: ['serving', 'nlea'], bowl: ['cup'], glass: ['cup'] };

/**
 * N11 — portion matching. Returns { grams, label, estimated }.
 * Exact mass units convert directly; household units use the food's USDA measure;
 * size words ("large") pick that measure; otherwise one typical unit (medium/large/NLEA/first).
 */
export function matchPortion(item, portions = [], { liquid = false } = {}) {
  const q = item.qty || 1;
  const fmt = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));
  if (item.unit && MASS[item.unit]) return { grams: q * MASS[item.unit], label: `${fmt(q)} ${item.unit}`, estimated: false };
  if (item.unit && VOLUME_ML[item.unit]) return { grams: q * VOLUME_ML[item.unit], label: `${fmt(q)} ${item.unit === 'floz' ? 'fl oz' : 'ml'}`, estimated: !liquid };
  const find = (words) => portions.find(([l]) => words.some((w) => new RegExp(`^\\s*[\\d./]+\\s+${w}\\b`, 'i').test(l)))
    ?? portions.find(([l]) => words.some((w) => new RegExp(`(^|[^a-z])${w}\\b`, 'i').test(l) && !(w === 'large' && /extra large/i.test(l))));
  const bowlFactor = item.unit === 'bowl' ? 1.5 : 1;
  if (item.unit && WORDS[item.unit]) {
    const p = find(WORDS[item.unit]);
    if (p) { const per = p[1] / leadingNumber(p[0]); return { grams: q * per * bowlFactor, label: `${fmt(q)} ${UNIT_LABEL[item.unit]}${q > 1 ? 's' : ''}`, estimated: item.unit === 'bowl' }; }
  }
  if (item.size) { const p = find([item.size === 'extra large' ? 'extra large' : item.size]); if (p) return { grams: q * p[1] / leadingNumber(p[0]), label: `${fmt(q)} ${item.size}`, estimated: false }; }
  const typical = (/\begg/.test(item.food ?? '') ? find(['large']) : null) ?? find(['medium']) ?? find(['large']) ?? find(['each', 'piece', 'item', 'slice', 'breast', 'fillet']) ?? find(['nlea', 'serving']) ?? portions[0];
  if (typical) return { grams: q * typical[1] / leadingNumber(typical[0]), label: `${fmt(q)} ${typical[0].replace(/^1\s+/, '').split(/[,(]/)[0].trim()}`, estimated: !!item.unit };
  return { grams: q * 100, label: `${fmt(q * 100)} g`, estimated: true };
}
function leadingNumber(label) { const m = String(label).match(/^\s*(\d+(?:\.\d+)?)(?:\/(\d+))?/); if (!m) return 1; return m[2] ? Number(m[1]) / Number(m[2]) : Number(m[1]) || 1; }
const UNIT_LABEL = { cup: 'cup', tbsp: 'tbsp', tsp: 'tsp', slice: 'slice', piece: 'piece', scoop: 'scoop', can: 'can', breast: 'breast', fillet: 'fillet', stick: 'stick', serving: 'serving', bowl: 'bowl', glass: 'glass' };
