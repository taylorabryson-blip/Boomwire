/**
 * Haptic feedback.
 * iOS Safari has no Vibration API, but since iOS 18 toggling a native
 * <input type="checkbox" switch> produces a system haptic tick. We keep one
 * hidden switch and toggle it through its <label> (must happen inside a user
 * gesture). Other platforms fall back to navigator.vibrate.
 */
let label = null;
function ensure() {
  if (label || typeof document === 'undefined') return;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.id = 'haptic-switch';
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');
  label = document.createElement('label');
  label.htmlFor = 'haptic-switch';
  label.setAttribute('aria-hidden', 'true');
  label.style.cssText = 'position:fixed;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none;left:-10px;top:-10px';
  label.append(input);
  document.body.append(label);
}

let enabled = (() => { try { return localStorage.getItem('hercules:haptics') !== '0'; } catch { return true; } })();
export function setHapticsEnabled(v) { enabled = !!v; try { localStorage.setItem('hercules:haptics', v ? '1' : '0'); } catch { /* private mode */ } }
export const hapticsEnabled = () => enabled;

export function haptic(kind = 'light') {
  if (!enabled) return;
  try {
    ensure();
    if (navigator.vibrate) navigator.vibrate(kind === 'success' ? [8, 40, 12] : kind === 'heavy' ? 18 : 8);
    else label?.click();
    if (kind === 'success') setTimeout(() => label?.click(), 90);
  } catch { /* haptics are best-effort */ }
}
