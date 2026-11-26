/**
 * Brand marks (original artwork, monochrome; based on classical iconography).
 *  - CRATOS: archaic Greek wings (Cratos was one of Zeus's winged enforcers) around a classical C (Latin spelling).
 *  - HERCULES: a classical H between running-meander (Greek key) friezes.
 * Letterforms: Cinzel (SIL Open Font License), converted to outlines.
 * Paths use fill/stroke = currentColor so they theme cleanly.
 */
import { svg } from './dom.js';

const WINGS = ["M42.00 45.00Q23.40 30.10 9.09 18.00Q20.52 35.09 42.00 45.00Z", "M42.00 46.80Q22.83 36.79 9.28 29.07Q21.05 42.26 42.00 46.80Z", "M42.00 48.60Q23.38 43.02 11.37 39.18Q22.78 48.75 42.00 48.60Z", "M42.00 50.40Q24.85 48.58 14.95 47.94Q25.45 54.31 42.00 50.40Z", "M42.00 52.20Q26.97 53.30 19.56 55.09Q28.75 58.78 42.00 52.20Z", "M42.00 54.00Q29.46 57.08 24.68 60.50Q32.34 62.07 42.00 54.00Z", "M42.00 48.00C32.00 41.00 22.00 33.00 12.00 27.00C15.00 33.00 28.00 45.00 38.00 52.00Z", "M58.00 45.00Q80.20 36.34 90.91 18.00Q77.32 31.35 58.00 45.00Z", "M58.00 46.80Q79.40 43.63 90.72 29.07Q77.62 38.16 58.00 46.80Z", "M58.00 48.60Q77.37 50.18 88.63 39.18Q76.77 44.46 58.00 48.60Z", "M58.00 50.40Q74.40 55.74 85.05 47.94Q75.00 50.01 58.00 50.40Z", "M58.00 52.20Q70.80 60.15 80.44 55.09Q72.58 54.67 58.00 52.20Z", "M58.00 54.00Q66.94 63.32 75.32 60.50Q69.82 58.33 58.00 54.00Z", "M58.00 48.00C68.00 41.00 78.00 33.00 88.00 27.00C85.00 33.00 72.00 45.00 62.00 52.00Z"];
const C_PATH = "M82.02 55.58 82.21 71.63Q80.00 75.38 76.35 78.41Q72.69 81.44 67.45 83.22Q62.21 85.00 55.19 85.00Q44.04 84.90 35.58 80.67Q27.12 76.44 22.45 68.61Q17.79 60.77 17.79 49.90Q17.79 39.23 22.40 31.39Q27.02 23.56 35.48 19.28Q43.94 15.00 55.58 15.00Q63.08 15.00 69.04 16.68Q75.00 18.37 79.13 20.67L79.90 36.15H79.04Q76.63 27.02 70.53 22.84Q64.42 18.65 56.25 18.65Q48.37 18.65 42.64 22.45Q36.92 26.25 33.80 33.22Q30.67 40.19 30.67 49.71Q30.67 59.23 33.70 66.30Q36.73 73.37 42.26 77.26Q47.79 81.15 55.19 81.35Q62.40 81.35 67.74 78.89Q73.08 76.44 76.49 70.77Q79.90 65.10 81.25 55.58Z";
const H_PATH = "M18.80 77.70L18.80 77.70L18.80 22.30Q18.70 19.70 16.85 17.85Q15 16 12.40 16L12.40 16L11.10 16L11.10 15L41.50 15L41.50 16L40.20 16Q37.60 16 35.75 17.85Q33.90 19.70 33.80 22.30L33.80 22.30L33.80 48L66.20 48L66.20 22.30Q66.20 19.70 64.30 17.85Q62.40 16 59.80 16L59.80 16L58.50 16L58.50 15L88.90 15L88.90 16L87.60 16Q85.00 16 83.15 17.85Q81.30 19.70 81.20 22.30L81.20 22.30L81.20 77.70Q81.30 80.30 83.15 82.15Q85.00 84 87.60 84L87.60 84L88.90 84L88.90 85L58.50 85L58.50 84L59.80 84Q62.40 84 64.30 82.15Q66.20 80.30 66.20 77.70L66.20 77.70L66.20 52.30L33.80 52.30L33.80 77.70Q33.90 80.30 35.75 82.15Q37.60 84 40.20 84L40.20 84L41.50 84L41.50 85L11.10 85L11.10 84L12.40 84Q15 84 16.85 82.15Q18.70 80.30 18.80 77.70Z";
const MEANDER = ["M16 21.8H84", "M16 11.68H84", "M19.20 21.80 L19.20 13.00 L25.80 13.00 L25.80 19.60 L21.40 19.60 L21.40 15.20 L23.60 15.20", "M28.00 21.80 L28.00 13.00 L34.60 13.00 L34.60 19.60 L30.20 19.60 L30.20 15.20 L32.40 15.20", "M36.80 21.80 L36.80 13.00 L43.40 13.00 L43.40 19.60 L39.00 19.60 L39.00 15.20 L41.20 15.20", "M45.60 21.80 L45.60 13.00 L52.20 13.00 L52.20 19.60 L47.80 19.60 L47.80 15.20 L50.00 15.20", "M54.40 21.80 L54.40 13.00 L61.00 13.00 L61.00 19.60 L56.60 19.60 L56.60 15.20 L58.80 15.20", "M63.20 21.80 L63.20 13.00 L69.80 13.00 L69.80 19.60 L65.40 19.60 L65.40 15.20 L67.60 15.20", "M72.00 21.80 L72.00 13.00 L78.60 13.00 L78.60 19.60 L74.20 19.60 L74.20 15.20 L76.40 15.20", "M16 86.8H84", "M16 76.68H84", "M19.20 86.80 L19.20 78.00 L25.80 78.00 L25.80 84.60 L21.40 84.60 L21.40 80.20 L23.60 80.20", "M28.00 86.80 L28.00 78.00 L34.60 78.00 L34.60 84.60 L30.20 84.60 L30.20 80.20 L32.40 80.20", "M36.80 86.80 L36.80 78.00 L43.40 78.00 L43.40 84.60 L39.00 84.60 L39.00 80.20 L41.20 80.20", "M45.60 86.80 L45.60 78.00 L52.20 78.00 L52.20 84.60 L47.80 84.60 L47.80 80.20 L50.00 80.20", "M54.40 86.80 L54.40 78.00 L61.00 78.00 L61.00 84.60 L56.60 84.60 L56.60 80.20 L58.80 80.20", "M63.20 86.80 L63.20 78.00 L69.80 78.00 L69.80 84.60 L65.40 84.60 L65.40 80.20 L67.60 80.20", "M72.00 86.80 L72.00 78.00 L78.60 78.00 L78.60 84.60 L74.20 84.60 L74.20 80.20 L76.40 80.20"];

const kratosInner = () => WINGS.map((d) => `<path d="${d}"/>`).join('') + `<g transform="translate(50 54) scale(.34) translate(-50 -50)"><path d="${C_PATH}"/></g>`;

/** Cratos emblem (tab icon, inline marks). */
export function kratosMark(size = 24) {
  return svg(`<svg width="${size}" height="${size}" viewBox="8 18 84 60" fill="currentColor" role="img" aria-label="Cratos">${kratosInner()}</svg>`);
}

/** Hercules mark: H between Greek-key friezes. */
export function herculesMark(size = 24) {
  const lines = MEANDER.map((d) => `<path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6"/>`).join('');
  return svg(`<svg width="${size}" height="${size}" viewBox="10 8 80 84" fill="currentColor" role="img" aria-label="Hercules">${lines}<g transform="translate(50 50) scale(.62) translate(-50 -50)"><path d="${H_PATH}"/></g></svg>`);
}

/** Cratos avatar: winged K in a dark disc with a hairline ring. */
export function kratosAvatar(size = 32) {
  return svg(`<svg width="${size}" height="${size}" viewBox="0 0 100 100" aria-hidden="true">
    <defs><radialGradient id="kav" cx="50%" cy="30%" r="75%"><stop offset="0" stop-color="#2e2e33"/><stop offset="1" stop-color="#0b0b0c"/></radialGradient>
    <linearGradient id="kst" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#a6a6ad"/></linearGradient></defs>
    <circle cx="50" cy="50" r="49" fill="url(#kav)" stroke="rgba(255,255,255,.18)" stroke-width="1.5"/>
    <g transform="translate(50 52) scale(.86) translate(-50 -50)" fill="url(#kst)">${kratosInner()}</g></svg>`);
}
