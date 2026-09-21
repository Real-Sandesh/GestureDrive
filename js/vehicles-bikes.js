/* Gesture Drive - motorbikes: a shared builder + four bikes */
(function () {
'use strict';
const T = THREE, K = window.GDKit, V3 = T.Vector3;
const dm = function (h, r, m) { return K.decalMat(h, r, m); };

// spec: { rF,rR,wF,wR,zF,zR,rake,fork, wheel:{...}, leanMax, dims, parts(ctx) }
K.buildBike = function (spec, opts) {
  opts = opts || {};
  const M = K.M;
  const root = new T.Group(); root.rotation.order = 'YXZ';
  const lean = new T.Group(); root.add(lean);
  const st = new T.Group(), sst = new T.Group();      // frame parts / steering parts (baked separately)
  const paint = opts.paintMat || K.paint(opts.paint || 0xd8232a, spec.finish);
  const ud = root.userData;
  ud.type = 'bike'; ud.paint = [paint]; ud.lights = { head: [], tail: [], brake: [], rev: [] };
  ud.flames = []; ud.wheels = []; ud.lean = lean; ud.spec = spec;

  const A = new V3(0, spec.rF, spec.zF);                                    // front axle
  const up = new V3(0, Math.cos(spec.rake), -Math.sin(spec.rake));          // fork axis (pointing up)
  const H = A.clone().addScaledVector(up, spec.fork);                       // steering head
  ud.axis = up;
  const steerG = new T.Group(); steerG.position.copy(H); lean.add(steerG); ud.steerG = steerG;
  const S = function (x, y, z) { return new V3(x, y, z).sub(H); };            // world -> steer-local

  // wheels
  const fw = K.wheel(Object.assign({ r: spec.rF, w: spec.wF }, spec.wheel, spec.wheelF || {}));
  fw.group.position.copy(A).sub(H); steerG.add(fw.group);
  const rw = K.wheel(Object.assign({ r: spec.rR, w: spec.wR }, spec.wheel, spec.wheelR || {}));
  rw.group.position.set(0, spec.rR, spec.zR); lean.add(rw.group);
  ud.wheels.push({ spin: fw.spin, dir: 1, r: spec.rF }, { spin: rw.spin, dir: 1, r: spec.rR });

  // fork legs
  [-1, 1].forEach(function (s) {
    sst.add(K.tube(S(s * 0.09, A.y, A.z), S(s * 0.09, H.y - 0.02, H.z + 0.0), 0.028, spec.forkMat || M.chrome, 8));
    sst.add(K.tube(S(s * 0.09, A.y, A.z), S(s * 0.09, A.y + spec.fork * 0.45, A.z - Math.sin(spec.rake) * spec.fork * 0.45), 0.038, spec.forkLower || M.gun, 8));
  });
  sst.add(K.box(0.26, 0.04, 0.07, M.gun, 0, -0.02, 0));

  const ctx = {
    root: root, lean: lean, st: st, sst: sst, steer: steerG, H: H, A: A, up: up, S: S, paint: paint, M: M, ud: ud, spec: spec,
    swing: function (x) {           // swingarm + shock, common to every bike
      st.add(K.tube(new V3(x, 0.52, -0.05), new V3(x, spec.rR, spec.zR), 0.028, M.gun, 8));
      st.add(K.tube(new V3(0, 0.98, spec.zR * 0.55), new V3(0, 0.55, spec.zR * 0.6), 0.03, M.gold, 8));
    }
  };
  ctx.swing(0.11); ctx.swing(-0.11);
  spec.parts(ctx);

  lean.add(K.bake(st));
  steerG.add(K.bake(sst));
  ud.dims = spec.dims;
  if (!opts.noBlob) { const bl = K.blob(1.0, 2.6, 0.03, 0.6); root.add(bl); ud.blob = bl; }
  if (spec.glow) { const g = K.underglow(spec.glow, 1.4, 2.6); root.add(g); ud.glow = g; }
  root.traverse(function (o) { if (o.isMesh && o.name !== 'blob' && o.name !== 'underglow') o.castShadow = !(o.material && o.material.transparent); });
  ud.animate = bikeAnimate;
  return root;
};
function bikeAnimate(root, s) {
  const ud = root.userData, dt = s.dt, sp = s.speed;
  for (let i = 0; i < ud.wheels.length; i++) ud.wheels[i].spin.rotation.x += sp * dt / ud.wheels[i].r;
  const ang = -s.steer * 0.42 / (1 + Math.abs(sp) / 20);
  ud.cur = ud.cur == null ? 0 : ud.cur;
  ud.cur += (ang - ud.cur) * Math.min(1, dt * 12);
  ud.steerG.quaternion.setFromAxisAngle(ud.axis, ud.cur);
  const spd = Math.min(1, Math.abs(sp) / 30);
  const L = ud.lean, leanT = s.steer * ud.spec.leanMax * spd;
  L.rotation.z += (leanT - L.rotation.z) * Math.min(1, dt * 6);
  const pT = Math.max(-0.09, Math.min(0.09, -s.accel * 0.004));
  L.rotation.x += (pT - L.rotation.x) * Math.min(1, dt * 6);
  const Ls = ud.lights;
  for (let i = 0; i < Ls.head.length; i++) Ls.head[i].emissiveIntensity = 0.9 + s.night * 2.6;
  for (let i = 0; i < Ls.tail.length; i++) Ls.tail[i].emissiveIntensity = 0.6 + s.night * 0.9 + (s.brake > 0 ? 2.6 : 0);
  if (ud.glow) ud.glow.material.opacity = 0.2 + s.night * 0.6;
  for (let i = 0; i < ud.flames.length; i++) { const f = ud.flames[i]; f.visible = !!s.boost; if (s.boost) f.scale.set(1, 1, 0.8 + Math.random() * 0.6); }
}

/* shared sport-bike body: tank, seat, tail, fairing (used by Blade and Ghost) */
function sportBody(ctx, o) {
  const M = ctx.M, st = ctx.st, paint = ctx.paint, acc = o.accentMat;
  const fair = new T.Mesh(K.loft([
    { z: 1.02, w: 0.1, y0: 0.66, y1: 0.86, p: 2.6 }, { z: 0.92, w: 0.17, y0: 0.6, y1: 0.95, p: 2.6 },
    { z: 0.6, w: 0.26, y0: 0.42, y1: 1.06, p: 2.8 }, { z: 0.2, w: 0.3, y0: 0.32, y1: 1.02, p: 2.8 },
    { z: -0.1, w: 0.27, y0: 0.32, y1: 0.98, p: 2.8 }, { z: -0.2, w: 0.2, y0: 0.4, y1: 0.95, p: 2.8 }
  ], { N: 22 }), [paint, M.dark]);
  st.add(fair);
  st.updateMatrixWorld(true);
  const tank = new T.Mesh(K.loft([
    { z: 0.35, w: 0.15, y0: 0.9, y1: 1.08, p: 2.6 }, { z: 0.1, w: 0.2, y0: 0.86, y1: 1.15, p: 2.6 },
    { z: -0.2, w: 0.19, y0: 0.86, y1: 1.12, p: 2.6 }, { z: -0.4, w: 0.15, y0: 0.88, y1: 1.02, p: 2.6 }
  ], { N: 20, under: false }), acc || paint);
  st.add(tank);
  st.add(new T.Mesh(K.loft([
    { z: -0.35, w: 0.15, y0: 0.9, y1: 0.99, p: 2.4 }, { z: -0.7, w: 0.17, y0: 0.9, y1: 0.98, p: 2.4 }, { z: -0.9, w: 0.12, y0: 0.92, y1: 0.98, p: 2.4 }
  ], { N: 14, under: false }), K.M.leather));
  const tail = new T.Mesh(K.loft([
    { z: -0.6, w: 0.14, y0: 0.88, y1: 1.0, p: 2.6 }, { z: -0.95, w: 0.13, y0: 0.9, y1: 1.06, p: 2.6 }, { z: -1.2, w: 0.08, y0: 0.94, y1: 1.1, p: 2.6 }
  ], { N: 16, under: false }), paint);
  st.add(tail);
  // lights
  const hl = K.lamp(0xfff4dc, 0.9); ctx.ud.lights.head.push(hl);
  [-1, 1].forEach(function (s) { st.add(K.endPatch(fair, 1, s > 0 ? 0.03 : -0.13, s > 0 ? 0.13 : -0.03, 0.72, 0.8, hl, { nu: 3, nv: 2, lift: 0.006 })); });
  const tl = K.lamp(0xff1a1a, 0.6); ctx.ud.lights.tail.push(tl);
  st.add(K.endPatch(tail, -1, -0.08, 0.08, 0.97, 1.03, tl, { nu: 3, nv: 1, lift: 0.006 }));
  // screen, engine, exhaust
  const scr = K.box(0.26, 0.24, 0.02, M.glass, 0, 1.17, 0.6); scr.rotation.x = -0.75; scr.renderOrder = 2; st.add(scr);
  st.add(K.box(0.3, 0.32, 0.5, M.gun, 0, 0.52, 0.0));
  st.add(K.tube(new V3(0.2, 0.36, -0.1), new V3(0.19, 0.6, -1.0), 0.06, o.exhaustMat || M.alu, 10));
  st.add(K.ell(0.06, 0.06, 0.03, M.black, 0.19, 0.6, -1.02, 8));
  const fl = K.flame(0.05, 1.0, 0.19, 0.6, -1.05, 0x6fc4ff); ctx.ud.flames.push(fl); ctx.lean.add(fl);
  st.add(K.tube(new V3(0, 0.75, 0.3), new V3(0, 0.5, -0.1), 0.03, M.gun, 6));
  // front fender + bars + plate on the steering assembly
  const fend = K.box(0.16, 0.03, 0.5, paint, 0, ctx.A.y + 0.4 - ctx.H.y, 0.02); fend.rotation.x = 0.1; ctx.sst.add(fend);
  [-1, 1].forEach(function (s) {
    ctx.sst.add(K.tube(ctx.S(s * 0.12, ctx.H.y + 0.03, ctx.H.z + 0.02), ctx.S(s * 0.32, 1.06, 0.4), 0.017, M.black, 6));
    ctx.sst.add(K.tube(ctx.S(s * 0.3, 1.06, 0.4), ctx.S(s * 0.34, 1.06, 0.5), 0.02, M.rubber, 6));
  });
  // rider
  const rider = K.rider({
    hip: new V3(0, 1.0, -0.38), shoulder: new V3(0, 1.34, 0.12), head: new V3(0, 1.46, 0.32),
    gripL: new V3(-0.33, 1.06, 0.48), gripR: new V3(0.33, 1.06, 0.48), footL: new V3(-0.22, 0.44, -0.3), footR: new V3(0.22, 0.44, -0.3)
  }, o.rider);
  ctx.lean.add(rider);
}

/* ============================================================ 1. DUST DEVIL MX */
K.defs.push({
  id: 'dustdevil', name: 'Dust Devil MX', type: 'bike', cls: 'Dirt bike', price: 350, defaultPaint: 0xff7a1a,
  blurb: 'Knobby tyres, long-travel forks and a loud two-stroke. Light, twitchy and the best jumper in the garage.',
  phys: { maxSpeed: 44, accel: 20, brake: 30, turn: 2.6, R: 1.15, jump: 1.3, tough: 0.7 },
  sound: { kind: 'two' }, cam: { back: 6.3, up: 3.0 },
  build: function (o) {
    return K.buildBike({
      finish: 'gloss', rF: 0.42, rR: 0.39, wF: 0.13, wR: 0.17, zF: 0.82, zR: -0.8, rake: 0.5, fork: 1.0, leanMax: 0.6,
      forkMat: K.M.gold, forkLower: K.M.gold, dims: { L: 2.1, W: 0.8, H: 1.85 },
      wheel: { style: 'wire', rim: 0.72, tread: 'knobby', rimMat: K.M.alu, hub: 0.14, disc: true },
      parts: function (ctx) {
        const M = ctx.M, st = ctx.st, paint = ctx.paint, dark = K.flat(0x1a1c20, 0.6, 0.2);
        // engine & frame
        st.add(K.box(0.28, 0.34, 0.42, M.gun, 0, 0.62, -0.05));
        st.add(K.ell(0.09, 0.14, 0.12, M.alu, 0, 0.9, 0.05, 10));
        st.add(K.tube(new V3(0, 1.12, 0.32), new V3(0, 0.6, 0.18), 0.03, M.gun, 6));
        st.add(K.tube(new V3(0, 1.0, -0.05), new V3(0, 0.55, -0.35), 0.03, M.gun, 6));
        // plastics: radiator shrouds, tank, seat, rear fender
        const shroud = new T.Mesh(K.loft([
          { z: 0.42, w: 0.13, y0: 0.9, y1: 1.16, p: 2.6 }, { z: 0.15, w: 0.22, y0: 0.72, y1: 1.16, p: 2.6 },
          { z: -0.2, w: 0.2, y0: 0.76, y1: 1.08, p: 2.6 }, { z: -0.35, w: 0.14, y0: 0.88, y1: 1.04, p: 2.6 }
        ], { N: 18, under: false }), paint);
        st.add(shroud);
        st.add(new T.Mesh(K.loft([{ z: -0.1, w: 0.13, y0: 0.98, y1: 1.06, p: 2.4 }, { z: -0.5, w: 0.14, y0: 1.0, y1: 1.07, p: 2.4 }, { z: -0.85, w: 0.12, y0: 1.04, y1: 1.1, p: 2.4 }], { N: 12, under: false }), M.leather));
        const rf = K.box(0.2, 0.03, 0.55, paint, 0, 1.2, -0.95); rf.rotation.x = 0.35; st.add(rf);
        const tl = K.lamp(0xff1a1a, 0.6); ctx.ud.lights.tail.push(tl); st.add(K.box(0.12, 0.05, 0.03, tl, 0, 1.14, -1.2));
        const np = new T.Mesh(new T.PlaneGeometry(0.26, 0.26), new T.MeshStandardMaterial({ map: K.tex.number('27', '#f5f5ee', '#111'), roughness: 0.6 }));
        np.position.set(0, 1.0, -1.06); np.rotation.set(0.35, Math.PI, 0); st.add(np);
        [-1, 1].forEach(function (s) { const sp = new T.Mesh(new T.PlaneGeometry(0.24, 0.24), new T.MeshStandardMaterial({ map: K.tex.number('27', '#f5f5ee', '#111'), roughness: 0.6 })); sp.position.set(s * 0.2, 1.02, -0.5); sp.rotation.y = s * Math.PI / 2; st.add(sp); });
        // high exhaust pipe
        st.add(K.tube(new V3(0.13, 0.5, 0.1), new V3(0.2, 0.7, -0.4), 0.045, M.alu, 8));
        st.add(K.tube(new V3(0.2, 0.7, -0.4), new V3(0.22, 1.05, -0.9), 0.06, M.alu, 10));
        const fl = K.flame(0.05, 1.0, 0.22, 1.05, -0.95, 0xffa040); ctx.ud.flames.push(fl); ctx.lean.add(fl);
        // steering side: high front fender, number plate, bars
        const ff = K.box(0.15, 0.03, 0.45, paint, 0, ctx.A.y + 0.5 - ctx.H.y, 0.12); ff.rotation.x = -0.35; ctx.sst.add(ff);
        const fp = new T.Mesh(new T.PlaneGeometry(0.3, 0.26), new T.MeshStandardMaterial({ map: K.tex.number('27', '#f5f5ee', '#111'), roughness: 0.6 }));
        fp.position.copy(ctx.S(0, 1.17, 0.5)); fp.rotation.x = -0.3; ctx.sst.add(fp);
        ctx.sst.add(K.tube(ctx.S(-0.4, 1.4, 0.26), ctx.S(0.4, 1.4, 0.26), 0.017, M.black, 6));
        [-1, 1].forEach(function (s) { ctx.sst.add(K.tube(ctx.S(s * 0.1, ctx.H.y + 0.05, ctx.H.z), ctx.S(s * 0.38, 1.4, 0.24), 0.02, M.black, 6)); ctx.sst.add(K.tube(ctx.S(s * 0.3, 1.4, 0.26), ctx.S(s * 0.46, 1.4, 0.26), 0.026, M.rubber, 6)); });
        const hl = K.lamp(0xfff4dc, 0.9); ctx.ud.lights.head.push(hl); ctx.sst.add(K.box(0.14, 0.09, 0.03, hl, 0, 1.06 - ctx.H.y, 0.54 - ctx.H.z));
        ctx.lean.add(K.rider({
          hip: new V3(0, 1.08, -0.42), shoulder: new V3(0, 1.56, -0.08), head: new V3(0, 1.74, 0.04),
          gripL: new V3(-0.42, 1.4, 0.26), gripR: new V3(0.42, 1.4, 0.26), footL: new V3(-0.24, 0.5, -0.22), footR: new V3(0.24, 0.5, -0.22)
        }, { jacket: 0x1d6be0, pants: 0x161a22, helmet: 0xffffff, helmetStyle: 'mx', boots: 0xe8e8e8 }));
      }
    }, o);
  }
});

/* ============================================================== 2. BLADE 600 */
K.defs.push({
  id: 'blade', name: 'Blade 600', type: 'bike', cls: 'Sport bike', price: 900, defaultPaint: 0xd8232a,
  blurb: 'Full fairing, screaming inline-four, rider tucked behind the screen. Razor sharp in the bends.',
  phys: { maxSpeed: 62, accel: 25, brake: 42, turn: 2.5, R: 1.15, jump: 0.9, tough: 0.55 },
  sound: { kind: 'i4bike' }, cam: { back: 6.4, up: 3.05 },
  build: function (o) {
    return K.buildBike({
      finish: 'gloss', rF: 0.32, rR: 0.33, wF: 0.15, wR: 0.2, zF: 0.72, zR: -0.72, rake: 0.44, fork: 0.75, leanMax: 0.75,
      forkMat: K.M.gold, forkLower: K.M.gun, dims: { L: 2.1, W: 0.8, H: 1.55 },
      wheel: { style: 'five', rim: 0.68, rimMat: K.M.gun },
      parts: function (ctx) {
        sportBody(ctx, { accentMat: K.paint(0xf1f1ee, 'gloss'), rider: { jacket: 0xd8232a, pants: 0x1a1d24, helmet: 0xf4f4f0, stripe: 0xffffff } });
      }
    }, o);
  }
});

/* ============================================================== 3. OUTLAW 1200 */
K.defs.push({
  id: 'outlaw', name: 'Outlaw 1200', type: 'bike', cls: 'Cruiser', price: 1500, defaultPaint: 0x7a1f1f,
  blurb: 'Chrome V-twin, fat rear tyre and wide bars. Lazy lean, stable at speed, unmistakable rumble.',
  phys: { maxSpeed: 52, accel: 17, brake: 30, turn: 1.85, R: 1.25, jump: 0.85, tough: 0.8 },
  sound: { kind: 'twin' }, cam: { back: 6.8, up: 3.2 },
  build: function (o) {
    return K.buildBike({
      finish: 'pearl', rF: 0.36, rR: 0.35, wF: 0.13, wR: 0.27, zF: 0.98, zR: -0.86, rake: 0.55, fork: 0.95, leanMax: 0.42,
      forkMat: K.M.chrome, forkLower: K.M.chrome, dims: { L: 2.4, W: 0.9, H: 1.7 },
      wheel: { style: 'wire', rim: 0.74, rimMat: K.M.chrome, disc: true },
      parts: function (ctx) {
        const M = ctx.M, st = ctx.st, paint = ctx.paint;
        // V-twin engine
        st.add(K.box(0.3, 0.3, 0.42, M.gun, 0, 0.52, 0.0));
        [-1, 1].forEach(function (s) {
          const a = new V3(0, 0.62, s * 0.08 + 0.02), b = new V3(0, 0.62 + 0.3 * 0.82, a.z + s * 0.3 * 0.57);
          const cyl = K.limb(a, b, 0.1, 0.1, M.chrome, 12); st.add(cyl);
          for (let i = 0; i < 4; i++) { const p = a.clone().lerp(b, 0.25 + i * 0.2); st.add(K.mesh(new T.CylinderGeometry(0.125, 0.125, 0.018, 12), M.alu, p.x, p.y, p.z)); }
        });
        // tank, saddle, fenders
        st.add(K.ell(0.2, 0.17, 0.4, paint, 0, 1.1, 0.12, 18));
        st.add(new T.Mesh(K.loft([{ z: -0.1, w: 0.14, y0: 0.82, y1: 0.9, p: 2.4 }, { z: -0.5, w: 0.19, y0: 0.8, y1: 0.9, p: 2.4 }, { z: -0.9, w: 0.15, y0: 0.82, y1: 0.92, p: 2.4 }], { N: 14, under: false }), M.leather));
        st.add(new T.Mesh(K.loft([{ z: -0.25, w: 0.2, y0: 0.62, y1: 0.7, p: 2.4 }], { N: 4 }), M.black));
        const rf = new T.Mesh(new T.CylinderGeometry(0.4, 0.4, 0.3, 24, 1, true, Math.PI * 1.0, Math.PI * 0.8), paint); rf.rotation.z = Math.PI / 2; rf.rotation.y = Math.PI / 2;
        rf.geometry.rotateZ(0); rf.position.set(0, 0.35, -0.86); rf.rotation.set(0, 0, Math.PI / 2); rf.material = paint; rf.material.side = T.DoubleSide;
        const rfb = K.box(0.36, 0.03, 0.75, paint, 0, 0.72, -0.9); rfb.rotation.x = -0.1; st.add(rfb);
        [-1, 1].forEach(function (s) { st.add(K.box(0.03, 0.22, 0.7, paint, s * 0.18, 0.62, -0.9)); });
        const tl = K.lamp(0xff1a1a, 0.6); ctx.ud.lights.tail.push(tl); st.add(K.box(0.14, 0.05, 0.03, tl, 0, 0.7, -1.28));
        // sissy bar
        st.add(K.tube(new V3(0, 0.85, -0.9), new V3(0, 1.3, -1.05), 0.02, M.chrome, 6));
        // exhaust pipes
        [0.24].forEach(function (x) {
          st.add(K.tube(new V3(0.1, 0.5, 0.2), new V3(x, 0.36, -0.1), 0.045, M.chrome, 8));
          st.add(K.tube(new V3(x, 0.36, -0.1), new V3(x, 0.4, -1.1), 0.065, M.chrome, 10));
          st.add(K.ell(0.06, 0.06, 0.02, M.black, x, 0.4, -1.11, 8));
        });
        const fl = K.flame(0.06, 1.0, 0.24, 0.4, -1.15, 0xffa040); ctx.ud.flames.push(fl); ctx.lean.add(fl);
        // steering side: fender, headlight bucket, wide bars
        const ff = K.box(0.17, 0.03, 0.55, paint, 0, ctx.A.y + 0.45 - ctx.H.y, 0.05); ff.rotation.x = 0.1; ctx.sst.add(ff);
        ctx.sst.add(K.ell(0.14, 0.14, 0.12, M.chrome, 0, 0.1, 0.16, 14));
        const hl = K.lamp(0xfff4dc, 0.9); ctx.ud.lights.head.push(hl); ctx.sst.add(K.mesh(new T.CylinderGeometry(0.1, 0.1, 0.03, 16).rotateX(Math.PI / 2), hl, 0, 0.1, 0.27));
        [-1, 1].forEach(function (s) {
          ctx.sst.add(K.tube(ctx.S(s * 0.1, ctx.H.y + 0.05, ctx.H.z), ctx.S(s * 0.4, 1.36, 0.3), 0.02, M.chrome, 6));
          ctx.sst.add(K.tube(ctx.S(s * 0.4, 1.36, 0.3), ctx.S(s * 0.46, 1.3, 0.05), 0.02, M.chrome, 6));
          ctx.sst.add(K.tube(ctx.S(s * 0.44, 1.32, 0.2), ctx.S(s * 0.47, 1.3, 0.02), 0.03, M.rubber, 6));
        });
        ctx.lean.add(K.rider({
          hip: new V3(0, 0.92, -0.5), shoulder: new V3(0, 1.48, -0.3), head: new V3(0, 1.66, -0.25),
          gripL: new V3(-0.44, 1.31, 0.03), gripR: new V3(0.44, 1.31, 0.03), footL: new V3(-0.27, 0.38, 0.32), footR: new V3(0.27, 0.38, 0.32)
        }, { jacket: 0x1a1a1c, pants: 0x27303f, helmet: 0x1a1a1c, helmetStyle: 'half', boots: 0x141414 }));
      }
    }, o);
  }
});

/* ============================================================== 4. GHOST RR */
K.defs.push({
  id: 'ghost', name: 'Ghost RR', type: 'bike', cls: 'Superbike', price: 3600, defaultPaint: 0x1c1f26,
  blurb: 'Carbon bodywork, winglets and a hair-raising top speed of 280 km/h. Not for the faint-hearted.',
  phys: { maxSpeed: 78, accel: 31, brake: 48, turn: 2.35, R: 1.15, jump: 0.85, tough: 0.5 },
  sound: { kind: 'sbk' }, cam: { back: 6.6, up: 3.1 },
  build: function (o) {
    return K.buildBike({
      finish: 'matte', rF: 0.32, rR: 0.34, wF: 0.16, wR: 0.22, zF: 0.74, zR: -0.74, rake: 0.42, fork: 0.78, leanMax: 0.8, glow: 0x35e0ff,
      forkMat: K.M.gold, forkLower: K.M.carbon, dims: { L: 2.15, W: 0.85, H: 1.55 },
      wheel: { style: 'cast5', rim: 0.7, rimMat: K.M.gun, trimMat: K.M.gold },
      parts: function (ctx) {
        sportBody(ctx, { accentMat: K.M.carbon, exhaustMat: K.M.carbon, rider: { jacket: 0x22262e, pants: 0x14161b, helmet: 0x35e0ff, stripe: 0x35e0ff } });
        const M = ctx.M, neon = K.lamp(0x35e0ff, 1.6); ctx.ud.lights.head.push(neon);
        [-1, 1].forEach(function (s) {
          const w = K.box(0.2, 0.02, 0.1, M.carbon, s * 0.3, 0.86, 0.75); w.rotation.z = s * 0.2; ctx.st.add(w);
          ctx.st.add(K.box(0.02, 0.02, 0.5, neon, s * 0.28, 0.5, 0.2));
        });
      }
    }, o);
  }
});
})();
