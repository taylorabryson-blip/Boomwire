"""
Builds assets/models/muscles.glb from REAL human anatomy scan data:
BodyParts3D (c) The Database Center for Life Science, licensed CC BY-SA 2.1 Japan
(https://dbarchive.biosciencedbc.jp/en/bodyparts3d/), via the STL mirror at
https://github.com/Kevin-Mattheus-Moerman/BodyParts3D.

What it does
  1. Selects every mesh in the muscular system (437) and skeletal system (251)
     using the FMA part-of hierarchy (no organs, vessels or nerves).
  2. Maps each muscle to a Hercules catalog id (src/data/anatomy/muscles.js)
     by its anatomical name; unmapped muscles become neutral "context" tissue.
  3. Simplifies each mesh with a triangle budget proportional to surface area
     (tracked muscles get more detail), converts mm/Z-up to metres/Y-up.
  4. Merges per (muscle id, side) so every tracked muscle is one selectable mesh:
       muscle__<id>__<l|r>   context__muscles   context__bones
  Then run gltfpack (meshopt compression) — see package.json "build:anatomy".

Usage: python3 tools/build-anatomy-bp3d.py <bodyparts3d repo dir> <out.glb>
Requires: pip install trimesh fast-simplification numpy
"""
import sys, re, json, collections
import numpy as np
import trimesh
import fast_simplification

REPO, OUT = sys.argv[1], sys.argv[2]
DATA = f'{REPO}/assets/BodyParts3D_data'

# ---- names + hierarchy -------------------------------------------------------
names = {}
for line in open(f'{DATA}/parts_list_e.txt', encoding='utf-8', errors='ignore').read().splitlines()[1:]:
    p = line.split('\t')
    if len(p) >= 2: names[p[0].strip('"')] = p[1].strip('"')
graph = collections.defaultdict(set)
for f in ('composite_parts.txt', 'conventional_part_of.txt'):
    for line in open(f'{DATA}/{f}', encoding='utf-8', errors='ignore').read().splitlines()[1:]:
        p = [x.strip('"') for x in line.split('\t')]
        if len(p) >= 3: graph[p[0]].add(p[2])
import os
have = {f[:-4] for f in os.listdir(f'{DATA}/stl') if f.endswith('.stl')}
def descendants(root):
    out, stack, seen = set(), [root], set()
    while stack:
        n = stack.pop()
        if n in seen: continue
        seen.add(n)
        if n in have: out.add(n)
        stack.extend(graph.get(n, ()))
    return out
MUSCULAR, SKELETAL = descendants('FMA72954'), descendants('FMA23881')

# ---- name → Hercules muscle id ------------------------------------------------
RULES = [
    (r'pectoralis major', 'pectoralis_major'),
    (r'serratus anterior', 'serratus_anterior'),
    (r'clavicular part of .*deltoid', 'deltoid_anterior'),
    (r'acromial part of .*deltoid', 'deltoid_lateral'),
    (r'spinal part of .*deltoid', 'deltoid_posterior'),
    (r'biceps brachii|\bbrachialis\b', 'biceps_brachii'),
    (r'triceps brachii|anconeus', 'triceps_brachii'),
    (r'flexor carpi|palmaris longus|flexor digitorum superficialis|flexor digitorum profundus|pronator teres|brachioradialis|flexor pollicis longus', 'forearm_flexors'),
    (r'extensor carpi|extensor digitorum(?! longus| brevis)|extensor digiti minimi|abductor pollicis longus|extensor pollicis|extensor indicis|supinator', 'forearm_extensors'),
    (r'trapezius', 'trapezius'),
    (r'rhomboid', 'rhomboids'),
    (r'infraspinatus|teres major|teres minor|supraspinatus', 'infraspinatus'),
    (r'latissimus dorsi', 'latissimus_dorsi'),
    (r'iliocostalis|longissimus|spinalis', 'erector_spinae'),
    (r'rectus abdominis', 'rectus_abdominis'),
    (r'external oblique|internal oblique', 'obliques'),
    (r'gluteus maximus', 'gluteus_maximus'),
    (r'gluteus medius|gluteus minimus|tensor fasciae latae', 'gluteus_medius'),
    (r'rectus femoris|vastus', 'quadriceps'),
    (r'adductor longus|adductor brevis|adductor magnus|gracilis|pectineus', 'adductors'),
    (r'biceps femoris|semitendinosus|semimembranosus', 'hamstrings'),
    (r'gastrocnemius', 'gastrocnemius'),
    (r'soleus', 'soleus'),
    (r'tibialis anterior', 'tibialis_anterior'),
]
def classify(name):
    n = name.lower()
    for pat, mid in RULES:
        if re.search(pat, n): return mid
    return None
def side_of(name):
    n = name.lower()
    if re.search(r'\bright\b', n): return 'r'
    if re.search(r'\bleft\b', n): return 'l'
    return 'c'

# ---- load, simplify, transform -----------------------------------------------
def load(fid):
    m = trimesh.load(f'{DATA}/stl/{fid}.stl', force='mesh', process=True)
    m.merge_vertices()
    return m

def simplify(m, target_faces):
    target_faces = int(max(40, target_faces))
    if len(m.faces) <= target_faces: return m
    reduction = 1 - target_faces / len(m.faces)
    v, f = fast_simplification.simplify(m.vertices.astype(np.float32), m.faces.astype(np.int32), target_reduction=min(0.995, reduction))
    return trimesh.Trimesh(v, f, process=True)

def to_three(m):
    v = m.vertices / 1000.0                       # mm → m
    v = np.stack([v[:, 0], v[:, 2], -v[:, 1]], 1) # Z-up/-Y-front → Y-up/+Z-front
    return trimesh.Trimesh(v, m.faces, process=False)

groups = collections.defaultdict(list)   # node name → [meshes]
areas = {}
records = []
for fid in sorted(MUSCULAR | SKELETAL):
    nm = names.get(fid, fid)
    if fid in MUSCULAR:
        mid = classify(nm)
        key = f'muscle__{mid}__{side_of(nm)}' if mid else 'context__muscles'
    else:
        key = 'context__bones'
    records.append((fid, nm, key))

# Triangle budget ∝ area. Tracked muscles get 4× density.
print(f'loading {len(records)} meshes…', flush=True)
loaded = []
for fid, nm, key in records:
    try:
        m = load(fid)
    except Exception as e:
        print('skip', fid, nm, e); continue
    loaded.append((fid, nm, key, m, m.area))
DENSITY = {'muscle': 4.0, 'context__muscles': 1.0, 'context__bones': 0.55}
weight = lambda key: DENSITY['muscle'] if key.startswith('muscle__') else DENSITY[key]
TOTAL = 260_000
wsum = sum(a * weight(k) for _, _, k, _, a in loaded)
for fid, nm, key, m, a in loaded:
    budget = TOTAL * a * weight(key) / wsum
    s = to_three(simplify(m, budget))
    groups[key].append(s)

# Centre horizontally; feet on y=0.
allv = np.concatenate([g.vertices for gs in groups.values() for g in gs])
off = np.array([-(allv[:, 0].max() + allv[:, 0].min()) / 2, -allv[:, 1].min(), -(allv[:, 2].max() + allv[:, 2].min()) / 2])

scene = trimesh.Scene()
summary = {}
for key, meshes in sorted(groups.items()):
    merged = trimesh.util.concatenate(meshes)
    merged.apply_translation(off)
    merged.fix_normals()
    _ = merged.vertex_normals  # ensure normals exported
    scene.add_geometry(merged, node_name=key, geom_name=key)
    summary[key] = len(merged.faces)

scene.export(OUT)
tracked = sorted({k.split('__')[1] for k in summary if k.startswith('muscle__')})
print(json.dumps({'nodes': len(summary), 'faces': sum(summary.values()), 'tracked_muscles': len(tracked)}, indent=1))
print('height (m):', round(float(allv[:, 1].max() - allv[:, 1].min()), 3))
