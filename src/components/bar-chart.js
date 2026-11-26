/**
 * Minimal SVG bar chart for daily series.
 * @param {{ bars: {label: string, value: number|null, highlight?: boolean}[], goal?: number|null, height?: number, formatMax?: (v:number)=>string }} p
 * value === null renders no bar (no data) — distinct from a recorded 0.
 */
import { svg } from './dom.js';

export function BarChart({ bars, goal = null, height = 140, formatMax = String }) {
  const W = 320, top = 18, bottom = 22, plotH = height - top - bottom;
  const values = bars.map((b) => b.value ?? 0);
  const max = Math.max(1, goal ?? 0, ...values) * 1.08;
  const slot = W / bars.length, bw = Math.min(28, slot * 0.56);
  const y = (v) => top + plotH - (v / max) * plotH;
  const peak = Math.max(...values);
  let out = '';
  bars.forEach((b, i) => {
    const cx = slot * i + slot / 2;
    if (b.value != null && b.value > 0) {
      const bh = Math.max(3, (b.value / max) * plotH);
      out += `<rect class="chart__bar ${b.highlight ? 'chart__bar--today' : ''}" x="${cx - bw / 2}" y="${top + plotH - bh}" width="${bw}" height="${bh}" rx="5"/>`;
      if (b.value === peak) out += `<text class="chart__value" x="${cx}" y="${top + plotH - bh - 6}" text-anchor="middle">${formatMax(b.value)}</text>`;
    }
    out += `<text class="chart__label ${b.highlight ? 'chart__label--today' : ''}" x="${cx}" y="${height - 5}" text-anchor="middle">${b.label}</text>`;
  });
  if (goal) out += `<line class="chart__goal" x1="0" x2="${W}" y1="${y(goal)}" y2="${y(goal)}"/>`;
  out += `<line x1="0" x2="${W}" y1="${top + plotH + 0.5}" y2="${top + plotH + 0.5}" stroke="var(--c-separator)"/>`;
  return svg(`<svg class="chart" viewBox="0 0 ${W} ${height}" role="img" aria-label="Daily bar chart">${out}</svg>`);
}
