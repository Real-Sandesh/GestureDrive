/* ============================================================================
   Gesture Drive - vehicle kit
   Shared helpers used to build every car and bike procedurally (no model files):
   lofted bodywork, wheels, decals that follow the body surface, riders, etc.
   Needs THREE (r128) to be loaded first.
   ========================================================================== */
(function () {
'use strict';
const T = THREE;
const V3 = T.Vector3;
const K = window.GDKit = { defs: [] };

// Colours: hex values are written as normal sRGB, then converted for the linear pipeline.
const C = K.C = function (hex) { return new T.Color(hex).convertSRGBToLinear(); };

/* ---------------------------------------------------------------- materials */
K.phys = true;                       // clear-coat paint (off on Low quality)
K.envIntensity = 1;
K.envMats = new Set();               // every material that reflects the environment map
function reg(m) { m.envMapIntensity = K.envIntensity; K.envMats.add(m); return m; }
K.setEnvIntensity = function (v) {
  K.envIntensity = v;
  K.envMats.forEach(function (m) { m.envMapIntensity = v; });
};

function std(o) { return reg(new T.MeshStandardMaterial(o)); }

K.M = null;
K.initMaterials = function (phys) {
  if (K.M) {
    Object.keys(K.M).forEach(function (k) { const m = K.M[k]; if (m && m.dispose) { K.envMats.delete(m); m.dispose(); } });
  }
  K.phys = phys !== false;
  const M = K.M = {};
  M.tire     = std({ color: C(0x18181a), roughness: 0.93, metalness: 0 });
  M.black    = std({ color: C(0x0e0f12), roughness: 0.45, metalness: 0.25 });
  M.dark     = std({ color: C(0x1a1c21), roughness: 0.75, metalness: 0.35 });
  M.chrome   = std({ color: C(0xf2f4f8), roughness: 0.06, metalness: 1 });
  M.alu      = std({ color: C(0xc9ced6), roughness: 0.26, metalness: 1 });
  M.gun      = std({ color: C(0x3b4048), roughness: 0.34, metalness: 0.92 });
  M.gold     = std({ color: C(0xd6a63a), roughness: 0.22, metalness: 1 });
  M.disc     = std({ color: C(0x9aa0a8), roughness: 0.38, metalness: 1 });
  M.caliper  = std({ color: C(0xd0201c), roughness: 0.4, metalness: 0.3 });
  M.leather  = std({ color: C(0x1c1a1c), roughness: 0.62, metalness: 0.05 });
  M.cloth    = std({ color: C(0x2a2d33), roughness: 0.9, metalness: 0 });
  M.rubber   = std({ color: C(0x222226), roughness: 0.85, metalness: 0 });
  M.white    = std({ color: C(0xf3f3f0), roughness: 0.4, metalness: 0.1 });
  M.plastic  = std({ color: C(0x2b2e34), roughness: 0.55, metalness: 0.15 });
  M.glass = K.phys
    ? reg(new T.MeshPhysicalMaterial({ color: C(0x0b1119), roughness: 0.03, metalness: 0.55, transparent: true, opacity: 0.68, clearcoat: 1, clearcoatRoughness: 0.02 }))
    : std({ color: C(0x0b1119), roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.72 });
  M.visor = std({ color: C(0x0a0d14), roughness: 0.04, metalness: 0.8 });
  M.carbon = std({ color: C(0xffffff), map: K.tex.carbon(), roughness: 0.32, metalness: 0.45 });
  Object.keys(M).forEach(function (k) { M[k].userData.shared = true; });
};

K.paint = function (hex, finish) {
  const P = K.phys ? T.MeshPhysicalMaterial : T.MeshStandardMaterial;
  const o = { color: C(hex), metalness: 0.62, roughness: 0.3 };
  if (finish === 'matte') { o.metalness = 0.3; o.roughness = 0.6; }
  else if (finish === 'pearl') { o.metalness = 0.4; o.roughness = 0.22; }
  if (K.phys && finish !== 'matte') { o.clearcoat = 1; o.clearcoatRoughness = 0.05; }
  const m = reg(new P(o));
  m.userData.isPaint = true;
  return m;
};
// A lamp: dark body, bright emissive glow whose strength the game changes (night, braking).
K.lamp = function (hex, base) {
  const m = new T.MeshStandardMaterial({ color: C(0x111111), emissive: C(hex), emissiveIntensity: base, roughness: 0.25, metalness: 0.2 });
  m.userData.base = base;
  return m;
};
K.flat = function (hex, rough, metal) {
  return std({ color: C(hex), roughness: rough == null ? 0.6 : rough, metalness: metal == null ? 0.1 : metal });
};
// Thin flat colour used for decals (stripes, grilles) - pulled slightly toward the camera so it never z-fights.
K.decalMat = function (hex, rough, metal) {
  const m = std({ color: C(hex), roughness: rough == null ? 0.5 : rough, metalness: metal == null ? 0.2 : metal });
  m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
  return m;
};

/* ----------------------------------------------------------------- textures */
K.tex = {};
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new T.CanvasTexture(c);
  t.encoding = T.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}
K.canvasTex = canvasTex;
let _carbon = null;
K.tex.carbon = function () {
  if (_carbon) return _carbon;
  _carbon = canvasTex(64, 64, function (g, w, h) {
    g.fillStyle = '#15171b'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const a = (x + y) % 2 === 0;
      const gr = a ? g.createLinearGradient(x * 8, y * 8, x * 8 + 8, y * 8) : g.createLinearGradient(x * 8, y * 8, x * 8, y * 8 + 8);
      gr.addColorStop(0, '#2b2f36'); gr.addColorStop(0.5, '#0e1013'); gr.addColorStop(1, '#2b2f36');
      g.fillStyle = gr; g.fillRect(x * 8, y * 8, 8, 8);
    }
  });
  _carbon.wrapS = _carbon.wrapT = T.RepeatWrapping;
  _carbon.repeat.set(3, 3);
  return _carbon;
};
K.tex.plate = function (text, bg, fg) {
  return canvasTex(256, 64, function (g, w, h) {
    g.fillStyle = bg || '#f4f4ee'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#222'; g.lineWidth = 4; g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = '#1d3f9a'; g.fillRect(6, 6, 22, h - 12);
    g.fillStyle = fg || '#181818';
    g.font = '700 38px "Barlow Semi Condensed", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2 + 8, h / 2 + 2);
  });
};
K.tex.number = function (num, bg, fg) {
  return canvasTex(128, 128, function (g, w, h) {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg;
    g.font = '800 92px "Barlow Semi Condensed", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(num, w / 2, h / 2 + 6);
  });
};
let _blob = null;
K.tex.blob = function () {      // soft contact shadow
  if (_blob) return _blob;
  _blob = canvasTex(128, 128, function (g, w, h) {
    const gr = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  _blob.encoding = T.LinearEncoding;
  return _blob;
};
let _glow = null;
K.tex.glow = function () {
  if (_glow) return _glow;
  _glow = canvasTex(128, 128, function (g, w, h) {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 62);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  return _glow;
};

/* ------------------------------------------------------------------- curves */
// Monotone cubic interpolation through [x, y] control points (no overshoot, flat tops on roofs).
K.curve = function (pts) {
  const n = pts.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d[i] = (pts[i + 1][1] - pts[i][1]) / ((pts[i + 1][0] - pts[i][0]) || 1e-6);
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = (d[i - 1] * d[i] <= 0) ? 0 : (2 * d[i - 1] * d[i]) / (d[i - 1] + d[i]);
  return function (x) {
    if (x <= pts[0][0]) return pts[0][1];
    if (x >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 0; while (x > pts[i + 1][0]) i++;
    const h = pts[i + 1][0] - pts[i][0], t = (x - pts[i][0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * pts[i][1] + (t3 - 2 * t2 + t) * h * m[i] +
           (-2 * t3 + 3 * t2) * pts[i + 1][1] + (t3 - t2) * h * m[i + 1];
  };
};

/* --------------------------------------------------------------------- loft */
// Sweeps a superellipse cross-section along Z. Each station: { z, w (half width), y0, y1, p/pt/pb (roundness),
// tw (top width factor, <1 = tumblehome), x (centre offset) }.  Underside faces get materials[1].
K.loft = function (stations, o) {
  o = o || {};
  const N = o.N || 28;
  const st = stations.slice().sort(function (a, b) { return a.z - b.z; });
  const n = st.length;
  const pos = [], uv = [], normalsHint = null;
  for (let s = 0; s < n; s++) {
    const S = st[s];
    const h = Math.max(0.004, S.y1 - S.y0), ym = (S.y0 + S.y1) / 2;
    const pt = S.pt || S.p || 3.2, pb = S.pb || S.p || 5;
    const tw = S.tw == null ? 1 : S.tw;
    for (let i = 0; i < N; i++) {
      const a = i / N * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const ex = 2 / (sn >= 0 ? pt : pb);
      let x = S.w * Math.sign(c) * Math.pow(Math.abs(c), ex);
      const y = (h / 2) * Math.sign(sn) * Math.pow(Math.abs(sn), ex);
      x *= 1 - (1 - tw) * (y / h + 0.5);
      pos.push((S.x || 0) + x, ym + y, S.z);
      uv.push(i / N, s / (n - 1));
    }
  }
  const idxA = [], idxB = [];
  for (let s = 0; s < n - 1; s++) {
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const A = s * N + i, B = s * N + j, Cc = (s + 1) * N + j, D = (s + 1) * N + i;
      const ang = (i + 0.5) / N * Math.PI * 2;
      const dst = (o.under !== false && Math.sin(ang) < -0.35) ? idxB : idxA;
      dst.push(A, B, D, B, Cc, D);
    }
  }
  function cap(sIdx, front) {
    const ci = pos.length / 3;
    let cx = 0, cy = 0;
    for (let i = 0; i < N; i++) { cx += pos[(sIdx * N + i) * 3]; cy += pos[(sIdx * N + i) * 3 + 1]; }
    pos.push(cx / N, cy / N, st[sIdx].z); uv.push(0.5, front ? 1 : 0);
    for (let i = 0; i < N; i++) {
      const a = sIdx * N + i, b = sIdx * N + (i + 1) % N;
      if (front) idxA.push(ci, a, b); else idxA.push(ci, b, a);
    }
  }
  if (o.capFront !== false) cap(n - 1, true);
  if (o.capRear !== false) cap(0, false);
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setIndex(idxA.concat(idxB));
  geo.addGroup(0, idxA.length, 0);
  if (idxB.length) geo.addGroup(idxA.length, idxB.length, 1);
  geo.computeVertexNormals();
  return geo;
};

/* ---------------------------------------------------------- small primitives */
K.mesh = function (geo, mat, x, y, z) {
  const m = new T.Mesh(geo, mat);
  m.position.set(x || 0, y || 0, z || 0);
  m.castShadow = true;
  return m;
};
K.box = function (w, h, d, mat, x, y, z) { return K.mesh(new T.BoxGeometry(w, h, d), mat, x, y, z); };
K.ell = function (rx, ry, rz, mat, x, y, z, seg) {
  const g = new T.SphereGeometry(1, seg || 14, Math.max(6, Math.round((seg || 14) * 0.7)));
  g.scale(rx, ry, rz);
  return K.mesh(g, mat, x, y, z);
};
const _up = new V3(0, 1, 0);
K.limb = function (a, b, r0, r1, mat, seg) {
  const dir = new V3().subVectors(b, a), len = dir.length();
  const g = new T.CylinderGeometry(r1, r0, len, seg || 8, 1);
  const m = new T.Mesh(g, mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(_up, dir.normalize());
  m.castShadow = true;
  return m;
};
K.tube = function (a, b, r, mat, seg) { return K.limb(a, b, r, r, mat, seg); };
K.v = function (x, y, z) { return new V3(x, y, z); };

/* ------------------------------------------------------------------- merging */
K.merge = function (geos) {
  const parts = geos.map(function (g) { return g.index ? g.toNonIndexed() : g; });
  let count = 0;
  parts.forEach(function (g) { count += g.attributes.position.count; });
  const P = new Float32Array(count * 3), Nn = new Float32Array(count * 3), U = new Float32Array(count * 2);
  let o = 0;
  parts.forEach(function (g) {
    P.set(g.attributes.position.array, o * 3);
    Nn.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) U.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  });
  const out = new T.BufferGeometry();
  out.setAttribute('position', new T.BufferAttribute(P, 3));
  out.setAttribute('normal', new T.BufferAttribute(Nn, 3));
  out.setAttribute('uv', new T.BufferAttribute(U, 2));
  return out;
};
// Bakes every mesh under `root` into one mesh per material - a car of 80 parts becomes ~12 draw calls.
K.bake = function (root) {
  root.updateMatrixWorld(true);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const buckets = new Map();
  const dispose = [];
  root.traverse(function (obj) {
    if (!obj.isMesh) return;
    const rel = new T.Matrix4().multiplyMatrices(inv, obj.matrixWorld);
    const src = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry;
    if (!src.attributes.normal) src.computeVertexNormals();
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const groups = (Array.isArray(obj.material) && src.groups.length) ? src.groups : [{ start: 0, count: src.attributes.position.count, materialIndex: 0 }];
    groups.forEach(function (gr) {
      const mat = mats[gr.materialIndex];
      const g = new T.BufferGeometry();
      const sl = function (attr, sz) { return new T.BufferAttribute(attr.array.slice(gr.start * sz, (gr.start + gr.count) * sz), sz); };
      g.setAttribute('position', sl(src.attributes.position, 3));
      g.setAttribute('normal', sl(src.attributes.normal, 3));
      g.setAttribute('uv', src.attributes.uv ? sl(src.attributes.uv, 2) : new T.BufferAttribute(new Float32Array(gr.count * 2), 2));
      g.applyMatrix4(rel);
      if (!buckets.has(mat)) buckets.set(mat, []);
      buckets.get(mat).push(g);
    });
    dispose.push(obj.geometry);
    if (src !== obj.geometry) dispose.push(src);
  });
  const out = new T.Group();
  buckets.forEach(function (list, mat) {
    const m = new T.Mesh(K.merge(list), mat);
    m.castShadow = true; m.receiveShadow = false;
    if (mat.transparent) { m.castShadow = false; m.renderOrder = 2; }
    out.add(m);
  });
  dispose.forEach(function (g) { g.dispose(); });
  return out;
};
K.dispose = function (root) {
  root.traverse(function (o) {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    ms.forEach(function (m) {
      if (m.userData && m.userData.shared) return;
      K.envMats.delete(m);
      m.dispose();
    });
  });
};

/* -------------------------------------------------- surface queries / decals */
const _rc = new T.Raycaster();
const _tri = new T.Triangle();
const _bary = new V3();
// Casts a ray at a mesh and returns { p, n } (smooth normal). The mesh must sit in an un-transformed group.
K.hit = function (target, origin, dir) {
  _rc.set(origin, dir.clone().normalize());
  _rc.far = 30;
  const hits = _rc.intersectObject(target, true);
  if (!hits.length) return null;
  const h = hits[0], f = h.face, g = h.object.geometry;
  const pa = g.attributes.position, na = g.attributes.normal;
  const a = new V3().fromBufferAttribute(pa, f.a), b = new V3().fromBufferAttribute(pa, f.b), c = new V3().fromBufferAttribute(pa, f.c);
  _tri.set(a, b, c).getBarycoord(h.point, _bary);
  const n = new V3()
    .addScaledVector(new V3().fromBufferAttribute(na, f.a), _bary.x)
    .addScaledVector(new V3().fromBufferAttribute(na, f.b), _bary.y)
    .addScaledVector(new V3().fromBufferAttribute(na, f.c), _bary.z).normalize();
  return { p: h.point.clone(), n: n };
};
// A patch that hugs the surface of `target`. originFn(u, v) -> ray origin, dir -> ray direction.
K.patch = function (target, o) {
  const nu = o.nu || 8, nv = o.nv || 8, lift = o.lift == null ? 0.004 : o.lift;
  const P = [], Nn = [], ok = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    const h = K.hit(target, o.origin(i / nu, j / nv), o.dir);
    if (h) { P.push(h.p.x + h.n.x * lift, h.p.y + h.n.y * lift, h.p.z + h.n.z * lift); Nn.push(h.n.x, h.n.y, h.n.z); ok.push(true); }
    else { P.push(0, 0, 0); Nn.push(0, 1, 0); ok.push(false); }
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (!(ok[a] && ok[b] && ok[c] && ok[d])) continue;
    [[a, b, c], [b, d, c]].forEach(function (t) {
      const A = new V3(P[t[0] * 3], P[t[0] * 3 + 1], P[t[0] * 3 + 2]), B = new V3(P[t[1] * 3], P[t[1] * 3 + 1], P[t[1] * 3 + 2]), Cc = new V3(P[t[2] * 3], P[t[2] * 3 + 1], P[t[2] * 3 + 2]);
      const cr = new V3().crossVectors(B.clone().sub(A), Cc.clone().sub(A));
      const avg = new V3(Nn[t[0] * 3] + Nn[t[1] * 3] + Nn[t[2] * 3], Nn[t[0] * 3 + 1] + Nn[t[1] * 3 + 1] + Nn[t[2] * 3 + 1], Nn[t[0] * 3 + 2] + Nn[t[1] * 3 + 2] + Nn[t[2] * 3 + 2]);
      if (cr.dot(avg) < 0) idx.push(t[0], t[2], t[1]); else idx.push(t[0], t[1], t[2]);
    });
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(P, 3));
  g.setAttribute('normal', new T.Float32BufferAttribute(Nn, 3));
  const uvs = []; for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) uvs.push(i / nu, j / nv);
  g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  const m = new T.Mesh(g, o.mat);
  return m;
};
// Patch on top of the body: x in [x0,x1], z in [z0,z1]
K.topPatch = function (target, x0, x1, z0, z1, mat, o) {
  o = o || {};
  return K.patch(target, {
    nu: o.nu || 4, nv: o.nv || 40, lift: o.lift, mat: mat, dir: new V3(0, -1, 0),
    origin: function (u, v) { return new V3(x0 + (x1 - x0) * u, 4, z0 + (z1 - z0) * v); }
  });
};
// Patch on a side flank (side = +1 / -1 along x): z in [z0,z1], y in [y0,y1]
K.sidePatch = function (target, side, z0, z1, y0, y1, mat, o) {
  o = o || {};
  return K.patch(target, {
    nu: o.nu || 16, nv: o.nv || 4, lift: o.lift, mat: mat, dir: new V3(-side, 0, 0),
    origin: function (u, v) { return new V3(side * 4, y0 + (y1 - y0) * v, z0 + (z1 - z0) * u); }
  });
};
// Patch on the nose (end = +1) or tail (end = -1): x in [x0,x1], y in [y0,y1]
K.endPatch = function (target, end, x0, x1, y0, y1, mat, o) {
  o = o || {};
  return K.patch(target, {
    nu: o.nu || 10, nv: o.nv || 4, lift: o.lift, mat: mat, dir: new V3(0, 0, -end),
    origin: function (u, v) { return new V3(x0 + (x1 - x0) * u, y0 + (y1 - y0) * v, end * 6); }
  });
};

/* ------------------------------------------------------------------- wheels */
K.radial = function (list, count, rIn, rOut, wid, thick, x, o) {
  // pushes `count` spokes (boxes) around the wheel axis (x) into list
  o = o || {};
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2 + (o.phase || 0);
    const g = new T.BoxGeometry(thick, rOut - rIn, wid);
    if (o.twist) g.applyMatrix4(new T.Matrix4().makeRotationY(o.twist));
    g.applyMatrix4(new T.Matrix4().makeTranslation(x, (rIn + rOut) / 2, 0));
    g.applyMatrix4(new T.Matrix4().makeRotationX(a));
    list.push(g);
  }
};
// Returns { group, spin, r }. The outer face points +x; left-hand wheels are flipped by the caller.
K.wheel = function (o) {
  const M = K.M, lod = o.lod == null ? 1 : o.lod;
  const seg = lod ? 30 : 14;
  const r = o.r, hw = o.w / 2, rr = r * (o.rim || 0.62);
  const sw = r - rr;
  const group = new T.Group();
  const spin = new T.Group(); spin.name = 'spin';
  group.add(spin);

  // Tyre: a lathe profile with a bulging sidewall and rounded shoulders
  const prof = [
    [rr * 0.98, -hw * 0.86], [rr + sw * 0.16, -hw * 1.0], [r - sw * 0.14, -hw * 0.97], [r * 0.996, -hw * 0.68],
    [r, -hw * 0.32], [r, hw * 0.32], [r * 0.996, hw * 0.68], [r - sw * 0.14, hw * 0.97], [rr + sw * 0.16, hw * 1.0], [rr * 0.98, hw * 0.86]
  ].map(function (p) { return new T.Vector2(p[0], p[1]); });
  let tireGeo = new T.LatheGeometry(prof, seg);
  tireGeo.rotateZ(Math.PI / 2);
  if (o.tread === 'knobby' && lod) {
    const blocks = [tireGeo], nb = 26;
    for (let i = 0; i < nb; i++) for (let row = -1; row <= 1; row += 2) {
      const g = new T.BoxGeometry(hw * 0.5, r * 0.07, r * 0.13);
      g.applyMatrix4(new T.Matrix4().makeRotationZ(row * 0.5));
      g.applyMatrix4(new T.Matrix4().makeTranslation(row * hw * 0.42, r + r * 0.02, 0));
      g.applyMatrix4(new T.Matrix4().makeRotationX((i + (row > 0 ? 0.5 : 0)) / nb * Math.PI * 2));
      blocks.push(g);
    }
    tireGeo = K.merge(blocks);
  }
  const tire = new T.Mesh(tireGeo, o.tireMat || M.tire);
  tire.castShadow = true;
  spin.add(tire);

  // Rim: barrel, face, spokes
  const parts = [], trim = [];
  const xo = hw * 0.82;
  const barrel = new T.CylinderGeometry(rr * 0.985, rr * 0.9, hw * 1.7, seg, 1, true);
  barrel.rotateZ(Math.PI / 2); parts.push(barrel);
  const lip = new T.TorusGeometry(rr * 0.975, Math.max(0.008, r * 0.03), 6, seg);
  lip.rotateY(Math.PI / 2); lip.translate(hw * 0.9, 0, 0); trim.push(lip);
  const hubR = rr * (o.hub || 0.2);
  const hub = new T.CylinderGeometry(hubR, hubR * 1.05, hw * 0.16, 16); hub.rotateZ(Math.PI / 2); hub.translate(xo + 0.005, 0, 0);
  const style = o.style || 'five';
  if (style === 'disc') {
    const d = new T.CylinderGeometry(rr * 0.95, rr * 0.95, 0.018, seg); d.rotateZ(Math.PI / 2); d.translate(xo, 0, 0); parts.push(d);
    for (let i = 0; i < 12; i++) {   // turbine cut-outs suggested by dark slats
      const g = new T.BoxGeometry(0.012, rr * 0.32, rr * 0.07);
      g.applyMatrix4(new T.Matrix4().makeRotationY(0.5));
      g.applyMatrix4(new T.Matrix4().makeTranslation(xo + 0.008, rr * 0.62, 0));
      g.applyMatrix4(new T.Matrix4().makeRotationX(i / 12 * Math.PI * 2));
      trim.push(g);
    }
  } else if (style === 'steel') {   // classic 5-slot
    const d = new T.CylinderGeometry(rr * 0.94, rr * 0.94, 0.02, seg); d.rotateZ(Math.PI / 2); d.translate(xo, 0, 0); parts.push(d);
    for (let i = 0; i < 5; i++) {
      const g = new T.CylinderGeometry(rr * 0.13, rr * 0.13, 0.024, 10); g.rotateZ(Math.PI / 2); g.translate(xo + 0.006, rr * 0.56, 0);
      g.applyMatrix4(new T.Matrix4().makeRotationX(i / 5 * Math.PI * 2)); trim.push(g);
    }
  } else if (style === 'multi') {
    K.radial(parts, 14, hubR, rr * 0.96, rr * 0.075, 0.016, xo, {});
    K.radial(parts, 14, hubR, rr * 0.96, rr * 0.075, 0.016, xo - 0.02, { phase: 0.11 });
  } else if (style === 'turbine') {
    K.radial(parts, 10, hubR, rr * 0.97, rr * 0.16, 0.014, xo, { twist: 0.6 });
    K.radial(parts, 10, hubR, rr * 0.97, rr * 0.16, 0.014, xo - 0.02, { twist: -0.6, phase: 0.15 });
  } else if (style === 'wire') {
    for (let i = 0; i < 18; i++) {
      const a1 = i / 18 * Math.PI * 2, a2 = a1 + (i % 2 ? 0.55 : -0.55);
      const p1 = new V3(0, Math.cos(a1) * hubR, Math.sin(a1) * hubR), p2 = new V3(0, Math.cos(a2) * rr * 0.96, Math.sin(a2) * rr * 0.96);
      const len = p1.distanceTo(p2), g = new T.CylinderGeometry(0.004, 0.004, len, 4);
      const q = new T.Quaternion().setFromUnitVectors(_up, p2.clone().sub(p1).normalize());
      g.applyMatrix4(new T.Matrix4().compose(p1.clone().add(p2).multiplyScalar(0.5).add(new V3(i % 2 ? hw * 0.25 : -hw * 0.25, 0, 0)), q, new V3(1, 1, 1)));
      parts.push(g);
    }
  } else if (style === 'cast5') {
    K.radial(parts, 5, hubR, rr * 0.97, rr * 0.26, 0.018, xo, { twist: 0.12 });
    K.radial(parts, 5, hubR, rr * 0.97, rr * 0.12, 0.018, xo - 0.025, { phase: Math.PI / 5 });
  } else {                                      // 'five' double spoke
    K.radial(parts, 5, hubR, rr * 0.97, rr * 0.13, 0.02, xo, { phase: 0.09 });
    K.radial(parts, 5, hubR, rr * 0.97, rr * 0.13, 0.02, xo, { phase: -0.09 });
  }
  parts.push(hub);
  if (lod) for (let i = 0; i < 5; i++) {
    const g = new T.CylinderGeometry(hubR * 0.18, hubR * 0.18, 0.02, 6); g.rotateZ(Math.PI / 2); g.translate(xo + 0.02, hubR * 0.62, 0);
    g.applyMatrix4(new T.Matrix4().makeRotationX(i / 5 * Math.PI * 2)); trim.push(g);
  }
  const rim = new T.Mesh(K.merge(parts), o.rimMat || M.alu);
  spin.add(rim);
  const trimMesh = new T.Mesh(K.merge(trim), o.trimMat || M.chrome);
  spin.add(trimMesh);

  if (o.disc !== false && lod) {                // brake disc rotates, caliper does not
    const dg = new T.CylinderGeometry(rr * 0.9, rr * 0.9, 0.022, 24); dg.rotateZ(Math.PI / 2); dg.translate(hw * 0.28, 0, 0);
    spin.add(new T.Mesh(dg, M.disc));
    const cal = new T.Mesh(new T.BoxGeometry(hw * 0.5, rr * 0.5, rr * 0.42), o.caliperMat || M.caliper);
    cal.position.set(hw * 0.34, rr * 0.62, -rr * 0.28);
    group.add(cal);
  }
  return { group: group, spin: spin, r: r };
};

/* ------------------------------------------------------------- misc parts */
K.plate = function (text, w, h, bg, fg) {
  const m = new T.Mesh(new T.PlaneGeometry(w || 0.5, h || 0.125),
    new T.MeshStandardMaterial({ map: K.tex.plate(text, bg, fg), roughness: 0.5, metalness: 0.1 }));
  m.userData.keepOut = true;
  return m;
};
K.wing = function (mat, endMat, span, chord, thick, standH, standX, tilt) {
  const g = new T.Group();
  const blade = K.mesh(new T.BoxGeometry(span, thick, chord), mat, 0, 0, 0);
  blade.rotation.x = tilt || -0.12; g.add(blade);
  [-1, 1].forEach(function (s) {
    g.add(K.box(0.03, thick * 5.5, chord * 1.18, endMat || mat, s * span / 2, 0, 0));
    if (standH > 0) g.add(K.box(0.04, standH, 0.11, K.M.carbon, s * standX, -standH / 2 - thick / 2, chord * 0.05));
  });
  return g;
};
K.exhaust = function (r, len, x, y, z, mat) {
  const g = new T.Group();
  const o = new T.CylinderGeometry(r, r * 0.92, len, 14, 1, true); o.rotateX(Math.PI / 2);
  g.add(K.mesh(o, mat || K.M.chrome, x, y, z));
  const inner = new T.CylinderGeometry(r * 0.82, r * 0.82, len * 0.4, 12); inner.rotateX(Math.PI / 2);
  g.add(K.mesh(inner, K.M.black, x, y, z + len * 0.1));
  return g;
};
// Two-bone IK for a static pose: returns the joint (knee/elbow) position.
K.ik2 = function (a, b, l1, l2, pole) {
  const d = new V3().subVectors(b, a);
  const dist = Math.min(d.length(), l1 + l2 - 0.001);
  const dir = d.clone().normalize();
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  const side = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
  return a.clone().addScaledVector(dir, x).addScaledVector(side, h);
};

/* -------------------------------------------------------------------- rider */
// Stylised rider built from joint positions. j = { hip, shoulder, head, gripL, gripR, footL, footR }
K.rider = function (j, o) {
  const M = K.M;
  const g = new T.Group();
  const jacket = K.flat(o.jacket, 0.6, 0.05), pants = K.flat(o.pants || 0x1c2028, 0.75, 0), gloves = K.flat(o.gloves || 0x111111, 0.5, 0.1);
  const helm = o.helmetMat || K.paint(o.helmet, 'gloss');
  const boots = K.flat(o.boots || 0x141414, 0.55, 0.1);
  // torso: a loft along the hip -> shoulder direction
  const dir = new V3().subVectors(j.shoulder, j.hip), L = dir.length(); dir.normalize();
  const tor = K.loft([
    { z: 0, w: 0.17, y0: -0.1, y1: 0.09, p: 2.4 }, { z: L * 0.28, w: 0.18, y0: -0.11, y1: 0.1, p: 2.4 },
    { z: L * 0.7, w: 0.235, y0: -0.12, y1: 0.12, p: 2.5 }, { z: L * 0.95, w: 0.24, y0: -0.09, y1: 0.09, p: 2.4 },
    { z: L * 1.02, w: 0.16, y0: -0.05, y1: 0.05, p: 2.2 }
  ], { N: 14, under: false });
  const torso = new T.Mesh(tor, jacket); torso.castShadow = true;
  const zx = dir.clone(), xx = new V3(1, 0, 0), yy = new V3().crossVectors(zx, xx).normalize();
  xx.crossVectors(yy, zx).normalize();
  torso.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(xx, yy, zx));
  torso.position.copy(j.hip);
  g.add(torso);
  if (o.stripe) {     // jacket back stripe
    const s = K.box(0.06, 0.02, L * 0.7, K.flat(o.stripe, 0.5, 0.1));
    s.quaternion.copy(torso.quaternion); s.position.copy(j.hip).addScaledVector(dir, L * 0.5).addScaledVector(yy, -0.125 * 0 + 0.118 * (yy.y >= 0 ? 1 : 1));
    g.add(s);
  }
  // pelvis
  g.add(K.ell(0.19, 0.12, 0.16, pants, j.hip.x, j.hip.y, j.hip.z - 0.02));
  // head + helmet
  const hd = j.head;
  if (o.helmetStyle === 'half') {
    g.add(K.ell(0.155, 0.13, 0.17, helm, hd.x, hd.y + 0.03, hd.z, 16));
    g.add(K.ell(0.12, 0.095, 0.1, K.flat(0xd9a887, 0.6, 0), hd.x, hd.y - 0.045, hd.z + 0.06, 12));
    g.add(K.box(0.2, 0.045, 0.05, M.visor, hd.x, hd.y + 0.005, hd.z + 0.145));
  } else {
    g.add(K.ell(0.16, 0.165, 0.19, helm, hd.x, hd.y, hd.z, 18));
    const vis = K.ell(0.1, 0.06, 0.09, M.visor, hd.x, hd.y + 0.005, hd.z + 0.11, 12); g.add(vis);
    g.add(K.ell(0.1, 0.05, 0.08, helm, hd.x, hd.y - 0.075, hd.z + 0.1, 10));      // chin bar
    if (o.helmetStyle === 'mx') g.add(K.box(0.2, 0.012, 0.13, helm, hd.x, hd.y + 0.09, hd.z + 0.17));   // peak
  }
  g.add(K.tube(new V3(0, 0, 0).copy(j.shoulder).add(new V3(0, 0.01, 0.02)), new V3(hd.x, hd.y - 0.1, hd.z - 0.02), 0.055, jacket, 8)); // neck/collar
  // arms and legs
  [[-1, j.gripL, j.footL], [1, j.gripR, j.footR]].forEach(function (s) {
    const sh = new V3(s[0] * 0.2 + j.shoulder.x, j.shoulder.y - 0.02, j.shoulder.z);
    const el = K.ik2(sh, s[1], 0.29, 0.27, new V3(s[0] * 0.9, -0.4, -0.2));
    g.add(K.limb(sh, el, 0.062, 0.05, jacket, 8)); g.add(K.limb(el, s[1], 0.05, 0.042, jacket, 8));
    g.add(K.ell(0.06, 0.05, 0.07, jacket, sh.x, sh.y, sh.z, 8));
    g.add(K.ell(0.048, 0.042, 0.06, gloves, s[1].x, s[1].y, s[1].z, 8));
    const hp = new V3(s[0] * 0.13, j.hip.y, j.hip.z);
    const kn = K.ik2(hp, s[2], 0.42, 0.42, new V3(s[0] * 0.5, 0.3, 1));
    g.add(K.limb(hp, kn, 0.09, 0.066, pants, 8)); g.add(K.limb(kn, s[2], 0.066, 0.052, pants, 8));
    g.add(K.ell(0.07, 0.07, 0.07, pants, kn.x, kn.y, kn.z, 8));
    g.add(K.ell(0.06, 0.05, 0.13, boots, s[2].x, s[2].y - 0.02, s[2].z + 0.05, 8));
  });
  return g;
};

/* ------------------------------------------------- shared soft shadow + glow */
K.blob = function (w, l, y, opacity) {
  const m = new T.Mesh(new T.PlaneGeometry(w, l),
    new T.MeshBasicMaterial({ map: K.tex.blob(), transparent: true, opacity: opacity == null ? 0.6 : opacity, depthWrite: false, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = y == null ? 0.04 : y; m.renderOrder = 1; m.name = 'blob';
  return m;
};
K.underglow = function (hex, w, l) {
  const m = new T.Mesh(new T.PlaneGeometry(w, l),
    new T.MeshBasicMaterial({ map: K.tex.glow(), color: new T.Color(hex), transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.06; m.renderOrder = 2; m.name = 'underglow';
  return m;
};
})();
