/* ============================================================================
   Gesture Drive - cars
   A generic car builder (lofted body + glass cabin + arches + wheels) and the
   roster of drivable cars. Each car adds its own signature parts on top.
   ========================================================================== */
(function () {
'use strict';
const T = THREE, K = window.GDKit, V3 = T.Vector3, C = K.C;

/* ---------------------------------------------------------------- pipeline */
// spec: { L, wheels:{front,rear}, body:{top,wid,base,pt,pb,tw}, cabin:{roof,wid,tw,pt,cap}, extras(ctx) }
K.buildCar = function (spec, opts) {
  opts = opts || {};
  const lod = opts.lod == null ? 1 : opts.lod;
  const M = K.M;
  const root = new T.Group(); root.rotation.order = 'YXZ';
  const bodyG = new T.Group(); root.add(bodyG);
  const st = new T.Group();           // baked later
  const paint = opts.paintMat || K.paint(opts.paint || 0xd8232a, spec.finish);
  const ud = root.userData;
  ud.type = 'car'; ud.paint = [paint]; ud.lights = { head: [], tail: [], brake: [], rev: [] };
  ud.flames = []; ud.wheels = []; ud.body = bodyG; ud.spec = spec;

  const B = spec.body, base = B.base == null ? 0.2 : B.base;
  const topF = K.curve(B.top), widF = K.curve(B.wid);
  const zmin = B.top[0][0], zmax = B.top[B.top.length - 1][0];
  const fw = spec.wheels.front, rw = spec.wheels.rear;
  const wheelList = [{ z: fw.z, r: fw.r }, { z: rw.z, r: rw.r }];
  const gap = B.archGap == null ? 0.05 : B.archGap;

  // --- body stations (dense around the wheel arches)
  const zs = [];
  B.top.forEach(function (p) { zs.push(p[0]); });
  for (let z = zmin; z <= zmax; z += (lod ? 0.14 : 0.3)) zs.push(z);
  const special = [];
  wheelList.forEach(function (wl) {
    const R = wl.r + gap;
    for (let k = -6; k <= 6; k++) zs.push(wl.z + k * R / 6);
    special.push({ z: wl.z - R - 0.004, y0: base }, { z: wl.z + R + 0.004, y0: base });
    zs.push(wl.z - R - 0.004, wl.z + R + 0.004);
  });
  zs.sort(function (a, b) { return a - b; });
  const stations = [];
  let lastZ = -99;
  zs.forEach(function (z) {
    if (z < zmin - 1e-6 || z > zmax + 1e-6 || z - lastZ < 0.003) return;
    lastZ = z;
    let y0 = base;
    wheelList.forEach(function (wl) {
      const R = wl.r + gap, dz = z - wl.z;
      if (Math.abs(dz) <= R + 1e-6) y0 = Math.max(y0, wl.r + Math.sqrt(Math.max(0, R * R - dz * dz)));
    });
    const y1 = topF(z);
    y0 = Math.min(y0, y1 - 0.07);
    stations.push({ z: z, w: widF(z), y0: y0, y1: y1, pt: B.pt || 3.3, pb: B.pb || 6, tw: B.tw == null ? 0.94 : B.tw });
  });
  const bodyGeo = K.loft(stations, { N: lod ? 30 : 18 });
  const body = new T.Mesh(bodyGeo, [paint, M.dark]);
  body.castShadow = true;
  st.add(body);
  st.updateMatrixWorld(true);

  // dark blocks inside each wheel arch so you can never see straight through the car
  wheelList.forEach(function (wl, i) {
    const wsp = i === 0 ? fw : rw, R = wl.r + gap;
    const inner = wsp.x - wsp.w / 2 - 0.01;
    const wh = Math.max(0.1, wl.r * 2 + gap - base - 0.03);
    st.add(K.box(inner * 2, wh, R * 1.9, M.black, 0, base + wh / 2 - 0.01, wl.z));
  });

  // --- cabin (glass) + painted roof panel
  const cab = spec.cabin;
  let cabinMesh = null, roofF = null, cwF = null;
  if (cab) {
    roofF = K.curve(cab.roof); cwF = K.curve(cab.wid);
    const c0 = cab.roof[0][0], c1 = cab.roof[cab.roof.length - 1][0];
    const cs = [];
    for (let z = c0; z <= c1 + 1e-6; z += (lod ? 0.07 : 0.16)) cs.push(z);
    cab.roof.forEach(function (p) { cs.push(p[0]); });
    cs.sort(function (a, b) { return a - b; });
    const cst = []; let lz = -99;
    cs.forEach(function (z) {
      if (z - lz < 0.004) return; lz = z;
      cst.push({ z: z, w: cwF(z), y0: topF(z) - (cab.sink == null ? 0.14 : cab.sink), y1: roofF(z), pt: cab.pt || 2.7, pb: 4, tw: cab.tw == null ? 0.7 : cab.tw });
    });
    cabinMesh = new T.Mesh(K.loft(cst, { N: lod ? 26 : 16, under: false }), M.glass);
    cabinMesh.renderOrder = 2;
    st.add(cabinMesh);
    if (cab.cap !== false) {
      const roofMax = Math.max.apply(null, cab.roof.map(function (p) { return p[1]; }));
      const drop = cab.capDrop == null ? 0.1 : cab.capDrop;
      const rs = [];
      cst.forEach(function (s) { if (s.y1 > roofMax - drop) rs.push({ z: s.z, w: s.w * (cab.tw == null ? 0.7 : cab.tw) * (cab.capW || 0.78), y0: s.y1 - 0.05, y1: s.y1 + 0.006, p: 2.6, pt: 2.6, pb: 2.6 }); });
      if (rs.length > 2) {
        const roofM = new T.Mesh(K.loft(rs, { N: 14, under: false }), cab.capMat || paint);
        st.add(roofM);
      }
    }
  }

  // --- wheels
  const wheelOpts = function (w) { return Object.assign({ lod: lod }, w); };
  [[fw, true], [rw, false]].forEach(function (pair) {
    const w = pair[0], front = pair[1];
    [1, -1].forEach(function (side) {
      const wh = K.wheel(wheelOpts(w));
      const flip = wh.group; flip.rotation.y = side > 0 ? 0 : Math.PI;
      const pivot = new T.Group(); pivot.position.set(side * w.x, w.r, w.z); pivot.add(flip);
      root.add(pivot);
      wh.spin.userData.dir = side > 0 ? 1 : -1; wh.spin.userData.r = w.r;
      ud.wheels.push({ pivot: pivot, spin: wh.spin, front: front, dir: side > 0 ? 1 : -1, r: w.r, side: side });
    });
  });

  const ctx = {
    root: root, st: st, body: body, cabin: cabinMesh, paint: paint, ud: ud, M: M, lod: lod, spec: spec,
    topF: topF, widF: widF, roofF: roofF, cwF: cwF, base: base, fw: fw, rw: rw, zmin: zmin, zmax: zmax,
    both: function (fn) { fn(1); fn(-1); }
  };
  if (spec.extras) spec.extras(ctx);

  const baked = K.bake(st);
  bodyG.add(baked);

  // contact shadow + optional underglow
  const dims = spec.dims || { L: zmax - zmin, W: widF(0) * 2, H: 1.4 };
  ud.dims = dims;
  if (!opts.noBlob) { const bl = K.blob(dims.W * 1.7, dims.L * 1.35, 0.03, 0.62); root.add(bl); ud.blob = bl; }
  if (spec.glow && lod) { const ug = K.underglow(spec.glow, dims.W * 2.1, dims.L * 1.6); root.add(ug); ud.glow = ug; }
  root.traverse(function (o) { if (o.isMesh && o.name !== 'blob' && o.name !== 'underglow') o.castShadow = o.castShadow !== false && !(o.material && o.material.transparent); });
  ud.animate = carAnimate;
  return root;
};

const _tmpQ = new T.Quaternion();
// s = { speed, steer, accel, night, brake(0..1), boost(bool), dt, airborne }
function carAnimate(root, s) {
  const ud = root.userData, dt = s.dt;
  const sp = s.speed;
  for (let i = 0; i < ud.wheels.length; i++) {
    const w = ud.wheels[i];
    w.spin.rotation.x += w.dir * sp * dt / w.r;
    if (w.front) {
      const lock = 0.55 / (1 + Math.abs(sp) / 22);
      w.pivot.rotation.y += (s.steer * -lock - w.pivot.rotation.y) * Math.min(1, dt * 14);
    }
  }
  const b = ud.body, spd = Math.min(1, Math.abs(sp) / 40);
  const rollT = -s.steer * 0.05 * spd * (ud.spec.roll == null ? 1 : ud.spec.roll);
  const pitchT = -s.accel * 0.0032 * (ud.spec.pitch == null ? 1 : ud.spec.pitch);
  b.rotation.z += (rollT - b.rotation.z) * Math.min(1, dt * 7);
  b.rotation.x += (Math.max(-0.05, Math.min(0.05, pitchT)) - b.rotation.x) * Math.min(1, dt * 6);
  b.position.y = 0.006 * Math.sin(performance.now() * 0.03) * spd;

  const L = ud.lights;
  const headI = 0.9 + s.night * 2.6;
  for (let i = 0; i < L.head.length; i++) L.head[i].emissiveIntensity = headI;
  const tailI = 0.55 + s.night * 0.9 + (s.brake > 0 ? 2.6 : 0);
  for (let i = 0; i < L.tail.length; i++) L.tail[i].emissiveIntensity = tailI;
  for (let i = 0; i < L.rev.length; i++) L.rev[i].emissiveIntensity = sp < -0.5 ? 2.2 : 0.04;
  if (ud.glow) ud.glow.material.opacity = 0.2 + s.night * 0.6;
  for (let i = 0; i < ud.flames.length; i++) {
    const f = ud.flames[i];
    f.visible = !!s.boost;
    if (s.boost) { const k = 0.8 + Math.random() * 0.6; f.scale.set(1, 1, k); f.material.opacity = 0.7 + Math.random() * 0.3; }
  }
}
K.animateVehicle = function (root, s) { root.userData.animate(root, s); };

/* -------------------------------------------------------------- shared bits */
// exhaust flame cone (visible while boosting)
K.flame = function (r, len, x, y, z, hex) {
  const g = new T.ConeGeometry(r, len, 10, 1, true); g.rotateX(-Math.PI / 2);   // tip points -z
  g.translate(0, 0, -len / 2);
  const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: new T.Color(hex || 0x6fc4ff), transparent: true, opacity: 0.8, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide, fog: false }));
  m.position.set(x, y, z); m.visible = false; m.renderOrder = 3;
  return m;
};
function lampBar(ctx, end, x0, x1, y0, y1, mat, list) {
  ctx.both(function (s) {
    const a = s > 0 ? x0 : -x1, b = s > 0 ? x1 : -x0;
    const p = K.endPatch(ctx.body, end, a, b, y0, y1, mat, { nu: 6, nv: 3, lift: 0.006 });
    ctx.st.add(p);
  });
}
K.parts = {
  // headlights (glowing lens + dark surround), tail lights
  head: function (ctx, x0, x1, y0, y1, hex) {
    const lamp = K.lamp(hex || 0xfff4dc, 0.9); ctx.ud.lights.head.push(lamp);
    const sur = K.decalMat(0x0b0c0f, 0.3, 0.6);
    ctx.both(function (s) {
      const a = s > 0 ? x0 : -x1, b = s > 0 ? x1 : -x0;
      ctx.st.add(K.endPatch(ctx.body, 1, a - 0.02, b + 0.02, y0 - 0.015, y1 + 0.015, sur, { nu: 6, nv: 3, lift: 0.004 }));
      ctx.st.add(K.endPatch(ctx.body, 1, a, b, y0, y1, lamp, { nu: 6, nv: 3, lift: 0.008 }));
    });
  },
  tail: function (ctx, x0, x1, y0, y1, hex) {
    const lamp = K.lamp(hex || 0xff1a1a, 0.55); ctx.ud.lights.tail.push(lamp);
    const sur = K.decalMat(0x0b0c0f, 0.3, 0.6);
    ctx.both(function (s) {
      const a = s > 0 ? x0 : -x1, b = s > 0 ? x1 : -x0;
      ctx.st.add(K.endPatch(ctx.body, -1, a - 0.02, b + 0.02, y0 - 0.015, y1 + 0.015, sur, { nu: 6, nv: 3, lift: 0.004 }));
      ctx.st.add(K.endPatch(ctx.body, -1, a, b, y0, y1, lamp, { nu: 6, nv: 3, lift: 0.008 }));
    });
  },
  reverse: function (ctx, x0, x1, y0, y1) {
    const lamp = K.lamp(0xffffff, 0.04); ctx.ud.lights.rev.push(lamp);
    ctx.both(function (s) {
      const a = s > 0 ? x0 : -x1, b = s > 0 ? x1 : -x0;
      ctx.st.add(K.endPatch(ctx.body, -1, a, b, y0, y1, lamp, { nu: 3, nv: 2, lift: 0.008 }));
    });
  },
  // dark band on the nose (grille / intake)
  grille: function (ctx, x0, x1, y0, y1, chromeBars) {
    const dm = K.decalMat(0x0a0a0c, 0.4, 0.5);
    ctx.st.add(K.endPatch(ctx.body, 1, x0, x1, y0, y1, dm, { nu: 8, nv: 3, lift: 0.005 }));
    if (chromeBars) for (let i = 1; i <= chromeBars; i++) {
      const y = y0 + (y1 - y0) * i / (chromeBars + 1);
      ctx.st.add(K.endPatch(ctx.body, 1, x0 + 0.02, x1 - 0.02, y - 0.006, y + 0.006, K.M.chrome, { nu: 8, nv: 1, lift: 0.009 }));
    }
  },
  plate: function (ctx, end, y, text, z) {
    const p = K.plate(text, 0.5, 0.125);
    const h = K.hit(ctx.body, new V3(0, y, end * 6), new V3(0, 0, -end));
    if (!h) return;
    p.position.copy(h.p).addScaledVector(h.n, 0.012);
    p.lookAt(p.position.clone().add(h.n));
    ctx.st.add(p);
  },
  // door shut lines on both flanks
  doors: function (ctx, zF, zR, yLo, yHi) {
    const dm = K.decalMat(0x08090b, 0.6, 0.2);
    ctx.both(function (s) {
      [zF, zR].forEach(function (z) { ctx.st.add(K.sidePatch(ctx.body, s, z, z + 0.012, yLo, yHi, dm, { nu: 1, nv: 5, lift: 0.002 })); });
      ctx.st.add(K.sidePatch(ctx.body, s, zR, zF, yLo, yLo + 0.012, dm, { nu: 10, nv: 1, lift: 0.002 }));
      const hy = yHi - 0.09, hz = zR + 0.16;
      const h = K.hit(ctx.body, new V3(s * 4, hy, hz), new V3(-s, 0, 0));
      if (h) ctx.st.add(K.box(0.02, 0.028, 0.15, K.M.chrome, h.p.x + s * 0.008, hy, hz));
    });
  },
  round: function (ctx, end, x, y, r, mat, ring) {
    const h = K.hit(ctx.body, new V3(x, y, end * 6), new V3(0, 0, -end));
    if (!h) return;
    const g = new T.Group(); g.position.copy(h.p).addScaledVector(h.n, 0.01);
    g.lookAt(g.position.clone().add(h.n));
    const rg = new T.Mesh(new T.CylinderGeometry(r * 1.16, r * 1.16, 0.035, 20), ring || K.M.chrome); rg.rotation.x = Math.PI / 2;
    const ln = new T.Mesh(new T.CylinderGeometry(r, r, 0.04, 20), mat); ln.rotation.x = Math.PI / 2; ln.position.z = 0.012;
    g.add(rg); g.add(ln); ctx.st.add(g);
  },
  bumper: function (ctx, end, y, w, mat, h) {
    const hh = K.hit(ctx.body, new V3(0, y, end * 6), new V3(0, 0, -end));
    if (!hh) return;
    ctx.st.add(K.box(w, h || 0.09, 0.09, mat || K.M.chrome, 0, y, hh.p.z + end * 0.035));
  },
  mirror: function (ctx, z, y, mat) {
    ctx.both(function (s) {
      const h = K.hit(ctx.body, new V3(s * 4, y, z), new V3(-s, 0, 0));
      if (!h) return;
      const x = h.p.x + s * 0.02;
      ctx.st.add(K.tube(new V3(x - s * 0.02, y - 0.01, z), new V3(x + s * 0.08, y + 0.03, z + 0.01), 0.012, K.M.black, 6));
      const m = K.ell(0.045, 0.06, 0.09, mat || ctx.paint, x + s * 0.13, y + 0.06, z + 0.01, 10);
      m.scale.x = 0.7; ctx.st.add(m);
    });
  },
  // seats (two rows optional). y = seat base height
  seats: function (ctx, rows, y, x, o) {
    o = o || {};
    const trim = K.flat(o.color || 0x1b1d22, 0.65, 0.05);
    rows.forEach(function (z) {
      [-1, 1].forEach(function (s) {
        if (o.single && s > 0) return;
        const sx = o.single ? 0 : s * x;
        ctx.st.add(K.box(0.42, 0.13, 0.5, trim, sx, y, z));
        const back = K.box(0.42, 0.55, 0.12, trim, sx, y + 0.3, z - 0.24); back.rotation.x = -0.18; ctx.st.add(back);
        ctx.st.add(K.box(0.24, 0.16, 0.09, trim, sx, y + 0.66, z - 0.3));
      });
    });
  },
  dash: function (ctx, z, y, w) {
    ctx.st.add(K.box(w, 0.2, 0.32, K.flat(0x15171b, 0.6, 0.1), 0, y, z));
    const wheel = K.mesh(new T.TorusGeometry(0.17, 0.02, 8, 20), K.M.leather, 0, y + 0.13, z - 0.28);
    wheel.rotation.x = -1.05; ctx.st.add(wheel);
  }
};

/* ==================================================== 1. COMET S  (starter) */
// A light, quick hatchback. Two-tone roof, round headlights, little wing.
function cometExtras(ctx) {
  const P = K.parts, M = ctx.M;
  P.head(ctx, 0.34, 0.66, 0.6, 0.72);
  P.tail(ctx, 0.4, 0.78, 0.74, 0.86);
  P.reverse(ctx, 0.28, 0.4, 0.62, 0.7);
  P.grille(ctx, -0.3, 0.3, 0.44, 0.6, 2);
  ctx.st.add(K.endPatch(ctx.body, 1, -0.55, 0.55, 0.3, 0.42, K.decalMat(0x0a0a0c, 0.4, 0.5), { nu: 8, nv: 2, lift: 0.005 }));
  P.plate(ctx, 1, 0.5, 'COMET S'); P.plate(ctx, -1, 0.62, 'GD 1001');
  P.doors(ctx, 0.62, -0.2, 0.32, 0.93);
  P.mirror(ctx, 0.66, 1.0, ctx.spec.cabin.capMat);
  if (ctx.lod) {
    P.seats(ctx, [0.05, -0.65], 0.52, 0.28);
    P.dash(ctx, 0.62, 0.86, 1.2);
    // roof spoiler
    const sp = K.box(1.0, 0.03, 0.2, ctx.paint, 0, 1.2, -1.84); sp.rotation.x = 0.14; ctx.st.add(sp);
    ctx.both(function (s) { ctx.st.add(K.box(0.03, 0.08, 0.18, ctx.paint, s * 0.5, 1.16, -1.82)); });
    // exhaust
    ctx.st.add(K.exhaust(0.04, 0.16, 0.42, 0.28, -1.9, M.chrome));
    // stripe down the middle of the hood
    ctx.st.add(K.topPatch(ctx.body, -0.09, 0.09, 0.9, 1.75, K.decalMat(0xf4f4f0, 0.35, 0.3), { nu: 2, nv: 20, lift: 0.004 }));
    ctx.ud.flames.push(K.flame(0.045, 0.7, 0.42, 0.28, -1.95));
    ctx.root.add(ctx.ud.flames[0]);
    const f2 = K.flame(0.045, 0.7, -0.42, 0.28, -1.95); ctx.ud.flames.push(f2); ctx.root.add(f2);
  }
}
K.defs.push({
  id: 'comet', name: 'Comet S', type: 'car', cls: 'Hot hatch', price: 0, defaultPaint: 0xd8232a,
  blurb: 'Light, quick and easy to place. Everyone starts here.',
  phys: { maxSpeed: 42, accel: 16, brake: 38, turn: 1.9, R: 1.7, jump: 1, tough: 0.65 },
  sound: { kind: 'i4' }, cam: { back: 9, up: 4.3 },
  build: function (o) {
    return K.buildCar({
      finish: 'gloss', roll: 1.2,
      dims: { L: 3.85, W: 1.74, H: 1.42 },
      wheels: {
        front: { x: 0.73, z: 1.17, r: 0.31, w: 0.2, style: 'five', rim: 0.66 },
        rear:  { x: 0.73, z: -1.18, r: 0.31, w: 0.2, style: 'five', rim: 0.66 }
      },
      body: {
        base: 0.2, pt: 3.3, pb: 6, tw: 0.93,
        top: [[-1.92, 0.66], [-1.86, 0.84], [-1.6, 0.98], [-1.0, 1.0], [0.2, 0.98], [0.75, 0.97], [1.25, 0.88], [1.65, 0.8], [1.86, 0.68], [1.93, 0.52]],
        wid: [[-1.92, 0.5], [-1.86, 0.68], [-1.7, 0.8], [-1.18, 0.86], [-0.3, 0.84], [0.6, 0.84], [1.17, 0.87], [1.7, 0.81], [1.88, 0.66], [1.93, 0.5]]
      },
      cabin: {
        roof: [[-1.86, 0.98], [-1.7, 1.16], [-1.35, 1.36], [-0.9, 1.43], [0.0, 1.43], [0.42, 1.3], [0.82, 1.0]],
        wid: [[-1.86, 0.66], [-1.5, 0.74], [-0.5, 0.78], [0.42, 0.76], [0.82, 0.7]],
        tw: 0.72, pt: 2.7, capMat: K.paint(0xf1f1ec, 'gloss')
      },
      extras: cometExtras
    }, o);
  }
});
})();
