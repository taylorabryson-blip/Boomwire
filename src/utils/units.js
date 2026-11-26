/**
 * Unit conversion. Storage is ALWAYS metric (ml, kg, cm); conversion happens
 * only at the presentation boundary. Constants are exact definitions:
 *   1 US fluid ounce = 29.5735295625 ml (NIST Handbook 44)
 *   1 lb  = 0.45359237 kg (international avoirdupois pound, exact)
 *   1 in  = 2.54 cm (exact)
 */
export const ML_PER_US_FL_OZ = 29.5735295625;
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const mlToFlOz = (ml) => ml / ML_PER_US_FL_OZ;
export const flOzToMl = (oz) => oz * ML_PER_US_FL_OZ;
export const kgToLb = (kg) => kg / KG_PER_LB;
export const lbToKg = (lb) => lb * KG_PER_LB;
export const cmToIn = (cm) => cm / CM_PER_IN;
export const inToCm = (inch) => inch * CM_PER_IN;

/** Round to a fixed number of decimals without floating noise. */
export function round(value, decimals = 0) {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/**
 * Format a volume stored in ml for display.
 * @returns {{value: string, unit: string}}
 */
export function formatVolume(ml, units = 'metric') {
  if (ml == null || Number.isNaN(ml)) return { value: '—', unit: '' };
  if (units === 'imperial') return { value: String(round(mlToFlOz(ml), 1)), unit: 'fl oz' };
  if (ml >= 1000) return { value: round(ml / 1000, 2).toFixed(2).replace(/0$/, ''), unit: 'L' };
  return { value: String(Math.round(ml)), unit: 'ml' };
}

export const volumeString = (ml, units) => { const v = formatVolume(ml, units); return `${v.value} ${v.unit}`.trim(); };

/** Convert a user-entered volume (in their display unit) to stored ml. */
export function volumeInputToMl(value, units = 'metric') {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(units === 'imperial' ? flOzToMl(n) : n);
}

export const volumeInputUnit = (units) => (units === 'imperial' ? 'fl oz' : 'ml');
