/**
 * Helper for screens that re-render when data changes.
 * build(refresh) returns an array of nodes. It re-runs on any repository
 * change, or when the screen calls refresh() after changing view state.
 */
import * as repo from '../../services/storage/repository.js';

export async function liveScreen(root, build) {
  let pending = false;
  // Skip conditional sections that evaluated to null/undefined/false/0.
  const draw = async () => { root.replaceChildren(...(await build(refresh)).filter((n) => n instanceof Node || (typeof n === 'string' && n))); };
  function refresh() {
    if (pending) return;
    pending = true;
    queueMicrotask(async () => { pending = false; await draw(); });
  }
  await draw();
  return repo.onChange(refresh);
}
