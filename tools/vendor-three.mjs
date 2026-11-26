// Copies the Three.js runtime files Hercules needs into src/vendor/three so the
// app works offline with no CDN. Run after changing the three version: npm run vendor
import fs from 'node:fs';
import path from 'node:path';

const src = 'node_modules/three';
const dst = 'src/vendor/three';
const files = [
  ['build/three.module.min.js', 'three.module.min.js'],
  ['examples/jsm/controls/OrbitControls.js', 'addons/controls/OrbitControls.js'],
  ['examples/jsm/loaders/GLTFLoader.js', 'addons/loaders/GLTFLoader.js'],
  ['examples/jsm/utils/BufferGeometryUtils.js', 'addons/utils/BufferGeometryUtils.js'],
  ['LICENSE', 'LICENSE'],
];
for (const [from, to] of files) {
  const out = path.join(dst, to);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.copyFileSync(path.join(src, from), out);
  console.log('vendored', to);
}
