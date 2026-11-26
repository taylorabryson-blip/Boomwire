/**
 * Unit conversion. Storage is ALWAYS metric (ml, kg, cm) so nothing is lost
 * when a user switches units; conversion happens only at display/input.
 * Exact definitions:
 *   1 US fluid ounce = 29.5735295625 ml (NIST Handbook 44)
 *   1 US cup (customary) = 8 US fl oz
 *   1 lb = 0.45359237 kg (international avoirdupois pound)
 *   1 in = 2.54 cm
 *
 * Settings value `units`: 'imperial' = US customary (default), 'metric'.
 */
export const ML_PER_US_FL_OZ = 29.5735295625;
export const FL_OZ_PER_CUP = 8;
export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export const mlToFlOz = (ml) => ml / ML_PER_US_FL_OZ;
export const flOzToMl = (oz) => oz * ML_PER_US_FL_OZ;
export const mlToCups = (ml) => mlToFlOz(ml) / FL_OZ_PER_CUP;
export const kgToLb = (kg) => kg / KG_PER_LB;
export const lbToKg = (lb) => lb * KG_PER_LB;
export const cmToIn = (cm) => cm / CM_PER_IN;
export const inToCm = (inch) => inch * CM_PER_IN;

/** Round without floating noise. */
export function round(value, decimals = 0) {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** Number → string with at most `d` decimals and no trailing zeros. */
export function trim(value, d = 1) {
  return String(round(value, d));
}

/* ---- Volume (water) ----------------------------------------------------- */

/** @returns {{value: string, unit: string}} */
export function formatVolume(ml, units = 'imperial') {
  if (ml == null || Number.isNaN(ml)) return { value: '—', unit: '' };
  if (units === 'metric') {
    if (ml >= 1000) return { value: trim(ml / 1000, 2), unit: 'L' };
    return { value: String(Math.round(ml)), unit: 'ml' };
  }
  return { value: trim(mlToFlOz(ml), 1), unit: 'oz' };
}
export const volumeString = (ml, units) => { const v = formatVolume(ml, units); return `${v.value} ${v.unit}`.trim(); };

/** Cups, to the nearest quarter cup, e.g. "5½ cups". US only. */
export function cupsString(ml) {
  const q = Math.round(mlToCups(ml) * 4) / 4;
  const whole = Math.floor(q), frac = q - whole;
  const f = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : '';
  const n = whole === 0 && f ? f : `${whole}${f}`;
  return `${n} ${q === 1 ? 'cup' : 'cups'}`;
}

export function volumeInputToMl(value, units = 'imperial') {
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(units === 'metric' ? n : flOzToMl(n));
}
export const volumeInputUnit = (units) => (units === 'metric' ? 'ml' : 'oz');

/* ---- Weight -------------------------------------------------------------- */
export const weightUnit = (units) => (units === 'metric' ? 'kg' : 'lb');
export function weightValue(kg, units = 'imperial', d = 1) {
  if (kg == null || Number.isNaN(kg)) return null;
  return round(units === 'metric' ? kg : kgToLb(kg), d);
}
export function weightString(kg, units, d = 1) {
  const v = weightValue(kg, units, d);
  return v == null ? '—' : `${v} ${weightUnit(units)}`;
}
/** User input in display unit → kg (unrounded so round-trips are exact). */
export function weightInputToKg(value, units = 'imperial') {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return units === 'metric' ? n : lbToKg(n);
}

/* ---- Length -------------------------------------------------------------- */
export const lengthUnit = (units) => (units === 'metric' ? 'cm' : 'in');
export function lengthValue(cm, units = 'imperial', d = 1) {
  if (cm == null || Number.isNaN(cm)) return null;
  return round(units === 'metric' ? cm : cmToIn(cm), d);
}
export function lengthString(cm, units, d = 1) {
  const v = lengthValue(cm, units, d);
  return v == null ? '—' : `${v} ${lengthUnit(units)}`;
}
export function lengthInputToCm(value, units = 'imperial') {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return NaN;
  return units === 'metric' ? n : inToCm(n);
}

/** Height display: 5′ 11″ or 180 cm. */
export function heightString(cm, units) {
  if (cm == null) return '—';
  if (units === 'metric') return `${Math.round(cm)} cm`;
  const totalIn = Math.round(cmToIn(cm));
  return `${Math.floor(totalIn / 12)}′ ${totalIn % 12}″`;
}
