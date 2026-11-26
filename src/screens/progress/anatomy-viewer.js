/**
 * Three.js anatomy viewer (Phase 4).
 * Loads assets/models/muscles.glb — a real human anatomy model built from
 * BodyParts3D scan data (CC BY-SA 2.1 JP, see tools/build-anatomy-bp3d.py).
 * Nodes named `muscle__<id>__<side>` are individually selectable and colored
 * by the workload heat map; `context__muscles` / `context__bones` are neutral.
 * Renders on demand (only when something changes) to save battery.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { MUSCLE_BY_ID } from '../../data/anatomy/muscles.js';

const MODEL_URL = 'assets/models/muscles.glb';
const C_EMPTY = new THREE.Color(0x6e6e76);
const C_LOW = new THREE.Color(0x5a3a30);
const C_MID = new THREE.Color(0xa8492b);
const C_HIGH = new THREE.Color(0xff6a3d);
const C_SELECT = new THREE.Color(0xffffff);

export function heatColor(t) {
  if (!t) return C_EMPTY.clone();
  const c = new THREE.Color();
  return t < 0.5 ? c.lerpColors(C_LOW, C_MID, t / 0.5) : c.lerpColors(C_MID, C_HIGH, (t - 0.5) / 0.5);
}

let gltfCache = null;

export async function createAnatomyViewer(container, { onSelect } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0.9, 3.8);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x303036, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.8); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.6); rim.position.set(-3, 2, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(-2, 0.5, 3); scene.add(fill);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0.8, 0);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.6;
  controls.maxDistance = 6;
  controls.minPolarAngle = Math.PI * 0.32;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.rotateSpeed = 0.7;

  if (!gltfCache) gltfCache = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODEL_URL);
  const model = gltfCache.scene.clone(true);
  scene.add(model);

  const muscles = new Map(); // id -> meshes[]
  const contextMuscleMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.7, metalness: 0 });
  const boneMat = new THREE.MeshStandardMaterial({ color: 0x8f8a80, roughness: 0.8, metalness: 0 });
  const skinMat = contextMuscleMat; // kept for dispose()
  // gltfpack moves names onto parent nodes: walk up to find `kind__id__side`.
  const tagOf = (o) => { for (let n = o; n; n = n.parent) if (n.name?.includes('__')) return n.name; return ''; };
  model.traverse((o) => {
    if (!o.isMesh) return;
    const [kind, id] = tagOf(o).split('__');
    if (kind === 'muscle') {
      o.material = new THREE.MeshStandardMaterial({ color: C_EMPTY.clone(), roughness: 0.5, metalness: 0.05, emissive: new THREE.Color(0) });
      o.userData.muscleId = id;
      if (!muscles.has(id)) muscles.set(id, []);
      muscles.get(id).push(o);
    } else o.material = id === 'bones' ? boneMat : contextMuscleMat;
  });

  let heat = {}, selected = null, group = null, needs = true;
  const invalidate = () => { needs = true; };

  function paint() {
    for (const [id, meshes] of muscles) {
      const inGroup = !group || MUSCLE_BY_ID[id]?.group === group;
      const c = id === selected ? C_SELECT : heatColor(heat[id] ?? 0);
      for (const m of meshes) {
        m.material.color.copy(c);
        m.material.opacity = inGroup ? 1 : 0.18;
        m.material.transparent = !inGroup;
        m.material.emissive.setHex(id === selected ? 0x333333 : 0);
      }
    }
    invalidate();
  }

  // Resize
  const ro = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    invalidate();
  });
  ro.observe(container);

  // Tap to select (distinguish from drag)
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 400) { down = null; return; }
    down = null;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects([...muscles.values()].flat().filter((m) => !m.material.transparent), false)[0];
    const id = hit?.object.userData.muscleId ?? null;
    onSelect?.(id === selected ? null : id);
  });
  controls.addEventListener('change', invalidate);

  // Animated azimuth for front/back buttons
  let anim = null;
  function rotateTo(azimuth) {
    const from = controls.getAzimuthalAngle();
    let delta = azimuth - from;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    anim = { from, delta, t0: performance.now(), dur: 650 };
  }

  // Projected screen position of a muscle (for HTML labels)
  const tmp = new THREE.Vector3(), box = new THREE.Box3();
  function screenPos(id) {
    const meshes = muscles.get(id);
    if (!meshes) return null;
    // Prefer the mesh facing the camera
    let best = null;
    for (const m of meshes) {
      box.setFromObject(m).getCenter(tmp);
      const toCam = camera.position.clone().sub(tmp).normalize();
      const n = tmp.clone().sub(new THREE.Vector3(0, tmp.y, 0)).normalize();
      const facing = n.dot(toCam);
      if (!best || facing > best.facing) best = { p: tmp.clone(), facing };
    }
    const v = best.p.project(camera);
    const r = renderer.domElement;
    return { x: (v.x + 1) / 2 * r.clientWidth, y: (1 - v.y) / 2 * r.clientHeight, visible: best.facing > -0.2 };
  }

  let raf = 0, alive = true, onFrame = null;
  function loop(now) {
    if (!alive) return;
    if (anim) {
      const k = Math.min(1, (now - anim.t0) / anim.dur);
      const e = 1 - (1 - k) ** 3;
      const az = anim.from + anim.delta * e;
      const off = camera.position.clone().sub(controls.target);
      const radius = Math.hypot(off.x, off.z);
      camera.position.x = controls.target.x + radius * Math.sin(az);
      camera.position.z = controls.target.z + radius * Math.cos(az);
      camera.lookAt(controls.target);
      needs = true;
      if (k >= 1) anim = null;
    }
    if (controls.update()) needs = true;
    if (needs) { renderer.render(scene, camera); needs = false; onFrame?.(); }
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);
  paint();

  return {
    setHeat(map) { heat = map; paint(); },
    setSelected(id) { selected = id; paint(); },
    setGroup(g) { group = g; paint(); },
    front() { rotateTo(0); },
    back() { rotateTo(Math.PI); },
    get azimuth() { return controls.getAzimuthalAngle(); },
    screenPos,
    onFrame(fn) { onFrame = fn; },
    dispose() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      model.traverse((o) => { if (o.isMesh && o.material !== skinMat) o.material.dispose(); });
      contextMuscleMat.dispose(); boneMat.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
