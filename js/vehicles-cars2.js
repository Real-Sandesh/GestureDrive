/* Gesture Drive - the rest of the car roster + civilian traffic */
(function () {
'use strict';
const T = THREE, K = window.GDKit, V3 = T.Vector3, P = K.parts;
const dm = function (hex, r, m) { return K.decalMat(hex, r, m); };

/* ===================================================== 2. BULLDOG 69 (muscle) */
K.defs.push({
  id: 'bulldog', name: 'Bulldog 69', type: 'car', cls: 'Muscle', price: 450, defaultPaint: 0x1b3f8f,
  blurb: 'Long hood, fat rear tyres and a V8 that shakes the mirrors. Fast in a straight line, heavy in the corners.',
  phys: { maxSpeed: 50, accel: 21, brake: 34, turn: 1.6, R: 1.8, jump: 0.9, tough: 0.8 },
  sound: { kind: 'v8' }, cam: { back: 9.6, up: 4.5 },
  build: function (o) {
    return K.buildCar({
      finish: 'gloss', roll: 1.6, pitch: 1.4, dims: { L: 4.9, W: 1.95, H: 1.47 },
      wheels: {
        front: { x: 0.8, z: 1.5, r: 0.35, w: 0.24, style: 'steel', rim: 0.6, rimMat: K.M.gun },
        rear:  { x: 0.83, z: -1.45, r: 0.37, w: 0.32, style: 'steel', rim: 0.58, rimMat: K.M.gun }
      },
      body: {
        base: 0.22, pt: 3.2, pb: 6, tw: 0.93, archGap: 0.06,
        top: [[-2.45, 0.72], [-2.4, 0.9], [-2.1, 1.03], [-1.3, 1.03], [-0.2, 1.0], [0.5, 0.98], [1.0, 0.99], [1.9, 0.97], [2.3, 0.88], [2.42, 0.72], [2.45, 0.58]],
        wid: [[-2.45, 0.6], [-2.38, 0.8], [-2.2, 0.93], [-1.45, 0.99], [0, 0.94], [1.5, 0.97], [2.2, 0.92], [2.4, 0.78], [2.45, 0.6]]
      },
      cabin: {
        roof: [[-1.95, 1.04], [-1.6, 1.2], [-1.0, 1.4], [-0.3, 1.47], [0.15, 1.45], [0.62, 1.0]],
        wid: [[-1.95, 0.7], [-1.0, 0.8], [0, 0.82], [0.62, 0.74]], tw: 0.72, pt: 2.7, capMat: K.M.carbon && K.paint(0x0f2a66, 'gloss')
      },
      extras: function (ctx) {
        const M = ctx.M;
        P.grille(ctx, -0.55, 0.55, 0.5, 0.72, 4);
        [-1, 1].forEach(function (s) { [0.7, 0.42].forEach(function (x) { P.round(ctx, 1, s * x, 0.76, 0.1, K.lamp(0xfff4dc, 0.9), M.chrome); }); });
        ctx.ud.lights.head.push(ctx.st.children[0] && K.lamp(0xfff4dc, 0.9));
        [0.3, 0.5, 0.7].forEach(function (x) { P.tail(ctx, x, x + 0.13, 0.74, 0.98, 0xff1a1a); });
        P.bumper(ctx, 1, 0.45, 1.36, M.chrome, 0.11); P.bumper(ctx, -1, 0.5, 1.6, M.chrome, 0.11);
        P.plate(ctx, 1, 0.34, 'BULLDOG'); P.plate(ctx, -1, 0.62, 'V8 GD69');
        P.doors(ctx, 0.5, -0.5, 0.34, 0.97);
        P.mirror(ctx, 0.62, 1.03, M.chrome);
        if (ctx.lod) {
          const st = dm(0xf6f6f2, 0.35, 0.3);
          [-0.24, 0.24].forEach(function (x) {
            ctx.st.add(K.topPatch(ctx.body, x - 0.07, x + 0.07, 0.7, 2.25, st, { nu: 2, nv: 24, lift: 0.004 }));
            ctx.st.add(K.topPatch(ctx.body, x - 0.07, x + 0.07, -2.4, -1.75, st, { nu: 2, nv: 12, lift: 0.004 }));
          });
          // hood scoop
          const sc = K.box(0.6, 0.09, 0.55, M.black, 0, 1.03, 1.35); sc.rotation.x = 0.12; ctx.st.add(sc);
          P.seats(ctx, [0.0, -0.75], 0.54, 0.3); P.dash(ctx, 0.5, 0.9, 1.3);
          ctx.both(function (s) { ctx.st.add(K.exhaust(0.06, 0.2, s * 0.6, 0.3, -2.42, M.chrome)); ctx.st.add(K.exhaust(0.06, 0.2, s * 0.35, 0.3, -2.42, M.chrome)); });
          [-0.6, 0.6].forEach(function (x) { const f = K.flame(0.06, 0.9, x, 0.3, -2.5); ctx.ud.flames.push(f); ctx.root.add(f); });
        }
      }
    }, o);
  }
});

/* ======================================================= 3. KAZE RX (tuner) */
K.defs.push({
  id: 'kaze', name: 'Kaze RX', type: 'car', cls: 'Tuner coupe', price: 950, defaultPaint: 0x12b5a5,
  blurb: 'A street-tuned coupe with a giant wing, gold wheels and neon underglow. It turns in like a go-kart.',
  phys: { maxSpeed: 54, accel: 20, brake: 40, turn: 2.2, R: 1.7, jump: 1, tough: 0.65 },
  sound: { kind: 'jdm' }, cam: { back: 9, up: 4.3 },
  build: function (o) {
    return K.buildCar({
      finish: 'pearl', roll: 1.3, glow: 0xc040ff, dims: { L: 4.3, W: 1.82, H: 1.36 },
      wheels: {
        front: { x: 0.76, z: 1.3, r: 0.33, w: 0.22, style: 'multi', rim: 0.68, rimMat: K.M.gold },
        rear:  { x: 0.78, z: -1.3, r: 0.33, w: 0.26, style: 'multi', rim: 0.68, rimMat: K.M.gold }
      },
      body: {
        base: 0.17, pt: 3.4, pb: 6, tw: 0.92, archGap: 0.04,
        top: [[-2.15, 0.68], [-2.1, 0.84], [-1.8, 0.98], [-1.0, 0.98], [0.2, 0.92], [0.7, 0.9], [1.3, 0.8], [1.8, 0.68], [2.1, 0.58], [2.15, 0.48]],
        wid: [[-2.15, 0.5], [-2.08, 0.7], [-1.9, 0.85], [-1.3, 0.92], [-0.3, 0.87], [0.6, 0.87], [1.3, 0.92], [1.9, 0.82], [2.1, 0.66], [2.15, 0.5]]
      },
      cabin: {
        roof: [[-1.55, 0.98], [-1.15, 1.2], [-0.6, 1.33], [0.0, 1.35], [0.5, 1.25], [0.98, 0.93]],
        wid: [[-1.55, 0.7], [-0.6, 0.76], [0.5, 0.74], [0.98, 0.7]], tw: 0.7, pt: 2.6, capMat: K.M.carbon
      },
      extras: function (ctx) {
        const M = ctx.M, carbon = M.carbon;
        P.head(ctx, 0.3, 0.78, 0.62, 0.68); P.head(ctx, 0.5, 0.74, 0.55, 0.6);
        P.tail(ctx, 0.35, 0.86, 0.76, 0.86); P.reverse(ctx, 0.2, 0.34, 0.62, 0.68);
        P.grille(ctx, -0.6, 0.6, 0.3, 0.5, 3);
        ctx.st.add(K.endPatch(ctx.body, 1, -0.2, 0.2, 0.55, 0.6, dm(0x0a0a0c, 0.4, 0.5), { nu: 6, nv: 1 }));
        P.plate(ctx, 1, 0.44, 'KAZE RX'); P.plate(ctx, -1, 0.6, 'SIDEWAYS');
        P.doors(ctx, 0.58, -0.12, 0.3, 0.9);
        P.mirror(ctx, 0.62, 0.98, carbon);
        if (ctx.lod) {
          // hood vents, carbon skirts, splitter, canards
          ctx.st.add(K.topPatch(ctx.body, -0.4, -0.1, 1.0, 1.5, K.M.black, { nu: 2, nv: 6, lift: 0.005 }));
          ctx.st.add(K.topPatch(ctx.body, 0.1, 0.4, 1.0, 1.5, K.M.black, { nu: 2, nv: 6, lift: 0.005 }));
          ctx.st.add(K.box(1.5, 0.04, 0.32, carbon, 0, 0.2, 2.13));
          ctx.both(function (s) {
            ctx.st.add(K.box(0.07, 0.11, 2.05, carbon, s * 0.93, 0.28, 0));
            const c = K.box(0.22, 0.03, 0.2, carbon, s * 0.86, 0.34, 2.02); c.rotation.z = s * 0.25; ctx.st.add(c);
          });
          // GT wing
          const w = K.wing(carbon, ctx.paint, 1.72, 0.32, 0.04, 0.34, 0.6, -0.14);
          w.position.set(0, 1.32, -1.98); ctx.st.add(w);
          P.seats(ctx, [0.0, -0.6], 0.5, 0.3); P.dash(ctx, 0.55, 0.84, 1.2);
          ctx.both(function (s) { ctx.st.add(K.exhaust(0.055, 0.2, s * 0.4, 0.27, -2.15, M.chrome)); });
          [-0.4, 0.4].forEach(function (x) { const f = K.flame(0.05, 1.0, x, 0.27, -2.25, 0xffa040); ctx.ud.flames.push(f); ctx.root.add(f); });
        }
      }
    }, o);
  }
});

/* ==================================================== 4. RIDGEBACK 4x4 (truck) */
K.defs.push({
  id: 'ridgeback', name: 'Ridgeback', type: 'car', cls: 'Pickup 4x4', price: 1300, defaultPaint: 0xd9721f,
  blurb: 'A lifted off-road pickup with a roll bar, light bar and huge knobby tyres. Shrugs off crashes better than anything else.',
  phys: { maxSpeed: 47, accel: 15.5, brake: 34, turn: 1.55, R: 1.95, jump: 1.1, tough: 0.95 },
  sound: { kind: 'diesel' }, cam: { back: 10.3, up: 4.9 },
  build: function (o) {
    return K.buildCar({
      finish: 'gloss', roll: 1.7, pitch: 1.5, dims: { L: 5.1, W: 2.0, H: 1.85 },
      wheels: {
        front: { x: 0.88, z: 1.6, r: 0.45, w: 0.32, style: 'five', rim: 0.52, rimMat: K.M.gun, tread: 'knobby' },
        rear:  { x: 0.88, z: -1.5, r: 0.45, w: 0.32, style: 'five', rim: 0.52, rimMat: K.M.gun, tread: 'knobby' }
      },
      body: {
        base: 0.46, pt: 3.1, pb: 6, tw: 0.95, archGap: 0.08,
        top: [[-2.55, 1.0], [-2.5, 1.12], [-2.3, 1.14], [-0.9, 1.14], [-0.6, 1.1], [0.4, 1.06], [0.9, 1.14], [1.6, 1.16], [2.3, 1.08], [2.5, 0.94], [2.55, 0.78]],
        wid: [[-2.55, 0.7], [-2.5, 0.92], [-2.3, 1.0], [-1.5, 1.0], [0, 0.97], [1.6, 1.0], [2.3, 0.97], [2.5, 0.85], [2.55, 0.7]]
      },
      cabin: {
        roof: [[-0.62, 1.1], [-0.5, 1.5], [-0.3, 1.78], [0.4, 1.84], [0.85, 1.74], [1.12, 1.16]],
        wid: [[-0.62, 0.8], [0, 0.87], [0.85, 0.86], [1.12, 0.8]], tw: 0.78, pt: 2.6, sink: 0.2, capMat: K.paint(0x2a2d33, 'matte')
      },
      extras: function (ctx) {
        const M = ctx.M;
        P.grille(ctx, -0.6, 0.6, 0.62, 0.98, 5);
        ctx.both(function (s) { ctx.st.add(K.endPatch(ctx.body, 1, s > 0 ? 0.68 : -0.92, s > 0 ? 0.92 : -0.68, 0.78, 0.96, K.lamp(0xfff4dc, 0.9), { nu: 3, nv: 2, lift: 0.008 })); });
        ctx.ud.lights.head.push(K.lamp(0xfff4dc, 0.9));
        P.tail(ctx, 0.62, 0.92, 0.92, 1.1); P.plate(ctx, -1, 0.82, 'RIDGE 4X4');
        P.doors(ctx, 0.55, -0.1, 0.5, 1.08);
        P.mirror(ctx, 0.9, 1.35, M.black);
        if (ctx.lod) {
          // bull bar
          const bx = K.hit(ctx.body, new V3(0, 0.7, 6), new V3(0, 0, -1)); const bz = bx ? bx.p.z + 0.12 : 2.6;
          [-0.55, 0.55].forEach(function (x) { ctx.st.add(K.tube(new V3(x, 0.5, bz), new V3(x, 1.12, bz - 0.05), 0.04, M.chrome, 8)); });
          ctx.st.add(K.tube(new V3(-0.55, 1.12, bz - 0.05), new V3(0.55, 1.12, bz - 0.05), 0.04, M.chrome, 8));
          ctx.st.add(K.tube(new V3(-0.55, 0.55, bz), new V3(0.55, 0.55, bz), 0.04, M.chrome, 8));
          // bed liner, roll bar, light bars
          ctx.st.add(K.box(1.6, 0.03, 1.5, M.rubber, 0, 1.135, -1.6));
          ctx.st.add(K.box(1.72, 0.09, 0.05, ctx.paint, 0, 1.19, -2.42));
          [-0.75, 0.75].forEach(function (x) { ctx.st.add(K.tube(new V3(x, 1.12, -0.85), new V3(x, 1.78, -0.9), 0.04, M.black, 8)); });
          ctx.st.add(K.tube(new V3(-0.75, 1.78, -0.9), new V3(0.75, 1.78, -0.9), 0.04, M.black, 8));
          const bar = K.lamp(0xffffff, 1.4); ctx.ud.lights.head.push(bar);
          ctx.st.add(K.box(1.3, 0.09, 0.09, bar, 0, 1.9, 0.55));
          ctx.st.add(K.box(1.0, 0.07, 0.07, K.lamp(0xff7020, 0.9), 0, 1.86, -0.86));
          P.seats(ctx, [0.35, -0.2], 1.0, 0.3); P.dash(ctx, 0.8, 1.3, 1.3);
          ctx.both(function (s) { ctx.st.add(K.exhaust(0.05, 0.25, s * 0.85, 0.5, -2.5, M.chrome)); });
          const fl = K.flame(0.06, 0.9, 0.85, 0.5, -2.6, 0xffb050); ctx.ud.flames.push(fl); ctx.root.add(fl);
        }
      }
    }, o);
  }
});

/* ======================================================== 5. VOLT AERO (EV) */
K.defs.push({
  id: 'volt', name: 'Volt Aero', type: 'car', cls: 'Electric GT', price: 1900, defaultPaint: 0xeef1f5,
  blurb: 'Silent, smooth and instantly quick. Glass roof, full-width light bars and glowing blue sills.',
  phys: { maxSpeed: 58, accel: 26, brake: 40, turn: 1.95, R: 1.75, jump: 1, tough: 0.65 },
  sound: { kind: 'ev' }, cam: { back: 9.2, up: 4.3 },
  build: function (o) {
    return K.buildCar({
      finish: 'pearl', roll: 1.0, glow: 0x30c8ff, dims: { L: 4.7, W: 1.9, H: 1.42 },
      wheels: {
        front: { x: 0.8, z: 1.42, r: 0.34, w: 0.23, style: 'disc', rim: 0.7, rimMat: K.M.gun },
        rear:  { x: 0.8, z: -1.4, r: 0.34, w: 0.23, style: 'disc', rim: 0.7, rimMat: K.M.gun }
      },
      body: {
        base: 0.18, pt: 3.0, pb: 6, tw: 0.92, archGap: 0.04,
        top: [[-2.35, 0.72], [-2.3, 0.88], [-2.0, 0.99], [-1.2, 1.02], [-0.3, 0.98], [0.5, 0.92], [1.2, 0.84], [1.9, 0.74], [2.25, 0.64], [2.35, 0.5]],
        wid: [[-2.35, 0.5], [-2.3, 0.7], [-2.0, 0.85], [-1.4, 0.93], [-0.3, 0.91], [0.8, 0.91], [1.4, 0.93], [2.0, 0.83], [2.3, 0.68], [2.35, 0.5]]
      },
      cabin: {
        roof: [[-1.95, 0.99], [-1.5, 1.2], [-0.8, 1.36], [0.0, 1.41], [0.6, 1.3], [1.08, 0.9]],
        wid: [[-1.95, 0.68], [-0.8, 0.8], [0.6, 0.78], [1.08, 0.7]], tw: 0.7, pt: 2.5, cap: false
      },
      extras: function (ctx) {
        const M = ctx.M, cy = K.lamp(0xbfeaff, 1.1);
        ctx.ud.lights.head.push(cy);
        ctx.st.add(K.endPatch(ctx.body, 1, -0.78, 0.78, 0.66, 0.7, cy, { nu: 14, nv: 1, lift: 0.006 }));
        ctx.both(function (s) { ctx.st.add(K.endPatch(ctx.body, 1, s > 0 ? 0.3 : -0.8, s > 0 ? 0.8 : -0.3, 0.6, 0.64, dm(0x0a0a0c, 0.3, 0.6), { nu: 6, nv: 1, lift: 0.004 })); });
        const rd = K.lamp(0xff1a1a, 0.6); ctx.ud.lights.tail.push(rd);
        ctx.st.add(K.endPatch(ctx.body, -1, -0.82, 0.82, 0.84, 0.9, rd, { nu: 14, nv: 1, lift: 0.006 }));
        P.reverse(ctx, 0.5, 0.7, 0.7, 0.74);
        P.plate(ctx, 1, 0.42, 'VOLT AERO'); P.plate(ctx, -1, 0.7, 'ZERO 0');
        P.doors(ctx, 0.62, -0.25, 0.3, 0.96);
        P.mirror(ctx, 0.68, 0.98, ctx.paint);
        if (ctx.lod) {
          const acc = K.lamp(0x35d0ff, 1.4); ctx.ud.lights.head.push(acc);
          ctx.both(function (s) { ctx.st.add(K.sidePatch(ctx.body, s, -1.9, 1.9, 0.33, 0.345, acc, { nu: 30, nv: 1, lift: 0.006 })); });
          ctx.st.add(K.box(1.5, 0.04, 0.2, M.carbon, 0, 0.3, -2.3));     // diffuser
          P.seats(ctx, [0.05, -0.75], 0.54, 0.3, { color: 0xd9dde3 }); P.dash(ctx, 0.62, 0.88, 1.3);
        }
      }
    }, o);
  }
});

/* ==================================================== 6. ZEPHYR (roadster) */
K.defs.push({
  id: 'zephyr', name: 'Zephyr', type: 'car', cls: 'Roadster', price: 2600, defaultPaint: 0x0f7a55,
  blurb: 'Open-top sports car with chrome wheels and leather seats. Wind in your hair at 220 km/h.',
  phys: { maxSpeed: 60, accel: 21, brake: 40, turn: 2.1, R: 1.7, jump: 1, tough: 0.6 },
  sound: { kind: 'v6' }, cam: { back: 9, up: 4.2 },
  build: function (o) {
    return K.buildCar({
      finish: 'gloss', roll: 1.4, dims: { L: 4.2, W: 1.8, H: 1.2 },
      wheels: {
        front: { x: 0.76, z: 1.3, r: 0.33, w: 0.22, style: 'multi', rim: 0.7, rimMat: K.M.chrome },
        rear:  { x: 0.78, z: -1.28, r: 0.33, w: 0.25, style: 'multi', rim: 0.7, rimMat: K.M.chrome }
      },
      body: {
        base: 0.19, pt: 3.0, pb: 6, tw: 0.9,
        top: [[-2.1, 0.6], [-2.05, 0.8], [-1.8, 0.95], [-1.0, 0.98], [0.3, 0.92], [0.75, 0.92], [1.3, 0.85], [1.8, 0.73], [2.05, 0.6], [2.1, 0.46]],
        wid: [[-2.1, 0.5], [-2.02, 0.7], [-1.8, 0.84], [-1.28, 0.9], [-0.3, 0.85], [0.6, 0.85], [1.3, 0.9], [1.85, 0.8], [2.05, 0.64], [2.1, 0.5]]
      },
      cabin: null,
      extras: function (ctx) {
        const M = ctx.M, leather = K.flat(0xb4763b, 0.55, 0.05);
        P.round(ctx, 1, 0.55, 0.72, 0.13, K.lamp(0xfff4dc, 0.9), M.chrome); P.round(ctx, 1, -0.55, 0.72, 0.13, K.lamp(0xfff4dc, 0.9), M.chrome);
        ctx.ud.lights.head.push(K.lamp(0xfff4dc, 0.9));
        P.grille(ctx, -0.3, 0.3, 0.5, 0.68, 4);
        const tl = K.lamp(0xff1a1a, 0.55); ctx.ud.lights.tail.push(tl);
        [-1, 1].forEach(function (s) { P.round(ctx, -1, s * 0.6, 0.75, 0.1, tl, M.chrome); });
        P.plate(ctx, 1, 0.42, 'ZEPHYR'); P.plate(ctx, -1, 0.6, 'OPEN AIR');
        P.doors(ctx, 0.55, -0.25, 0.3, 0.88);
        if (ctx.lod) {
          ctx.st.add(K.box(1.32, 0.03, 1.55, K.flat(0x17181b, 0.7, 0.05), 0, 0.965, -0.2));   // cockpit tub
          P.seats(ctx, [0.0], 0.63, 0.32, { color: 0xb4763b }); P.dash(ctx, 0.62, 0.9, 1.3);
          // windscreen + frame
          const ws = K.box(1.36, 0.36, 0.03, M.glass, 0, 1.13, 0.68); ws.rotation.x = -0.95; ws.renderOrder = 2; ctx.st.add(ws);
          ctx.both(function (s) { ctx.st.add(K.tube(new V3(s * 0.68, 0.95, 0.56), new V3(s * 0.68, 1.3, 0.8), 0.018, M.chrome, 6)); });
          ctx.st.add(K.tube(new V3(-0.68, 1.3, 0.8), new V3(0.68, 1.3, 0.8), 0.018, M.chrome, 6));
          // rear humps + roll hoops
          [-0.36, 0.36].forEach(function (x) { const h = K.ell(0.26, 0.15, 0.85, ctx.paint, x, 1.0, -1.3, 14); ctx.st.add(h); ctx.st.add(K.tube(new V3(x, 0.95, -0.7), new V3(x, 1.18, -0.86), 0.03, M.chrome, 6)); });
          ctx.st.add(K.tube(new V3(-0.36, 1.18, -0.86), new V3(0.36, 1.18, -0.86), 0.03, M.chrome, 6));
          ctx.both(function (s) { ctx.st.add(K.exhaust(0.05, 0.2, s * 0.35, 0.26, -2.08, M.chrome)); });
          [-0.35, 0.35].forEach(function (x) { const f = K.flame(0.05, 0.9, x, 0.26, -2.2); ctx.ud.flames.push(f); ctx.root.add(f); });
        }
      }
    }, o);
  }
});

/* ====================================================== 7. VANTA S1 (supercar) */
K.defs.push({
  id: 'vanta', name: 'Vanta S1', type: 'car', cls: 'Supercar', price: 4200, defaultPaint: 0xffc21a,
  blurb: 'Mid-engine wedge with side intakes, a glass engine cover and a howling V10. Tops out at 245 km/h.',
  phys: { maxSpeed: 68, accel: 26, brake: 46, turn: 2.05, R: 1.75, jump: 0.95, tough: 0.55 },
  sound: { kind: 'v10' }, cam: { back: 9, up: 4.1 },
  build: function (o) {
    return K.buildCar({
      finish: 'gloss', roll: 0.9, dims: { L: 4.5, W: 1.95, H: 1.13 },
      wheels: {
        front: { x: 0.84, z: 1.4, r: 0.35, w: 0.24, style: 'turbine', rim: 0.68, rimMat: K.M.gun },
        rear:  { x: 0.86, z: -1.35, r: 0.36, w: 0.32, style: 'turbine', rim: 0.66, rimMat: K.M.gun }
      },
      body: {
        base: 0.15, pt: 3.5, pb: 6, tw: 0.9, archGap: 0.035,
        top: [[-2.25, 0.62], [-2.2, 0.76], [-1.9, 0.88], [-1.3, 0.93], [-0.8, 0.9], [-0.2, 0.82], [0.4, 0.7], [1.2, 0.6], [2.0, 0.52], [2.2, 0.46], [2.25, 0.4]],
        wid: [[-2.25, 0.55], [-2.2, 0.74], [-1.9, 0.9], [-1.35, 0.97], [-0.5, 0.94], [0.4, 0.9], [1.4, 0.94], [2.0, 0.83], [2.2, 0.62], [2.25, 0.42]]
      },
      cabin: {
        roof: [[-0.95, 0.9], [-0.55, 1.05], [-0.05, 1.13], [0.5, 1.04], [0.95, 0.7]],
        wid: [[-0.95, 0.68], [-0.05, 0.76], [0.95, 0.66]], tw: 0.68, pt: 2.5, sink: 0.12, capMat: K.M.carbon
      },
      extras: function (ctx) {
        const M = ctx.M, carbon = M.carbon;
        P.head(ctx, 0.35, 0.85, 0.5, 0.55); P.head(ctx, 0.6, 0.8, 0.44, 0.49);
        const bl = K.lamp(0xff1a1a, 0.6); ctx.ud.lights.tail.push(bl);
        ctx.st.add(K.endPatch(ctx.body, -1, -0.85, 0.85, 0.78, 0.83, bl, { nu: 14, nv: 1, lift: 0.006 }));
        P.tail(ctx, 0.3, 0.55, 0.62, 0.72);
        P.grille(ctx, -0.7, 0.7, 0.28, 0.42, 0);
        P.plate(ctx, 1, 0.38, 'VANTA S1'); P.plate(ctx, -1, 0.5, 'V10 GD');
        P.doors(ctx, 0.5, -0.4, 0.28, 0.8);
        P.mirror(ctx, 0.55, 0.85, carbon);
        if (ctx.lod) {
          ctx.both(function (s) { ctx.st.add(K.sidePatch(ctx.body, s, -1.25, -0.35, 0.3, 0.68, dm(0x08090b, 0.5, 0.3), { nu: 8, nv: 4, lift: 0.004 })); });
          ctx.st.add(K.topPatch(ctx.body, -0.55, 0.55, -1.95, -1.0, dm(0x0c0d10, 0.15, 0.7), { nu: 4, nv: 14, lift: 0.005 }));
          for (let i = 0; i < 7; i++) ctx.st.add(K.topPatch(ctx.body, -0.55, 0.55, -1.9 + i * 0.13, -1.86 + i * 0.13, carbon, { nu: 4, nv: 1, lift: 0.012 }));
          ctx.st.add(K.box(1.6, 0.035, 0.34, carbon, 0, 0.13, 2.22));
          ctx.st.add(K.box(1.45, 0.045, 0.3, carbon, 0, 0.2, -2.25));
          for (let i = -3; i <= 3; i++) ctx.st.add(K.box(0.02, 0.14, 0.3, carbon, i * 0.2, 0.24, -2.24));
          const w = K.wing(carbon, ctx.paint, 1.7, 0.3, 0.035, 0.3, 0.55, -0.16); w.position.set(0, 1.08, -2.05); ctx.st.add(w);
          ctx.st.add(K.exhaust(0.07, 0.2, -0.22, 0.32, -2.27, M.chrome)); ctx.st.add(K.exhaust(0.07, 0.2, 0.22, 0.32, -2.27, M.chrome));
          ctx.st.add(K.exhaust(0.05, 0.2, -0.42, 0.28, -2.27, M.chrome)); ctx.st.add(K.exhaust(0.05, 0.2, 0.42, 0.28, -2.27, M.chrome));
          P.seats(ctx, [0.0], 0.44, 0.3, { color: 0x15161a }); P.dash(ctx, 0.5, 0.72, 1.2);
          [-0.22, 0.22].forEach(function (x) { const f = K.flame(0.07, 1.2, x, 0.32, -2.4); ctx.ud.flames.push(f); ctx.root.add(f); });
        }
      }
    }, o);
  }
});

/* ==================================================== 8. SPECTRE X (hypercar) */
K.defs.push({
  id: 'spectre', name: 'Spectre X', type: 'car', cls: 'Hypercar', price: 8000, defaultPaint: 0x22262c,
  blurb: 'The fastest thing on four wheels: carbon everything, a swan-neck wing and red LED edges. 295 km/h.',
  phys: { maxSpeed: 82, accel: 32, brake: 52, turn: 1.95, R: 1.8, jump: 0.9, tough: 0.5 },
  sound: { kind: 'v12' }, cam: { back: 9.6, up: 4.1 },
  build: function (o) {
    return K.buildCar({
      finish: 'pearl', roll: 0.8, dims: { L: 4.7, W: 2.05, H: 1.08 },
      wheels: {
        front: { x: 0.9, z: 1.45, r: 0.36, w: 0.27, style: 'cast5', rim: 0.7, rimMat: K.M.gun, trimMat: K.M.gold },
        rear:  { x: 0.92, z: -1.4, r: 0.37, w: 0.36, style: 'cast5', rim: 0.68, rimMat: K.M.gun, trimMat: K.M.gold }
      },
      body: {
        base: 0.13, pt: 3.6, pb: 6, tw: 0.88, archGap: 0.03,
        top: [[-2.35, 0.58], [-2.3, 0.72], [-1.9, 0.84], [-1.2, 0.88], [-0.5, 0.82], [0.2, 0.72], [1.0, 0.6], [1.9, 0.5], [2.25, 0.42], [2.35, 0.34]],
        wid: [[-2.35, 0.5], [-2.3, 0.75], [-1.9, 0.94], [-1.4, 1.0], [-0.4, 0.96], [0.5, 0.92], [1.45, 0.98], [2.0, 0.86], [2.3, 0.6], [2.35, 0.4]]
      },
      cabin: {
        roof: [[-0.65, 0.82], [-0.25, 0.98], [0.15, 1.06], [0.6, 0.96], [1.0, 0.62]],
        wid: [[-0.65, 0.66], [0.15, 0.72], [1.0, 0.62]], tw: 0.66, pt: 2.5, sink: 0.12, capMat: K.M.carbon
      },
      extras: function (ctx) {
        const M = ctx.M, carbon = M.carbon, red = K.lamp(0xff2020, 1.6);
        P.head(ctx, 0.4, 0.9, 0.5, 0.54, 0xdff2ff);
        ctx.both(function (s) { ctx.st.add(K.sidePatch(ctx.body, s, -2.0, 2.0, 0.3, 0.315, red, { nu: 34, nv: 1, lift: 0.006 })); });
        const bl = K.lamp(0xff1a1a, 0.6); ctx.ud.lights.tail.push(bl);
        [0.3, 0.68].forEach(function (x) { ctx.st.add(K.endPatch(ctx.body, -1, x, x + 0.12, 0.6, 0.82, bl, { nu: 2, nv: 4, lift: 0.006 })); ctx.st.add(K.endPatch(ctx.body, -1, -x - 0.12, -x, 0.6, 0.82, bl, { nu: 2, nv: 4, lift: 0.006 })); });
        P.grille(ctx, -0.8, 0.8, 0.2, 0.32, 0);
        P.plate(ctx, 1, 0.34, 'SPECTRE X'); P.plate(ctx, -1, 0.5, 'GD-HYPER');
        P.doors(ctx, 0.5, -0.5, 0.26, 0.74);
        P.mirror(ctx, 0.55, 0.8, carbon);
        if (ctx.lod) {
          ctx.st.add(K.box(1.7, 0.035, 0.4, carbon, 0, 0.11, 2.3));
          ctx.both(function (s) { const c = K.box(0.3, 0.03, 0.22, carbon, s * 0.98, 0.26, 2.2); c.rotation.z = s * 0.3; ctx.st.add(c); });
          ctx.st.add(K.topPatch(ctx.body, -0.6, -0.15, 1.0, 1.7, carbon, { nu: 3, nv: 8, lift: 0.006 }));
          ctx.st.add(K.topPatch(ctx.body, 0.15, 0.6, 1.0, 1.7, carbon, { nu: 3, nv: 8, lift: 0.006 }));
          ctx.st.add(K.topPatch(ctx.body, -0.5, 0.5, -1.9, -1.0, dm(0x0c0d10, 0.15, 0.7), { nu: 4, nv: 12, lift: 0.005 }));
          // swan-neck wing
          const w = K.wing(carbon, red, 2.0, 0.34, 0.04, 0.0, 0.7, -0.14); w.position.set(0, 1.16, -2.15); ctx.st.add(w);
          [-0.7, 0.7].forEach(function (x) { ctx.st.add(K.tube(new V3(x, 0.8, -1.95), new V3(x, 1.14, -2.15), 0.03, carbon, 8)); });
          ctx.st.add(K.box(1.6, 0.05, 0.34, carbon, 0, 0.19, -2.33));
          for (let i = -4; i <= 4; i++) ctx.st.add(K.box(0.02, 0.15, 0.34, carbon, i * 0.18, 0.23, -2.32));
          ctx.st.add(K.exhaust(0.08, 0.2, -0.16, 0.3, -2.36, M.chrome)); ctx.st.add(K.exhaust(0.08, 0.2, 0.16, 0.3, -2.36, M.chrome));
          P.seats(ctx, [0.0], 0.42, 0.3, { color: 0x121316 }); P.dash(ctx, 0.5, 0.7, 1.2);
          [-0.16, 0.16].forEach(function (x) { const f = K.flame(0.08, 1.5, x, 0.3, -2.48, 0x8fd0ff); ctx.ud.flames.push(f); ctx.root.add(f); });
        }
      }
    }, o);
  }
});

/* =========================================================== civilian traffic */
const TSPEC = {
  sedan: {
    dims: { L: 4.4, W: 1.75, H: 1.4 }, wheels: { front: { x: 0.74, z: 1.35, r: 0.32, w: 0.2, style: 'disc', rim: 0.66 }, rear: { x: 0.74, z: -1.3, r: 0.32, w: 0.2, style: 'disc', rim: 0.66 } },
    body: { base: 0.2, top: [[-2.2, 0.68], [-2.15, 0.86], [-1.8, 0.98], [-1.0, 1.0], [0.3, 0.96], [0.9, 0.95], [1.5, 0.86], [2.1, 0.74], [2.2, 0.55]], wid: [[-2.2, 0.55], [-2.1, 0.78], [-1.4, 0.86], [0, 0.86], [1.4, 0.87], [2.1, 0.78], [2.2, 0.55]] },
    cabin: { roof: [[-1.25, 1.0], [-0.95, 1.25], [-0.3, 1.4], [0.35, 1.38], [0.75, 1.25], [1.05, 0.96]], wid: [[-1.25, 0.7], [-0.3, 0.76], [0.75, 0.72], [1.05, 0.7]], tw: 0.72, pt: 2.7, cap: false }
  },
  hatch: {
    dims: { L: 3.9, W: 1.72, H: 1.45 }, wheels: { front: { x: 0.72, z: 1.2, r: 0.3, w: 0.19, style: 'disc', rim: 0.66 }, rear: { x: 0.72, z: -1.2, r: 0.3, w: 0.19, style: 'disc', rim: 0.66 } },
    body: { base: 0.2, top: [[-1.95, 0.7], [-1.9, 0.88], [-1.6, 0.98], [0.2, 0.98], [0.8, 0.96], [1.3, 0.86], [1.9, 0.72], [1.95, 0.55]], wid: [[-1.95, 0.55], [-1.85, 0.75], [-1.2, 0.85], [1.2, 0.86], [1.85, 0.76], [1.95, 0.55]] },
    cabin: { roof: [[-1.85, 1.0], [-1.6, 1.3], [-0.9, 1.45], [0.2, 1.44], [0.55, 1.3], [0.85, 0.98]], wid: [[-1.85, 0.68], [-0.5, 0.78], [0.85, 0.7]], tw: 0.74, pt: 2.7, cap: false }
  },
  suv: {
    dims: { L: 4.6, W: 1.9, H: 1.75 }, wheels: { front: { x: 0.82, z: 1.42, r: 0.38, w: 0.25, style: 'five', rim: 0.6 }, rear: { x: 0.82, z: -1.4, r: 0.38, w: 0.25, style: 'five', rim: 0.6 } },
    body: { base: 0.3, top: [[-2.3, 0.85], [-2.25, 1.08], [-1.9, 1.16], [0.3, 1.14], [0.9, 1.12], [1.6, 1.02], [2.2, 0.88], [2.3, 0.7]], wid: [[-2.3, 0.65], [-2.2, 0.86], [-1.5, 0.94], [1.5, 0.95], [2.2, 0.86], [2.3, 0.65]] },
    cabin: { roof: [[-2.05, 1.16], [-1.95, 1.62], [-1.5, 1.74], [0.2, 1.74], [0.7, 1.62], [1.05, 1.14]], wid: [[-2.05, 0.8], [-1.5, 0.86], [0.7, 0.82], [1.05, 0.76]], tw: 0.8, pt: 2.6, cap: false }
  },
  van: {
    dims: { L: 4.9, W: 1.95, H: 2.1 }, wheels: { front: { x: 0.84, z: 1.6, r: 0.36, w: 0.22, style: 'disc', rim: 0.62 }, rear: { x: 0.84, z: -1.5, r: 0.36, w: 0.22, style: 'disc', rim: 0.62 } },
    body: { base: 0.28, top: [[-2.45, 1.2], [-2.4, 1.6], [-2.2, 1.85], [-0.3, 1.9], [0.6, 1.6], [1.2, 1.15], [2.3, 0.95], [2.45, 0.7]], wid: [[-2.45, 0.7], [-2.35, 0.94], [-1.5, 0.97], [1.5, 0.97], [2.3, 0.9], [2.45, 0.7]], pt: 3.6, tw: 0.97 },
    cabin: { roof: [[0.55, 1.6], [0.8, 1.86], [1.1, 1.9], [1.5, 1.3], [1.8, 1.02]], wid: [[0.55, 0.85], [1.1, 0.87], [1.8, 0.8]], tw: 0.85, pt: 2.6, cap: false }
  }
};
K.trafficLamps = { head: [], tail: [] };
const _tplCache = {}, _paintCache = {};
const PLACE = function () { return K.trafficPlace || (K.trafficPlace = K.paint(0xff00ff, 'gloss')); };
K.trafficKinds = Object.keys(TSPEC);
K.makeTraffic = function (kind, hex) {
  if (!_tplCache[kind]) {
    const sp = Object.assign({ finish: 'gloss', extras: function (ctx) {
      P.head(ctx, 0.3, 0.7, 0.6, 0.7); P.tail(ctx, 0.35, 0.75, 0.75, 0.85);
      ctx.ud.lights.head.forEach(function (l) { K.trafficLamps.head.push(l); });
      ctx.ud.lights.tail.forEach(function (l) { K.trafficLamps.tail.push(l); });
    } }, TSPEC[kind]);
    _tplCache[kind] = K.buildCar(sp, { lod: 0, paintMat: PLACE() });
  }
  const g = _tplCache[kind].clone(true);
  if (!_paintCache[hex]) { _paintCache[hex] = K.paint(hex, 'gloss'); _paintCache[hex].userData.shared = true; }
  const pm = _paintCache[hex], spins = [];
  g.traverse(function (o) {
    if (o.isMesh && o.material === PLACE()) o.material = pm;
    if (o.name === 'spin') spins.push(o);
  });
  g.userData.spins = spins; g.userData.kind = kind;
  return g;
};
K.disposeTraffic = function () {
  Object.keys(_tplCache).forEach(function (k) { K.dispose(_tplCache[k]); delete _tplCache[k]; });
  Object.keys(_paintCache).forEach(function (k) { _paintCache[k].dispose(); delete _paintCache[k]; });
  K.trafficPlace = null; K.trafficLamps.head.length = 0; K.trafficLamps.tail.length = 0;
};
})();
