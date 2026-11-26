/**
 * Minimal SVG line chart for a time series of recorded values.
 * Points are plotted by index (not calendar spacing) and labelled by date.
 * @param {{points: {label: string, value: number}[], format?: (v:number)=>string, height?: number}} p
 */
import { svg } from './dom.js';

export function LineChart({ points, format = String, height = 150 }) {
  const W = 320, top = 22, bottom = 22, left = 4, right = 4, H = height;
  if (!points.length) return svg('<svg class="chart" viewBox="0 0 320 40"></svg>');
  const vals = points.map((p) => p.value);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15; min -= pad; max += pad;
  const x = (i) => (points.length === 1 ? W / 2 : left + (i / (points.length - 1)) * (W - left - right));
  const y = (v) => top + (1 - (v - min) / (max - min)) * (H - top - bottom);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`).join(' ');
  const area = `${d} L${x(points.length - 1)} ${H - bottom} L${x(0)} ${H - bottom} Z`;
  const last = points.at(-1), first = points[0];
  const hiI = vals.indexOf(Math.max(...vals));
  let out = `<defs><linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
  out += `<line class="chart__grid" x1="0" x2="${W}" y1="${H - bottom + 0.5}" y2="${H - bottom + 0.5}"/>`;
  if (points.length > 1) out += `<path class="chart__area" d="${area}"/><path class="chart__line" d="${d}"/>`;
  points.forEach((p, i) => { if (points.length <= 14 || i === points.length - 1 || i === 0) out += `<circle class="chart__dot" cx="${x(i)}" cy="${y(p.value)}" r="${i === points.length - 1 ? 4 : 2.5}"/>`; });
  out += `<text class="chart__value" x="${Math.min(W - 30, Math.max(30, x(hiI)))}" y="${y(vals[hiI]) - 9}" text-anchor="middle">${esc(format(vals[hiI]))}</text>`;
  out += `<text class="chart__label" x="${x(0)}" y="${H - 5}" text-anchor="start">${esc(first.label)}</text>`;
  if (points.length > 1) out += `<text class="chart__label chart__label--today" x="${x(points.length - 1)}" y="${H - 5}" text-anchor="end">${esc(last.label)}</text>`;
  return svg(`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Trend chart">${out}</svg>`);
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
