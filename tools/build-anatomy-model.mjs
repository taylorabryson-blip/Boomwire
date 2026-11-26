/**
 * Builds assets/models/muscles.glb — a stylized, anatomically ORGANIZED
 * muscle model for Hercules (Phase 4).
 *
 * Honesty note: this is a procedural, simplified figure (ellipsoid muscle
 * bellies placed at their anatomical locations on a base body), not a
 * medical-grade scan. The pipeline is asset-agnostic: any GLB whose meshes
 * are named `muscle__<id>__<l|r|c>` (GLTFLoader strips ':' from names) with ids from src/data/anatomy/muscles.js
 * can replace it (e.g. a BodyParts3D / Z-Anatomy derived model) with no code changes.
 *
 * Run: npm run build:anatomy
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import fs from 'node:fs';

// Node has Blob but not FileReader; GLTFExporter needs FileReader.
globalThis.FileReader = class {
  readAsArrayBuffer(b) { b.arrayBuffer().then((r) => { this.result = r; this.onloadend?.(); this.onload?.({ target: this }); }); }
  readAsDataURL(b) { b.arrayBuffer().then((r) => { this.result = `data:${b.type || 'application/octet-stream'};base64,${Buffer.from(r).toString('base64')}`; this.onloadend?.(); this.onload?.({ target: this }); }); }
};

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const scene = new THREE.Scene();
const skin = new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.85 });
const muscleMat = new THREE.MeshStandardMaterial({ color: 0x6b6b72, roughness: 0.55 });

/** Ellipsoid between two points: radii (rx across, rz depth), lenFrac of the segment, offset. */
function ellipsoidBetween(a, b, { rx, rz, lenFrac = 1, t = 0.5, offset = V(0, 0, 0), twist = 0, seg = 18 }) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length() * lenFrac;
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(rx, len / 2, rz);
  if (twist) g.rotateY(twist);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  g.applyQuaternion(q);
  const c = a.clone().lerp(b, t).add(offset);
  g.translate(c.x, c.y, c.z);
  return g;
}
function ellipsoid(c, s, rot = [0, 0, 0], seg = 18) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(...s);
  g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]);
  g.translate(c.x, c.y, c.z);
  return g;
}
function capsule(a, b, r, seg = 12) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const g = new THREE.CapsuleGeometry(r, dir.length(), 6, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()));
  const c = a.clone().lerp(b, 0.5);
  g.translate(c.x, c.y, c.z);
  return g;
}

/* ---- Skeleton landmarks (metres, Y up, facing +Z) ---------------------- */
const L = (side) => ({
  shoulder: V(side * 0.205, 1.43, -0.01),
  elbow: V(side * 0.255, 1.13, -0.02),
  wrist: V(side * 0.29, 0.86, 0.02),
  hip: V(side * 0.095, 0.93, 0),
  knee: V(side * 0.105, 0.52, 0.015),
  ankle: V(side * 0.11, 0.09, -0.02),
});

/* ---- Base body (skin) --------------------------------------------------- */
const base = [
  ellipsoid(V(0, 1.665, 0.005), [0.088, 0.112, 0.1]),                 // head
  capsule(V(0, 1.5, -0.005), V(0, 1.58, 0), 0.052),                    // neck
  ellipsoid(V(0, 1.31, 0), [0.175, 0.2, 0.108]),                       // ribcage
  ellipsoid(V(0, 1.1, 0.002), [0.145, 0.16, 0.095]),                   // abdomen
  ellipsoid(V(0, 0.94, -0.005), [0.165, 0.1, 0.1]),                    // pelvis
];
for (const side of [-1, 1]) {
  const p = L(side);
  base.push(
    ellipsoid(p.shoulder, [0.06, 0.06, 0.06]),
    capsule(p.shoulder, p.elbow, 0.043),
    capsule(p.elbow, p.wrist, 0.034),
    ellipsoid(V(side * 0.3, 0.79, 0.025), [0.03, 0.055, 0.018]),        // hand
    capsule(p.hip, p.knee, 0.07),
    capsule(p.knee, p.ankle, 0.046),
    ellipsoid(V(side * 0.112, 0.035, 0.035), [0.042, 0.032, 0.1]),      // foot
  );
}
const baseMesh = new THREE.Mesh(mergeGeometries(base), skin);
baseMesh.name = 'body__base';
scene.add(baseMesh);

/* ---- Muscles ------------------------------------------------------------ */
const muscles = [];
const add = (id, side, geom) => muscles.push({ name: `muscle__${id}__${side}`, geom });

add('trapezius', 'c', mergeGeometries([
  ellipsoid(V(0, 1.44, -0.07), [0.15, 0.07, 0.035], [0.25, 0, 0]),
  ellipsoid(V(0, 1.31, -0.095), [0.07, 0.13, 0.025]),
]));
add('rectus_abdominis', 'c', mergeGeometries([0, 1, 2].flatMap((row) => [-1, 1].map((s) =>
  ellipsoid(V(s * 0.036, 1.19 - row * 0.065, 0.085), [0.033, 0.034, 0.022])))));

for (const [side, sx] of [[-1, 'r'], [1, 'l']]) {
  const p = L(side), S = (x, y, z) => V(side * x, y, z);
  add('pectoralis_major', sx, ellipsoid(S(0.085, 1.355, 0.082), [0.092, 0.07, 0.038], [0, 0, side * -0.18]));
  add('serratus_anterior', sx, ellipsoid(S(0.145, 1.24, 0.055), [0.03, 0.062, 0.035], [0, side * 0.5, 0]));
  add('obliques', sx, ellipsoid(S(0.118, 1.09, 0.055), [0.042, 0.11, 0.045], [0, side * 0.45, side * 0.08]));
  add('deltoid_anterior', sx, ellipsoid(S(0.205, 1.415, 0.04), [0.04, 0.072, 0.034], [0.1, 0, side * 0.12]));
  add('deltoid_lateral', sx, ellipsoid(S(0.238, 1.41, -0.005), [0.036, 0.074, 0.045], [0, 0, side * 0.15]));
  add('deltoid_posterior', sx, ellipsoid(S(0.205, 1.415, -0.05), [0.04, 0.07, 0.032], [-0.1, 0, side * 0.12]));
  add('biceps_brachii', sx, ellipsoidBetween(p.shoulder, p.elbow, { rx: 0.033, rz: 0.03, lenFrac: 0.72, t: 0.56, offset: V(0, 0, 0.03) }));
  add('triceps_brachii', sx, ellipsoidBetween(p.shoulder, p.elbow, { rx: 0.036, rz: 0.032, lenFrac: 0.8, t: 0.5, offset: V(0, 0, -0.03) }));
  add('forearm_flexors', sx, ellipsoidBetween(p.elbow, p.wrist, { rx: 0.03, rz: 0.024, lenFrac: 0.8, t: 0.38, offset: V(side * -0.008, 0, 0.022) }));
  add('forearm_extensors', sx, ellipsoidBetween(p.elbow, p.wrist, { rx: 0.03, rz: 0.024, lenFrac: 0.8, t: 0.38, offset: V(side * 0.01, 0, -0.02) }));
  add('rhomboids', sx, ellipsoid(S(0.055, 1.33, -0.1), [0.035, 0.06, 0.02], [0, 0, side * 0.3]));
  add('infraspinatus', sx, ellipsoid(S(0.115, 1.34, -0.098), [0.058, 0.05, 0.024], [0, 0, side * -0.2]));
  add('latissimus_dorsi', sx, ellipsoid(S(0.12, 1.2, -0.078), [0.07, 0.135, 0.038], [0, side * -0.3, side * -0.22]));
  add('erector_spinae', sx, ellipsoid(S(0.033, 1.08, -0.088), [0.028, 0.16, 0.026]));
  add('gluteus_maximus', sx, ellipsoid(S(0.078, 0.915, -0.085), [0.085, 0.092, 0.058], [0.15, 0, 0]));
  add('gluteus_medius', sx, ellipsoid(S(0.135, 0.985, -0.035), [0.045, 0.055, 0.055]));
  add('quadriceps', sx, ellipsoidBetween(p.hip, p.knee, { rx: 0.064, rz: 0.05, lenFrac: 0.86, t: 0.5, offset: V(0, 0, 0.04) }));
  add('adductors', sx, ellipsoidBetween(p.hip, p.knee, { rx: 0.035, rz: 0.05, lenFrac: 0.55, t: 0.38, offset: V(side * -0.045, 0, 0.005) }));
  add('hamstrings', sx, ellipsoidBetween(p.hip, p.knee, { rx: 0.058, rz: 0.048, lenFrac: 0.82, t: 0.52, offset: V(0, 0, -0.042) }));
  add('gastrocnemius', sx, ellipsoidBetween(p.knee, p.ankle, { rx: 0.045, rz: 0.04, lenFrac: 0.52, t: 0.3, offset: V(0, 0, -0.036) }));
  add('soleus', sx, ellipsoidBetween(p.knee, p.ankle, { rx: 0.04, rz: 0.03, lenFrac: 0.45, t: 0.6, offset: V(0, 0, -0.026) }));
  add('tibialis_anterior', sx, ellipsoidBetween(p.knee, p.ankle, { rx: 0.022, rz: 0.022, lenFrac: 0.66, t: 0.42, offset: V(side * 0.016, 0, 0.034) }));
}

for (const m of muscles) {
  const mesh = new THREE.Mesh(m.geom, muscleMat);
  mesh.name = m.name;
  scene.add(mesh);
}

// Texture coordinates are unused (flat materials) — drop them to keep the file small.
scene.traverse((o) => o.geometry?.deleteAttribute('uv'));

const exporter = new GLTFExporter();
const glb = await exporter.parseAsync(scene, { binary: true });
fs.mkdirSync('assets/models', { recursive: true });
fs.writeFileSync('assets/models/muscles.glb', Buffer.from(glb));
console.log(`muscles.glb: ${muscles.length} muscle meshes, ${(glb.byteLength / 1024).toFixed(0)} KB`);
