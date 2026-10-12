/* ============================================================================
   Gesture Drive - main game
   ========================================================================== */
(function () {
'use strict';
const K = window.GDKit;
const C = K.C;

/* ---------------------------------------------------------------- settings */
const SETTINGS = { maxSpeed: 42, acceleration: 16, brakePower: 38, turnSpeed: 1.9, steerDeadzoneDeg: 5, steerFullDeg: 38,
  fingerRatio: 1.6, trafficCars: 9, dayLengthSeconds: 260, gravity: 22, jumpPower: 8 };
const BASE_SETTINGS = { steerFullDeg: SETTINGS.steerFullDeg, turnSpeed: SETTINGS.turnSpeed, fingerRatio: SETTINGS.fingerRatio };

const PREFS_KEY = 'gesturedrive_prefs_v1', SAVE_KEY = 'gesturedrive_save_v1';
const prefs = { volume: 80, muted: false, steerSensitivity: 100, gestureSensitivity: 100, autoAccel: false, showCam: true, quality: 'auto', showFps: false, mapZoom: 1 };
const DEFAULT_PREFS = Object.assign({}, prefs);
// Everything you earn or buy lives in this save object (localStorage).
const save = { coins: 0, owned: ['comet'], selected: 'comet', paints: {}, bestSpeed: 0 };

const $ = function (id) { return document.getElementById(id); };
const clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
const lerp = function (a, b, t) { return a + (b - a) * t; };
const state = { playing: false, paused: false, garage: false, garageFromPause: false, photo: false };
const keys = {};

function loadPrefs() {
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch (e) {}
  if (['auto', 'low', 'medium', 'high'].indexOf(prefs.quality) < 0) prefs.quality = 'auto';
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s) {
      save.coins = Math.max(0, Math.floor(+s.coins || 0));
      save.owned = Array.isArray(s.owned) && s.owned.length ? s.owned : ['comet'];
      if (save.owned.indexOf('comet') < 0) save.owned.push('comet');
      save.selected = s.selected || 'comet';
      save.paints = s.paints || {};
      save.bestSpeed = +s.bestSpeed || 0;
    }
  } catch (e) {}
}
let prefsTimer = 0;
function writePrefs() {
  prefsTimer = 0;
  try {
    prefs.volume = Math.round(audio.muted ? prefs.volume : audio.volume * 100);
    prefs.muted = audio.muted;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch (e) {}
}
function savePrefs() { if (prefsTimer) clearTimeout(prefsTimer); prefsTimer = setTimeout(writePrefs, 400); }
function flushPrefs() { if (prefsTimer) { clearTimeout(prefsTimer); writePrefs(); } }
function applySteerSensitivity(pct) { prefs.steerSensitivity = pct; SETTINGS.steerFullDeg = clamp(BASE_SETTINGS.steerFullDeg / (pct / 100), 12, 80); SETTINGS.turnSpeed = BASE_SETTINGS.turnSpeed * pct / 100; savePrefs(); }
function applyGestureSensitivity(pct) { prefs.gestureSensitivity = pct; SETTINGS.fingerRatio = clamp(BASE_SETTINGS.fingerRatio / (pct / 100), 1.05, 3); savePrefs(); }

const MEDIAPIPE_VERSION = '0.10.21';
const MEDIAPIPE_JS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MEDIAPIPE_VERSION + '/vision_bundle.mjs';
const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + MEDIAPIPE_VERSION + '/wasm';
const HAND_MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task';

const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && window.matchMedia && matchMedia('(pointer: coarse)').matches);
loadPrefs();

/* ----------------------------------------------------------------- quality */
const QUALITY = {
  low: { pixelRatioCap: 1, antialias: false, view: 1, fogNear: 55, fogFar: 200, trafficCars: 5, treeMult: 0.5, simpleBuildings: true, simpleRamps: true, spotlight: false,
    shadow: 0, clouds: false, phys: false, lamps: false, particles: 40, mapDetail: 0, bloom: false,
    frameIntervalMs: isMobile ? 1000 / 30 : 1000 / 60, minimapIntervalMs: 100, hudIntervalMs: 50, skyIntervalMs: 100, gestureIntervalMs: 70, camWidth: 320, camHeight: 240, camFPS: 15, lowfx: true },
  medium: { pixelRatioCap: 1.5, antialias: false, view: 1, fogNear: 70, fogFar: 230, trafficCars: 7, treeMult: 0.8, simpleBuildings: false, simpleRamps: true, spotlight: true,
    shadow: 1024, clouds: true, phys: true, lamps: true, particles: 90, mapDetail: 1, bloom: { threshold: 0.8, strength: 0.5, scale: 0.4, passes: 1 },
    frameIntervalMs: 1000 / 60, minimapIntervalMs: 50, hudIntervalMs: 33, skyIntervalMs: 50, gestureIntervalMs: 40, camWidth: 480, camHeight: 360, camFPS: 24, lowfx: isMobile },
  high: { pixelRatioCap: 2, antialias: true, view: 2, fogNear: 110, fogFar: 360, trafficCars: 9, treeMult: 1, simpleBuildings: false, simpleRamps: false, spotlight: true,
    shadow: 2048, clouds: true, phys: true, lamps: true, particles: 160, mapDetail: 2, bloom: { threshold: 0.74, strength: 0.72, scale: 0.55, passes: 2 },
    frameIntervalMs: isMobile ? 1000 / 60 : 0, minimapIntervalMs: 0, hudIntervalMs: 0, skyIntervalMs: 0, gestureIntervalMs: 0, camWidth: 640, camHeight: 480, camFPS: 30, lowfx: false }
};
function resolveQuality(p) { if (p === 'auto') return isMobile ? 'low' : 'high'; return QUALITY[p] ? p : 'high'; }
const Q = Object.assign({}, QUALITY[resolveQuality(prefs.quality)]);

/* ---------------------------------------------------------------- renderer */
const canvas = $('game');
const rendererAA = Q.antialias;
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: rendererAA, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
function applyPixelRatio() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q.pixelRatioCap)); }
applyPixelRatio();

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fd3f5, Q.fogNear, Q.fogFar);
const camera = new THREE.PerspectiveCamera(68, 1, 0.3, 1400);
const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const shakeOff = { x: 0, y: 0, z: 0 }, shakeTarget = { x: 0, y: 0, z: 0 };
let shakeTimer = 0;
let renderDirty = true;
let viewShift = { x: 0, y: 0 };
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  if (viewShift.x || viewShift.y) camera.setViewOffset(w, h, -viewShift.x * w, viewShift.y * h, w, h); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  gCamera.aspect = w / h;
  if (state.garage) applyGarageView();
  sizeMinimap();
  resizeBloomTargets();
  renderDirty = true;
}
window.addEventListener('resize', function () { resize(); });

/* ------------------------------------------------------------------ bloom */
// Dependency-free 3-pass bloom: bright-pass threshold -> ping-pong gaussian blur
// (downsampled, so it's cheap) -> additive composite back onto the real frame.
// Off entirely on Low; Q.bloom carries {threshold, strength, scale, passes} on
// Medium/High (set per quality tier above) and resize()/applyQuality() keep the
// render-target sizes in sync with the canvas and the current tier.
const postGeo = new THREE.PlaneGeometry(2, 2);
const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const postScene = new THREE.Scene();
const postQuad = new THREE.Mesh(postGeo, new THREE.MeshBasicMaterial());
postScene.add(postQuad);
function postPass(mat, target) { postQuad.material = mat; renderer.setRenderTarget(target); renderer.render(postScene, postCam); }
const rtOpts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false };
const sceneRT = new THREE.WebGLRenderTarget(2, 2, Object.assign({}, rtOpts, { depthBuffer: true }));
const bloomA = new THREE.WebGLRenderTarget(2, 2, rtOpts), bloomB = new THREE.WebGLRenderTarget(2, 2, rtOpts);
const postVS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const brightMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.8 } }, vertexShader: postVS,
  fragmentShader: 'uniform sampler2D tDiffuse; uniform float uThreshold; varying vec2 vUv;\n' +
    'void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(0.2126,0.7152,0.0722)); float f = smoothstep(uThreshold, uThreshold + 0.25, l); gl_FragColor = vec4(c * f, 1.0); }'
});
const blurMat = new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRes: { value: new THREE.Vector2(1, 1) } }, vertexShader: postVS,
  fragmentShader: 'uniform sampler2D tDiffuse; uniform vec2 uDir; uniform vec2 uRes; varying vec2 vUv;\n' +
    'void main(){ vec2 texel = uDir / uRes; vec3 sum = texture2D(tDiffuse, vUv).rgb * 0.2270270270;\n' +
    '  sum += texture2D(tDiffuse, vUv + texel * 1.3846153846).rgb * 0.3162162162; sum += texture2D(tDiffuse, vUv - texel * 1.3846153846).rgb * 0.3162162162;\n' +
    '  sum += texture2D(tDiffuse, vUv + texel * 3.2307692308).rgb * 0.0702702703; sum += texture2D(tDiffuse, vUv - texel * 3.2307692308).rgb * 0.0702702703;\n' +
    '  gl_FragColor = vec4(sum, 1.0); }'
});
const compositeMat = new THREE.ShaderMaterial({
  uniforms: { tScene: { value: null }, tBloom: { value: null }, uStrength: { value: 0.6 } }, vertexShader: postVS,
  fragmentShader: 'uniform sampler2D tScene; uniform sampler2D tBloom; uniform float uStrength; varying vec2 vUv;\n' +
    'void main(){ vec3 base = texture2D(tScene, vUv).rgb; vec3 bloom = texture2D(tBloom, vUv).rgb; gl_FragColor = vec4(base + bloom * uStrength, 1.0); }'
});
function resizeBloomTargets() {
  const dpr = renderer.getPixelRatio(), w = Math.max(1, Math.round(window.innerWidth * dpr)), h = Math.max(1, Math.round(window.innerHeight * dpr));
  sceneRT.setSize(w, h);
  if (Q.bloom) { const s = Q.bloom.scale, bw = Math.max(1, Math.round(w * s)), bh = Math.max(1, Math.round(h * s)); bloomA.setSize(bw, bh); bloomB.setSize(bw, bh); blurMat.uniforms.uRes.value.set(bw, bh); }
}
function renderWithBloom() {
  const cfg = Q.bloom;
  renderer.setRenderTarget(sceneRT); renderer.clear(); renderer.render(scene, camera);
  brightMat.uniforms.tDiffuse.value = sceneRT.texture; brightMat.uniforms.uThreshold.value = cfg.threshold;
  postPass(brightMat, bloomA);
  let read = bloomA, write = bloomB;
  for (let i = 0; i < (cfg.passes || 1); i++) {
    blurMat.uniforms.tDiffuse.value = read.texture; blurMat.uniforms.uDir.value.set(1, 0); postPass(blurMat, write);
    let t = read; read = write; write = t;
    blurMat.uniforms.tDiffuse.value = read.texture; blurMat.uniforms.uDir.value.set(0, 1); postPass(blurMat, write);
    t = read; read = write; write = t;
  }
  compositeMat.uniforms.tScene.value = sceneRT.texture; compositeMat.uniforms.tBloom.value = read.texture; compositeMat.uniforms.uStrength.value = cfg.strength;
  renderer.setRenderTarget(null);
  postQuad.material = compositeMat; renderer.render(postScene, postCam);
}

/* --------------------------------------------------------- environment maps */
function gradientDome(fn, r) {
  const g = new THREE.SphereGeometry(r, 32, 16), col = [], pa = g.attributes.position;
  for (let i = 0; i < pa.count; i++) { const c = fn(pa.getY(i) / r); col.push(c.r, c.g, c.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
}
function bright(r, g, b) { return new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), side: THREE.DoubleSide }); }
function makeEnvTexture(kind) {
  const es = new THREE.Scene();
  if (kind === 'studio') {
    es.add(gradientDome(function (y) { return C(0x1a1d33).lerp(C(0x05060d), Math.max(0, y)); }, 50));
    [[0, 30, 0, 26, 6, 0], [-28, 14, 6, 6, 24, 1], [28, 14, 6, 6, 24, 1], [0, 12, -30, 30, 10, 2]].forEach(function (p, i) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(p[3], p[4]), bright(i === 1 ? 6 : 5, i === 2 ? 3.6 : 5, i === 2 ? 2.4 : 5.4));
      m.position.set(p[0], p[1], p[2]); m.lookAt(0, 0, 0); es.add(m);
    });
  } else {
    es.add(gradientDome(function (y) {
      if (y > 0) return C(0x3f78c8).lerp(C(0xe6eef8), Math.pow(1 - y, 2.2));
      return C(0x51564f).lerp(C(0x9aa39a), 1 + y * 0.6);
    }, 50));
    const sunM = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(14, 12, 9) }));
    sunM.position.set(30, 26, 20); es.add(sunM);
    for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.PlaneGeometry(30, 4), bright(4, 4, 4.2)); b.position.set(-20 + i * 20, 34, -10); b.rotation.x = Math.PI / 2; es.add(b); }
  }
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(es, 0.02);
  pm.dispose();
  es.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}
const envDay = makeEnvTexture('day');
const envStudio = makeEnvTexture('studio');
scene.environment = envDay;

/* -------------------------------------------------------------------- sky */
const skyUniforms = {
  uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) },
  uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uTime: { value: 0 }, uClouds: { value: 1 }, uDay: { value: 1 }
};
const skyMat = new THREE.ShaderMaterial({
  uniforms: skyUniforms, side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * p; gl_Position.z = gl_Position.w * 0.9999; }',
  fragmentShader: [
    'varying vec3 vDir; uniform vec3 uTop, uHor, uSun, uSunCol; uniform float uNight, uTime, uClouds, uDay;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }',
    'float fbm(vec2 p){ float a = 0.5, s = 0.0; for(int i = 0; i < 4; i++){ s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }',
    'void main(){',
    '  vec3 d = normalize(vDir); float h = max(d.y, 0.0);',
    '  vec3 col = mix(uHor, uTop, pow(h, 0.5));',
    '  float sd = max(dot(d, uSun), 0.0);',
    '  col += uSunCol * (pow(sd, 900.0) * 6.0 + pow(sd, 40.0) * 0.5 + pow(sd, 6.0) * 0.16) * (d.y > -0.05 ? 1.0 : 0.0);',
    '  if (uClouds > 0.5 && d.y > 0.015) {',
    '    vec2 uv = d.xz / (d.y + 0.22) * 1.6 + vec2(uTime * 0.012, uTime * 0.005);',
    '    float n = fbm(uv); float c = smoothstep(0.48, 0.82, n) * smoothstep(0.015, 0.2, d.y);',
    '    vec3 cc = mix(vec3(1.0), uHor * 1.6 + 0.15, 0.3) * (0.16 + 0.84 * uDay); cc += uSunCol * pow(sd, 3.0) * 0.5;',
    '    col = mix(col, cc, c * 0.85); }',
    '  if (uNight > 0.02) { vec3 p = d * 110.0; float s = step(0.9965, hash(floor(p.xz + p.y * 3.1) + floor(p.yy))) * smoothstep(0.03, 0.3, h); col += vec3(0.9, 0.95, 1.0) * s * uNight; }',
    '  gl_FragColor = vec4(col, 1.0);',
    '  #include <tonemapping_fragment>',
    '  #include <encodings_fragment>',
    '}'
  ].join('\n')
});
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), skyMat);
skyDome.renderOrder = -10; skyDome.frustumCulled = false;
scene.add(skyDome);

// distant hills that sit on the horizon (hazed with the fog colour)
const hillMat = new THREE.MeshBasicMaterial({ color: 0x556677, fog: false });
const hills = (function () {
  const geos = [], r = mulberry32(77);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + r() * 0.2, dist = 780 + r() * 60, w = 90 + r() * 120, h = 40 + r() * 90;
    const g = new THREE.ConeGeometry(w, h, 5 + Math.floor(r() * 3), 1); g.translate(Math.cos(a) * dist, h / 2 - 4, Math.sin(a) * dist); geos.push(g);
  }
  const m = new THREE.Mesh(K.merge(geos), hillMat); m.frustumCulled = false; m.renderOrder = -9; return m;
})();
scene.add(hills);

/* ----------------------------------------------------------------- lights */
const hemi = new THREE.HemisphereLight(0xffffff, 0x4a6a48, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(120, 220, 60); scene.add(sun); scene.add(sun.target);
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
const sunDir = new THREE.Vector3(0.5, 0.8, 0.3);
function applyShadowQuality() {
  const on = Q.shadow > 0;
  renderer.shadowMap.enabled = on; sun.castShadow = on;
  if (on) {
    sun.shadow.mapSize.set(Q.shadow, Q.shadow);
    if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
    const e = 70; const sc = sun.shadow.camera; sc.left = -e; sc.right = e; sc.top = e; sc.bottom = -e; sc.near = 10; sc.far = 420; sc.updateProjectionMatrix();
  }
}
const COL = { day: C(0x8fc4f2), night: C(0x050919), dusk: C(0xff8a4c), topDay: C(0x2a63c4), topNight: C(0x02040e), topDusk: C(0x3a3f8a), white: C(0xffffff), warm: C(0xffb070), moon: C(0x8aa4ff) };
const tmpA = new THREE.Color(), tmpB = new THREE.Color();
const sky = { t: 0.3, daylight: 1, frozen: false };

function updateSky(dt) {
  if (!sky.frozen) sky.t = (sky.t + dt / SETTINGS.dayLengthSeconds) % 1;
  const s = Math.sin(sky.t * Math.PI * 2);           // sun height
  const x = clamp((s + 0.22) / 0.55, 0, 1);
  const day = x * x * (3 - 2 * x);
  const dusk = Math.max(0, 1 - Math.abs(s) / 0.3) * 0.85;
  const night = 1 - day;
  tmpA.copy(COL.night).lerp(COL.day, day).lerp(COL.dusk, dusk);          // horizon
  tmpB.copy(COL.topNight).lerp(COL.topDay, day).lerp(COL.topDusk, dusk * 0.6);   // zenith
  skyUniforms.uHor.value.copy(tmpA); skyUniforms.uTop.value.copy(tmpB);
  scene.fog.color.copy(tmpA); hillMat.color.copy(tmpA).multiplyScalar(0.62).lerp(tmpB, 0.25);
  scene.fog.far = Q.fogFar * (1 - 0.3 * night);
  const cosA = Math.cos(sky.t * Math.PI * 2);
  sunDir.set(-cosA * 0.85, Math.max(s, -0.4), 0.45).normalize();
  skyUniforms.uSun.value.copy(sunDir);
  skyUniforms.uSunCol.value.copy(COL.white).lerp(COL.warm, 1 - clamp(s * 2.2, 0, 1)).multiplyScalar(day);
  skyUniforms.uNight.value = clamp(night * 1.4 - 0.2, 0, 1);
  skyUniforms.uDay.value = day; skyUniforms.uClouds.value = Q.clouds ? 1 : 0;
  skyUniforms.uTime.value += dt;
  // lights
  const above = s > 0.02;
  hemi.color.copy(tmpA).lerp(COL.white, 0.3); hemi.intensity = 0.34 + 0.42 * day; hemi.groundColor.setRGB(0.08 + 0.07 * day, 0.13 + 0.1 * day, 0.07 + 0.05 * day);
  if (above) {
    sun.color.copy(COL.white).lerp(COL.warm, 1 - clamp(s * 2.4, 0, 1));
    sun.intensity = 2.2 * clamp(s * 3, 0, 1) + 0.05;
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 200);
  } else {
    sun.color.copy(COL.moon); sun.intensity = 0.75 * night;
    sun.position.copy(sun.target.position).set(sun.target.position.x + 60, sun.target.position.y + 160, sun.target.position.z + 50);
  }
  renderer.toneMappingExposure = 1.02 + 0.25 * night;
  K.setEnvIntensity(0.3 + 0.7 * day);
  matLampHead.emissiveIntensity = 3.2 * clamp(night * 1.6 - 0.1, 0, 1);
  matLampGlow.opacity = 0.55 * clamp(night * 1.6 - 0.1, 0, 1);
  matRampLamp.emissiveIntensity = 2.6 * clamp(night * 1.6 - 0.1, 0, 1);
  const glow = clamp(night * 1.5 - 0.2, 0, 1);
  for (let i = 0; i < allSideMats.length; i++) allSideMats[i].emissiveIntensity = glow;
  headlight.intensity = night > 0.25 ? 6 * night : 0;
  sky.daylight = day; sky.night = night;
  const lampI = 0.45 + night * 1.6;
  K.trafficLamps.head.forEach(function (m) { m.emissiveIntensity = 0.6 + night * 2.4; });
  K.trafficLamps.tail.forEach(function (m) { m.emissiveIntensity = 0.5 + night * 0.8; });
  const blinkOn = Math.floor(performance.now() / 500) % 2 === 0;
  chunks.forEach(function (ch) { ch.blinks.forEach(function (b) { b.visible = blinkOn; }); });
}

/* ---------------------------------------------------------------- textures */
function texFrom(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
const rnd = Math.random;
const grassTex = texFrom(256, 256, function (g, w, h) {
  g.fillStyle = '#3e7b37'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) {
    const s = rnd();
    g.fillStyle = s < 0.5 ? 'rgba(96,160,70,' + (0.2 + rnd() * 0.3) + ')' : s < 0.8 ? 'rgba(52,104,44,' + (0.2 + rnd() * 0.3) + ')' : 'rgba(150,170,80,' + (0.12 + rnd() * 0.2) + ')';
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 2 + rnd() * 5);
  }
}, true);
const asphaltTex = texFrom(256, 256, function (g, w, h) {
  g.fillStyle = '#5b5e65'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) { const v = 60 + Math.floor(rnd() * 60); g.fillStyle = 'rgba(' + v + ',' + v + ',' + (v + 4) + ',' + (0.25 + rnd() * 0.5) + ')'; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
  g.strokeStyle = 'rgba(15,15,18,.35)'; g.lineWidth = 1;
  for (let i = 0; i < 5; i++) { g.beginPath(); let x = rnd() * w, y = rnd() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
}, true);

/* ------------------------------------------------------------------ ground */
const GRASS_TILE = 40, GROUND_SIZE = 3200;
grassTex.repeat.set(GROUND_SIZE / GRASS_TILE, GROUND_SIZE / GRASS_TILE);
const groundMat = new THREE.MeshLambertMaterial({ map: grassTex });
groundMat.onBeforeCompile = function (sh) {
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vWP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xz;');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vWP;\nfloat gh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat gn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gh(i),gh(i+vec2(1,0)),f.x),mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x),f.y);}')
    .replace('#include <map_fragment>', '#include <map_fragment>\nfloat mv = gn(vWP*0.011)*0.6 + gn(vWP*0.045)*0.4;\ndiffuseColor.rgb *= mix(vec3(0.7,0.78,0.6), vec3(1.02,0.98,0.82), mv);');
};
const ground = new THREE.Mesh(new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE), groundMat);
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);

const car = { x: -4, z: 0, y: 0, vy: 0, heading: 0, speed: 0, steer: 0, airborne: false, air: 0, trickSpin: 0, onRamp: null };
const boost = { t: 0, visual: 0, cooldown: 0, lastKey: false };
const stats = { coins: 0, dist: 0, top: 0, jumps: 0 };

/* ------------------------------------------------------------ world constants */
const CHUNK = 160, ROAD_W = 16;
function mulberry32(a) { return function () { var t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function chunkSeed(cx, cz) { return (Math.imul(cx, 73856093) ^ Math.imul(cz, 19349663) ^ 0x9e3779b9) >>> 0; }
function chunkKind(cx, cz) { const k = mulberry32(chunkSeed(cx, cz))(); return k < 0.38 ? 0 : k < 0.80 ? 1 : 2; }   // 0 city, 1 forest, 2 suburb

const L = function (hex, o) { return new THREE.MeshLambertMaterial(Object.assign({ color: C(hex) }, o || {})); };
const matTrunk = L(0x6e4a2c), matPine1 = L(0x2c7a3a), matPine2 = L(0x256a30), matPine3 = L(0x33873f), matLeaf = L(0x4a9a3a), matBush = L(0x3d8a34), matRock = L(0x8a8d90);
const matCoin = new THREE.MeshStandardMaterial({ color: C(0xffc928), metalness: 1, roughness: 0.28, emissive: C(0xb07600), emissiveIntensity: 0.5 });
const matGem = new THREE.MeshStandardMaterial({ color: C(0x3fd0ff), metalness: 0.2, roughness: 0.1, emissive: C(0x1a90c8), emissiveIntensity: 0.9 });
const matPad = new THREE.MeshBasicMaterial({ color: C(0x19b8ff) }), matPadIn = new THREE.MeshBasicMaterial({ color: C(0xd9f6ff) });
const matRamp = L(0xff9a2a), matRampTop = L(0xffd23f), matBoostStrip = new THREE.MeshBasicMaterial({ color: C(0xff2020) }), matBoostStripGlow = new THREE.MeshBasicMaterial({ color: C(0xff6060) });
const matMetal = L(0x9aa0a8), matDark = L(0x2a2d33), matAC = L(0x888c94), matWater = L(0x7ec8e3), matRedLt = new THREE.MeshBasicMaterial({ color: C(0xff3030) });
const matRoad = new THREE.MeshLambertMaterial({ map: asphaltTex });
const matLine = new THREE.MeshBasicMaterial({ color: C(0xf2e46b) });
const matDetail = new THREE.MeshLambertMaterial({ vertexColors: true });
const matLampHead = new THREE.MeshStandardMaterial({ color: C(0x222222), emissive: C(0xffd9a0), emissiveIntensity: 0, roughness: 0.4 });
const glowTex = K.tex.glow();
const matLampGlow = new THREE.MeshBasicMaterial({ map: glowTex, color: C(0xffc070), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });

const geoRoadX = (function () { const g = new THREE.PlaneGeometry(CHUNK, ROAD_W); g.rotateX(-Math.PI / 2); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * CHUNK / 10, u.getY(i) * ROAD_W / 10); return g; })();
const geoRoadZ = (function () { const g = new THREE.PlaneGeometry(ROAD_W, CHUNK); g.rotateX(-Math.PI / 2); const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * ROAD_W / 10, u.getY(i) * CHUNK / 10); return g; })();
const geoPlane = new THREE.PlaneGeometry(1, 1); geoPlane.rotateX(-Math.PI / 2);
const geoTrunk = new THREE.CylinderGeometry(0.5, 0.8, 1, 8);
const geoCone = new THREE.ConeGeometry(1, 1, 9);
const geoBlob = new THREE.IcosahedronGeometry(1, 1);
const geoBush = new THREE.IcosahedronGeometry(1, 0);
const geoCoin = (function () {
  const pr = [[0, -0.09], [0.78, -0.09], [0.86, -0.13], [1, -0.13], [1, 0.13], [0.86, 0.13], [0.78, 0.09], [0, 0.09]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  const g = new THREE.LatheGeometry(pr, 22); g.rotateZ(Math.PI / 2); g.rotateY(Math.PI / 2); return g;
})();
const geoGem = new THREE.OctahedronGeometry(1, 0);
const geoUnitBox = new THREE.BoxGeometry(1, 1, 1), geoUnitCyl = new THREE.CylinderGeometry(1, 1, 1, 12);
const geoLeg = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 6), geoAntenna = new THREE.CylinderGeometry(0.06, 0.1, 1, 6), geoBall = new THREE.SphereGeometry(0.22, 8, 6);
const geoLampHead = new THREE.BoxGeometry(0.9, 0.22, 0.4);
const dummy = new THREE.Object3D();

/* ----------------------------------------------------------------- buildings */
function makeVariantWindows(variant) {
  const wall = document.createElement('canvas'), glow = document.createElement('canvas');
  wall.width = wall.height = glow.width = glow.height = 128;
  const g = wall.getContext('2d'), h = glow.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 128); h.fillStyle = '#000'; h.fillRect(0, 0, 128, 128);
  const pane = function (x, y, w, hh, lit, litCol, glowCol) {
    const gr = g.createLinearGradient(x, y, x, y + hh);
    if (lit) { gr.addColorStop(0, litCol); gr.addColorStop(1, '#e8b85a'); } else { gr.addColorStop(0, '#6a8db4'); gr.addColorStop(1, '#2f4562'); }
    g.fillStyle = gr; g.fillRect(x, y, w, hh);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, w, 2);
    if (lit) { h.fillStyle = glowCol; h.fillRect(x, y, w, hh); }
  };
  if (variant === 0) { for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) pane(6 + c * 30, 6 + r * 30, 22, 20, Math.random() < 0.45, '#f7dd8a', '#ffd36b'); }
  else if (variant === 1) { for (let r = 0; r < 8; r++) pane(2, 4 + r * 15, 124, 10, Math.random() < 0.5, '#d8eaff', '#a8d4ff'); }
  else { for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) pane(4 + c * 20, 4 + r * 20, 16, 16, Math.random() < 0.35, '#ffe9b0', '#ffd36b'); }
  const a = new THREE.CanvasTexture(wall), b = new THREE.CanvasTexture(glow);
  a.encoding = b.encoding = THREE.sRGBEncoding; a.anisotropy = 4;
  a.wrapS = a.wrapT = b.wrapS = b.wrapT = THREE.RepeatWrapping;
  return { wall: a, glow: b };
}
const winTexVariants = [makeVariantWindows(0), makeVariantWindows(1), makeVariantWindows(2)];
const buildingColors = [0xc9b79c, 0xb4c3d1, 0xd9a58b, 0xa8b89a, 0xe0d5c1, 0x9fa9b8, 0xcf8f8f, 0xb8b0a0, 0xa0b8cc, 0xc0a890, 0xdedede, 0x8a8f99, 0xd0b8a8, 0x9fb8a8];
const roofColors = [0x555a63, 0x4a4d55, 0x3d4147, 0x6b7280, 0x505460];
const sideMatPalettes = winTexVariants.map(function (tex) {
  return buildingColors.map(function (c) { return new THREE.MeshLambertMaterial({ color: C(c), map: tex.wall, emissive: 0xffffff, emissiveMap: tex.glow, emissiveIntensity: 0 }); });
});
const roofMats = roofColors.map(function (c) { return L(c); });
const shopColors = [0xf2f2ec, 0xffc83d, 0xff6a3d, 0x3ddc84, 0x4ab8ff, 0xff5fa0];
const shopMats = shopColors.map(function (c) { return new THREE.MeshStandardMaterial({ color: C(c), emissive: C(c), emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.05 }); });
const allSideMats = []; sideMatPalettes.forEach(function (p) { p.forEach(function (m) { allSideMats.push(m); }); });
function buildingGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d), uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / 6, uv.getY(k) * dims[f][1] / 6); }
  uv.needsUpdate = true; return geo;
}
function buildBuilding(rand, bx, bz, w, h, d, isCity) {
  const pkg = new THREE.Group();
  const palette = sideMatPalettes[Math.floor(rand() * sideMatPalettes.length)];
  const side = palette[Math.floor(rand() * palette.length)], roofMat = roofMats[Math.floor(rand() * roofMats.length)];
  const geo = buildingGeometry(w, h, d); pkg.userData.ownGeos = [geo];
  const mesh = new THREE.Mesh(geo, [side, side, roofMat, roofMat, side, side]); mesh.position.set(0, h / 2, 0); mesh.castShadow = mesh.receiveShadow = true; pkg.add(mesh);
  if (!Q.simpleBuildings && rand() < 0.4 && h > 12) {
    const w2 = w * (0.5 + rand() * 0.3), d2 = d * (0.5 + rand() * 0.3), h2 = h * (0.15 + rand() * 0.25), g2 = buildingGeometry(w2, h2, d2);
    pkg.userData.ownGeos.push(g2);
    const m2 = new THREE.Mesh(g2, [side, side, roofMat, roofMat, side, side]); m2.castShadow = true;
    m2.position.set((rand() - 0.5) * (w - w2) * 0.5, h + h2 / 2, (rand() - 0.5) * (d - d2) * 0.5); pkg.add(m2);
  }
  // A bright ground-floor "shopfront" band + awning on some city buildings, so street
  // level reads as storefronts rather than a plain tower base. Purely decorative.
  if (!Q.simpleBuildings && isCity && h > 9 && rand() < 0.5) {
    const shopMat = shopMats[Math.floor(rand() * shopMats.length)];
    const bandH = 2.2 + rand() * 0.6, bandW = w + 0.3, bandD = d + 0.3;
    const band = new THREE.Mesh(geoUnitBox, shopMat); band.scale.set(bandW, bandH, bandD); band.position.set(0, bandH / 2 + 0.05, 0); band.receiveShadow = true; pkg.add(band);
    const awnW = w * 0.6, awnD = 1.1, awnH = 0.18;
    const awn = new THREE.Mesh(geoUnitBox, shopMat); awn.scale.set(awnW, awnH, awnD); awn.position.set(0, bandH + 0.35, d / 2 + awnD / 2 - 0.05); awn.rotation.x = -0.08; awn.castShadow = true; pkg.add(awn);
  }
  const acCount = Q.simpleBuildings ? 0 : (isCity ? 2 + Math.floor(rand() * 3) : Math.floor(rand() * 2));
  for (let i = 0; i < acCount; i++) {
    const aw = 1.2 + rand() * 1.2, ad = 1.2 + rand() * 1.2, ah = 0.8 + rand() * 0.6, ac = new THREE.Mesh(geoUnitBox, matAC);
    ac.scale.set(aw, ah, ad); ac.position.set((rand() - 0.5) * (w - aw - 1), h + ah / 2, (rand() - 0.5) * (d - ad - 1)); pkg.add(ac);
  }
  if (!Q.simpleBuildings && rand() < 0.35 && h > 8) {
    const r = 1 + rand() * 0.8, th = 1.5 + rand() * 1.2, tank = new THREE.Mesh(geoUnitCyl, matWater);
    tank.scale.set(r, th, r); tank.position.set((rand() - 0.5) * w * 0.5, h + th / 2 + 0.5, (rand() - 0.5) * d * 0.5); pkg.add(tank);
    for (let k = 0; k < 4; k++) { const leg = new THREE.Mesh(geoLeg, matMetal), an = k * Math.PI / 2 + Math.PI / 4; leg.position.set(tank.position.x + Math.cos(an) * r * 0.7, h + 0.3, tank.position.z + Math.sin(an) * r * 0.7); pkg.add(leg); }
  }
  if (!Q.simpleBuildings && isCity && rand() < 0.4) {
    const ah = 3 + rand() * 5, ant = new THREE.Mesh(geoAntenna, matMetal); ant.scale.set(1, ah, 1); ant.position.set(0, h + ah / 2, 0); pkg.add(ant);
    const lb = new THREE.Mesh(geoBall, matRedLt); lb.position.set(0, h + ah, 0); pkg.add(lb); pkg.userData.blink = lb;
  }
  pkg.position.set(bx, 0, bz); return pkg;
}

/* -------------------------------------------------------------------- ramps */
// Real ramp geometry: a triangular wedge whose incline exactly matches the physics
// surface the car drives up (see rampProgress / checkRamps below), in three sizes.
const RAMP_SIZES = [
  { name: 'small', length: 7, rise: 1.5, width: 6.2, boostAdd: 6, landing: 20 },
  { name: 'medium', length: 11, rise: 2.6, width: 6.6, boostAdd: 11, landing: 32 },
  { name: 'big', length: 16, rise: 4.4, width: 7.2, boostAdd: 18, landing: 46 }
];
function rampHeightAt(r, along) { const t = clamp(along / r.length, 0, 1); return r.rise * (t * t * (3 - 2 * t)); }
function rampShape(L, H) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(L * 0.12, H * 0.015); sh.quadraticCurveTo(L * 0.58, H * 0.32, L, H); sh.lineTo(L, 0); sh.closePath(); return sh; }
function railShape(L, H, kerb, tall) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(L, H); sh.lineTo(L, H + tall); sh.lineTo(0, kerb); sh.closePath(); return sh; }
const rampWedgeGeo = RAMP_SIZES.map(function (s) { const g = new THREE.ExtrudeGeometry(rampShape(s.length, s.rise), { depth: s.width, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.035, bevelThickness: 0.025, curveSegments: 8 }); g.translate(0, 0, -s.width / 2); g.computeVertexNormals(); return g; });
const RAIL_W = 0.16, RAIL_KERB = 0.05;
const rampRailGeo = RAMP_SIZES.map(function (s) { const g = new THREE.ExtrudeGeometry(railShape(s.length, s.rise, RAIL_KERB, s.rise * 0.3 + 0.28), { depth: RAIL_W, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.025, bevelThickness: 0.02, curveSegments: 8 }); g.translate(0, 0, -RAIL_W / 2); g.computeVertexNormals(); return g; });
const matRampRail = L(0x565b66);
const matRampLamp = new THREE.MeshStandardMaterial({ color: C(0x24241f), emissive: C(0xffab3a), emissiveIntensity: 0, roughness: 0.4 });
const matChevron = new THREE.MeshBasicMaterial({ color: C(0xf5f0e6) });
const matRampEdge = new THREE.MeshStandardMaterial({ color: C(0xff6b20), emissive: C(0xff4b16), emissiveIntensity: 0.35, roughness: 0.35 });
const matLanding = new THREE.MeshStandardMaterial({ color: C(0x252a32), roughness: 0.82, metalness: 0.05 });
function buildRampMesh(sizeIdx) {
  const s = RAMP_SIZES[sizeIdx], g = new THREE.Group(), angle = Math.atan2(s.rise, s.length);
  const wedge = new THREE.Mesh(rampWedgeGeo[sizeIdx], matRamp); wedge.castShadow = wedge.receiveShadow = true; g.add(wedge);
  const top = new THREE.Mesh(new THREE.BoxGeometry(s.length * 0.12, 0.045, s.width - RAIL_W * 2.6), matRampTop); top.position.set(s.length * 0.06, s.rise * 0.015 + 0.035, 0); top.rotation.z = Math.atan2(s.rise * 0.015, s.length * 0.12); top.receiveShadow = true; g.add(top);
  const railInset = s.width / 2 - RAIL_W / 2 - 0.04;
  [-1, 1].forEach(function (side) {
    const r = new THREE.Mesh(rampRailGeo[sizeIdx], matRampRail); r.castShadow = true; r.position.set(0, 0.015, side * railInset); g.add(r);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(s.length, 0.07, 0.07), matRampEdge); edge.position.set(s.length / 2, 0.08, side * railInset); edge.rotation.z = angle; g.add(edge);
    if (!Q.simpleRamps) for (let k = 0; k < 4; k++) { const tt = 0.16 + k * 0.25, lp = new THREE.Mesh(geoBall, matRampLamp); lp.scale.setScalar(0.3); lp.position.set(tt * s.length, rampHeightAt(s, tt * s.length) + 0.2, side * railInset); g.add(lp); }
  });
  const chevGeo = new THREE.BoxGeometry(0.52, 0.045, s.width * 0.58);
  for (let k = 0; k < (Q.simpleRamps ? 2 : 4); k++) { const tt = 0.18 + k * 0.19, y = rampHeightAt(s, tt * s.length) + 0.05, slope = (rampHeightAt(s, (tt + 0.015) * s.length) - rampHeightAt(s, (tt - 0.015) * s.length)) / (0.03 * s.length), cm = new THREE.Mesh(chevGeo, matChevron); cm.position.set(tt * s.length, y, 0); cm.rotation.z = Math.atan(slope); cm.receiveShadow = true; g.add(cm); }
  const stripGeo = new THREE.BoxGeometry(s.length * 0.24, 0.035, s.width - RAIL_W * 3), stripT = 0.70, strip = new THREE.Mesh(stripGeo, matBoostStrip);
  strip.position.set(s.length * stripT, rampHeightAt(s, s.length * stripT) + 0.07, 0); strip.rotation.z = Math.atan((rampHeightAt(s, s.length * (stripT + 0.01)) - rampHeightAt(s, s.length * (stripT - 0.01))) / (0.02 * s.length)); g.add(strip);
  if (!Q.simpleRamps) { const glow = new THREE.Mesh(stripGeo, matBoostStripGlow); glow.scale.set(1, 0.45, 1); glow.position.copy(strip.position); glow.position.y += 0.025; glow.rotation.copy(strip.rotation); g.add(glow); }
  const landing = new THREE.Mesh(new THREE.BoxGeometry(Math.min(8, s.landing * 0.22), 0.08, s.width - 0.7), matLanding); landing.position.set(s.length + Math.min(4, s.landing * 0.11), 0.04, 0); landing.receiveShadow = true; g.add(landing);
  return g;
}
// Places a ramp on either the X-road or Z-road of this chunk, retrying with a smaller
// size (and a different spot) until the runway + ramp + landing zone is provably clear
// of every collider already placed in this chunk (buildings, trees, lamp posts).
function rampAreaClear(existing, axis, dir, baseX, baseZ, s) {
  const spanFront = -18, spanBack = s.length + s.landing, half = s.width / 2 + 2.5;   // -18 keeps a clear runway for the approach off the road
  for (let i = 0; i < existing.length; i++) {
    const c = existing[i];
    const along = axis === 'x' ? (c.x - baseX) * dir : (c.z - baseZ) * dir;
    const across = axis === 'x' ? (c.z - baseZ) : (c.x - baseX);
    const cAlong = (c.hw !== undefined ? (axis === 'x' ? c.hw : c.hd) : c.r) || 0.5;
    const cAcross = (c.hw !== undefined ? (axis === 'x' ? c.hd : c.hw) : c.r) || 0.5;
    if (along + cAlong < spanFront || along - cAlong > spanBack) continue;
    if (across + cAcross < -half || across - cAcross > half) continue;
    return false;
  }
  return true;
}
// A short paved spur bridging the gap between the road's edge and the ramp's low entry,
// so driving onto the ramp reads as a deliberate peel-off lane, not a floating prop.
// midOffset is the perpendicular-to-road distance (from the road centreline) to the
// midpoint of that gap - i.e. exactly halfway between the road's edge and the ramp's edge.
function buildRampApron(axis, baseX, baseZ, midOffset, gap, halfWidth) {
  const across = gap + 1.8, along = halfWidth * 1.75;
  const g = new THREE.Mesh(geoPlane, matRoad); g.receiveShadow = true;
  const hz = new THREE.Mesh(geoPlane, matChevron);
  if (axis === 'x') {
    g.scale.set(along, 1, across); g.position.set(baseX, 0.08, baseZ + midOffset);
    hz.scale.set(along * 0.7, 1, 0.4); hz.position.set(baseX, 0.09, baseZ + midOffset);
  } else {
    g.scale.set(across, 1, along); g.position.set(baseX + midOffset, 0.08, baseZ);
    hz.scale.set(0.4, 1, along * 0.7); hz.position.set(baseX + midOffset, 0.09, baseZ);
  }
  const group = new THREE.Group(); group.add(g); group.add(hz); return group;
}
function buildRamp(baseX, baseZ, axis, dir, sizeIdx, side, apronMesh) {
  const s = RAMP_SIZES[sizeIdx], mesh = new THREE.Group();
  const ramp = buildRampMesh(sizeIdx); ramp.position.set(baseX, 0, baseZ);
  ramp.rotation.y = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? -Math.PI / 2 : Math.PI / 2);
  mesh.add(ramp); if (apronMesh) mesh.add(apronMesh);
  const lipX = axis === 'x' ? baseX + dir * s.length : baseX, lipZ = axis === 'x' ? baseZ : baseZ + dir * s.length;
  return {
    mesh: mesh, x: baseX, z: baseZ, baseX: baseX, baseZ: baseZ, axis: axis, dir: dir, side: side,
    length: s.length, rise: s.rise, halfWidth: s.width / 2, boostAdd: s.boostAdd, landing: s.landing,
    sizeIndex: sizeIdx, lipX: lipX, lipZ: lipZ
  };
}
// Ramps now live on the grass shoulder beside the road (never in a driving lane), reached
// by a short paved spur, so through-traffic is never blocked and there is nothing for a
// car to clip through unless it deliberately rides up the incline (see checkRamps).
function placeRampSafely(rand, ox, oz, existing) {
  const EDGE = 26, SHOULDER_GAP = 2.2;
  for (let attempt = 0; attempt < 8; attempt++) {
    const onXRoad = rand() < 0.5, sizeIdx = attempt < 3 ? Math.floor(rand() * 3) : (attempt < 6 ? 1 : 0);
    const s = RAMP_SIZES[sizeIdx], need = 8 + s.length + s.landing;
    if (need + EDGE * 2 > CHUNK) continue;
    const along = EDGE + rand() * (CHUNK - 2 * EDGE - need);
    const axis = onXRoad ? 'x' : 'z', dir = rand() < 0.5 ? 1 : -1, side = rand() < 0.5 ? -1 : 1;
    const baseAlong = along + 8, offset = side * (ROAD_W / 2 + s.width / 2 + SHOULDER_GAP);
    const baseX = axis === 'x' ? ox + baseAlong : ox + offset, baseZ = axis === 'x' ? oz + offset : oz + baseAlong;
    if (!rampAreaClear(existing, axis, dir, baseX, baseZ, s)) continue;
    const midOffset = -side * (s.width / 2 + SHOULDER_GAP / 2);   // ramp-base-relative midpoint of the road<->ramp gap
    const apron = buildRampApron(axis, baseX, baseZ, midOffset, SHOULDER_GAP, s.width / 2);
    return buildRamp(baseX, baseZ, axis, dir, sizeIdx, side, apron);
  }
  return null;
}
// Where is (x,z) relative to a ramp's own along/across axes (metres from the base, and
// sideways offset from its centreline)? Used both to follow the incline and to launch.
function rampProgress(ramp, x, z) {
  if (ramp.axis === 'x') return { along: (x - ramp.baseX) * ramp.dir, across: z - ramp.baseZ };
  return { along: (z - ramp.baseZ) * ramp.dir, across: x - ramp.baseX };
}
// True while (x,z) is within the footprint a car properly riding this ramp would be in -
// used to switch the ramp's collider off (let the incline-follow code in checkRamps own
// it) versus on (a normal solid obstacle, so hitting it from the side or the wrong
// direction stops the car instead of letting it clip straight through).
function inRampEnvelope(ramp, x, z, pad) {
  const p = rampProgress(ramp, x, z);
  // Must comfortably cover the collider's own padding (+/-0.7 along, +/-0.5 across, see
  // buildChunk) plus a car's radius, or a car approaching dead-on gets stopped by the
  // collider a metre or two before ever reaching the visible ramp.
  return p.along > -3.6 && p.along < ramp.length + 3.6 && Math.abs(p.across) <= ramp.halfWidth + (pad || 1.3);
}

/* ------------------------------------------------------------- chunk streaming */
const chunks = new Map();
let colliders = [], activeCoins = [], activePads = [], activeRamps = [];
const collectedCoins = new Set();

function boxG(list, x, y, z, w, h, d, hex, ry) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  const c = C(hex), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  list.push(g);
}
function mergeColored(list) {
  let count = 0; const parts = list.map(function (g) { const n = g.toNonIndexed(); count += n.attributes.position.count; return n; });
  const P = new Float32Array(count * 3), N = new Float32Array(count * 3), Cc = new Float32Array(count * 3); let o = 0;
  parts.forEach(function (g) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); Cc.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; g.dispose(); });
  list.forEach(function (g) { g.dispose(); });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  return out;
}

function buildChunk(cx, cz) {
  const rand = mulberry32(chunkSeed(cx, cz)), group = new THREE.Group(), ox = cx * CHUNK, oz = cz * CHUNK;
  const chunk = { group: group, cx: cx, cz: cz, colliders: [], coins: [], pads: [], ramps: [], ownGeos: [], instanced: [], blinks: [] };

  const r1 = new THREE.Mesh(geoRoadX, matRoad); r1.position.set(ox + CHUNK / 2, 0.06, oz); r1.receiveShadow = true; group.add(r1);
  const r2 = new THREE.Mesh(geoRoadZ, matRoad); r2.position.set(ox, 0.07, oz + CHUNK / 2); r2.receiveShadow = true; group.add(r2);

  // road furniture (edge lines, kerbs, crosswalks, lamp posts) merged into ONE mesh
  const det = [], lamps = [];
  const inner = CHUNK - ROAD_W, mid = CHUNK / 2, ed = ROAD_W / 2 - 0.55, kb = ROAD_W / 2 + 0.75;
  [-1, 1].forEach(function (s) {
    boxG(det, ox + mid, 0.1, oz + s * ed, inner, 0.03, 0.22, 0xe8e8e2); boxG(det, ox + s * ed, 0.11, oz + mid, 0.22, 0.03, inner, 0xe8e8e2);
    boxG(det, ox + mid, 0.09, oz + s * kb, inner, 0.18, 1.5, 0x9a9a98); boxG(det, ox + s * kb, 0.09, oz + mid, 1.5, 0.18, inner, 0x9a9a98);
  });
  [-1, 1].forEach(function (s) {
    for (let k = 0; k < 7; k++) {
      const o = (k - 3) * 2.15;
      boxG(det, ox + s * (ROAD_W / 2 + 3.4), 0.1, oz + o, 3, 0.03, 0.95, 0xf0f0ea); boxG(det, ox + o, 0.11, oz + s * (ROAD_W / 2 + 3.4), 0.95, 0.03, 3, 0xf0f0ea);
    }
  });
  if (Q.lamps) for (let i = 0; i < 3; i++) {
    const along = 34 + i * 46, side = (i % 2) ? 1 : -1;
    lamps.push({ x: ox + along, z: oz + side * (ROAD_W / 2 + 2.6), ax: 0, az: -side }); lamps.push({ x: ox - side * (ROAD_W / 2 + 2.6), z: oz + along + 12, ax: side, az: 0 });
  }
  lamps.forEach(function (l) {
    boxG(det, l.x, 3.6, l.z, 0.24, 7.2, 0.24, 0x3a3d44);
    boxG(det, l.x + l.ax * 1.1, 7.15, l.z + l.az * 1.1, l.ax ? 2.2 : 0.16, 0.16, l.az ? 2.2 : 0.16, 0x3a3d44);
    chunk.colliders.push({ x: l.x, z: l.z, r: 0.35, h: 7.3 });
  });
  const detGeo = mergeColored(det); chunk.ownGeos.push(detGeo);
  const detMesh = new THREE.Mesh(detGeo, matDetail); detMesh.receiveShadow = true; group.add(detMesh);
  if (lamps.length) {
    const heads = new THREE.InstancedMesh(geoLampHead, matLampHead, lamps.length), pools = new THREE.InstancedMesh(geoPlane, matLampGlow, lamps.length);
    lamps.forEach(function (l, i) {
      dummy.rotation.set(0, l.ax ? 0 : Math.PI / 2, 0); dummy.scale.set(1, 1, 1); dummy.position.set(l.x + l.ax * 2.1, 7.0, l.z + l.az * 2.1); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
      dummy.rotation.set(0, 0, 0); dummy.scale.set(20, 1, 20); dummy.position.set(l.x + l.ax * 2.1, 0.16, l.z + l.az * 2.1); dummy.updateMatrix(); pools.setMatrixAt(i, dummy.matrix);
    });
    heads.frustumCulled = pools.frustumCulled = false; pools.renderOrder = 1; group.add(heads); group.add(pools); chunk.instanced.push(heads, pools);
  }

  const dashCount = Math.floor(CHUNK / 10) * 2, dashes = new THREE.InstancedMesh(geoPlane, matLine, dashCount); let di = 0;
  for (let i = 0; i < CHUNK / 10; i++) {
    dummy.rotation.set(0, 0, 0); dummy.scale.set(4, 1, 0.3); dummy.position.set(ox + i * 10 + 3, 0.12, oz); dummy.updateMatrix(); dashes.setMatrixAt(di++, dummy.matrix);
    dummy.scale.set(0.3, 1, 4); dummy.position.set(ox, 0.13, oz + i * 10 + 3); dummy.updateMatrix(); dashes.setMatrixAt(di++, dummy.matrix);
  }
  dashes.frustumCulled = false; group.add(dashes); chunk.instanced.push(dashes);

  const kind = chunkKind(cx, cz); rand();
  const isCity = kind === 0, isForest = kind === 1;
  const lo = ROAD_W / 2 + 6, hi = CHUNK - ROAD_W / 2 - 6, span = hi - lo, cells = 3, cell = span / cells;
  for (let i = 0; i < cells; i++) for (let j = 0; j < cells; j++) {
    const chance = isCity ? 0.9 : (isForest ? 0.06 : 0.22);
    if (rand() > chance) continue;
    const w = 10 + rand() * 22, d = 10 + rand() * 22, h = isCity ? 12 + rand() * 55 : 5 + rand() * 14;
    const bx = ox + lo + (i + 0.5) * cell + (rand() - 0.5) * 6, bz = oz + lo + (j + 0.5) * cell + (rand() - 0.5) * 6;
    const pkg = buildBuilding(rand, bx, bz, w, h, d, isCity); group.add(pkg);
    if (pkg.userData.blink) chunk.blinks.push(pkg.userData.blink);
    pkg.userData.ownGeos.forEach(function (g) { chunk.ownGeos.push(g); });
    chunk.colliders.push({ x: bx, z: bz, hw: w / 2, hd: d / 2, h: h });
  }

  // trees (pines + broadleaf), bushes and rocks, all instanced
  const treeCount = Math.max(2, Math.round((isForest ? 36 : (isCity ? 4 : 12)) * Q.treeMult));
  const trunks = new THREE.InstancedMesh(geoTrunk, matTrunk, treeCount), t1 = new THREE.InstancedMesh(geoCone, matPine1, treeCount), t2 = new THREE.InstancedMesh(geoCone, matPine2, treeCount), t3 = new THREE.InstancedMesh(geoCone, matPine3, treeCount), blobs = new THREE.InstancedMesh(geoBlob, matLeaf, treeCount);
  let np = 0, nb = 0, placed = 0; const tint = new THREE.Color();
  [t1, t2, t3, blobs].forEach(function (m) { m.setColorAt(0, tint.setScalar(1)); });   // r128: a material must always be used with an instance-colour buffer
  for (let t = 0; t < treeCount; t++) {
    const tx = ox + lo + rand() * span, tz = oz + lo + rand() * span; let blocked = false;
    for (let k = 0; k < chunk.colliders.length; k++) { const c = chunk.colliders[k]; if (c.r === undefined && Math.abs(tx - c.x) < c.hw + 2 && Math.abs(tz - c.z) < c.hd + 2) { blocked = true; break; } }
    const pine = rand() < 0.6, s = 0.8 + rand() * 0.9, tone = 0.8 + rand() * 0.4;
    if (blocked) continue;
    dummy.rotation.set(0, rand() * 6, 0);
    dummy.scale.set(s, 3.4 * s, s); dummy.position.set(tx, 1.7 * s, tz); dummy.updateMatrix(); trunks.setMatrixAt(placed, dummy.matrix);
    if (pine) {
      [[t1, 2.9, 3.6, 3.2], [t2, 2.3, 3.2, 5.4], [t3, 1.6, 2.8, 7.4]].forEach(function (L3) { dummy.scale.set(L3[1] * s, L3[2] * s, L3[1] * s); dummy.position.set(tx, L3[3] * s, tz); dummy.updateMatrix(); L3[0].setMatrixAt(np, dummy.matrix); tint.setScalar(tone); L3[0].setColorAt(np, tint); });
      np++;
      dummy.scale.set(0, 0, 0); dummy.updateMatrix(); blobs.setMatrixAt(placed, dummy.matrix);
    } else {
      dummy.scale.set(2.5 * s, 2.2 * s, 2.5 * s); dummy.position.set(tx, 5.2 * s, tz); dummy.updateMatrix(); blobs.setMatrixAt(placed, dummy.matrix); tint.setRGB(tone * 1.05, tone, tone * 0.85); blobs.setColorAt(placed, tint);
    }
    chunk.colliders.push({ x: tx, z: tz, r: 0.9 * s, h: pine ? 8.8 * s : 6.4 * s });
    placed++;
  }
  trunks.count = placed; blobs.count = placed; t1.count = t2.count = t3.count = np;
  [trunks, t1, t2, t3, blobs].forEach(function (m) { m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; if (m.instanceMatrix) m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; group.add(m); chunk.instanced.push(m); });
  if (Q.treeMult >= 0.8) {
    const bushN = isForest ? 14 : 6, bushes = new THREE.InstancedMesh(geoBush, matBush, bushN), rocks = new THREE.InstancedMesh(geoBush, matRock, bushN); let bp = 0;
    for (let i = 0; i < bushN; i++) {
      const bx = ox + lo + rand() * span, bz = oz + lo + rand() * span, s = 0.5 + rand() * 0.9, isRock = rand() < 0.3;
      dummy.rotation.set(rand() * 3, rand() * 3, 0); dummy.scale.set(s * 1.3, s * (isRock ? 0.8 : 1), s * 1.1); dummy.position.set(bx, s * 0.5, bz); dummy.updateMatrix();
      (isRock ? rocks : bushes).setMatrixAt(bp, dummy.matrix); (isRock ? bushes : rocks).setMatrixAt(bp, new THREE.Matrix4().makeScale(0, 0, 0)); bp++;
    }
    bushes.count = rocks.count = bp; bushes.frustumCulled = rocks.frustumCulled = false; bushes.receiveShadow = true; group.add(bushes); group.add(rocks); chunk.instanced.push(bushes, rocks);
  }

  // coins: weaving trails along the roads (steer to collect them), plus a rare gem
  for (let tr = 0; tr < 2; tr++) {
    const onX = rand() < 0.5, a0 = 18 + rand() * (CHUNK - 18 - 40), amp = 2.4 + rand() * 1.4, ph = rand() * 6, lane = rand() < 0.5 ? -3 : 3;
    for (let i = 0; i < 7; i++) {
      const id = cx + ',' + cz + ',c' + tr + ',' + i; if (collectedCoins.has(id)) continue;
      const along = a0 + i * 4.6, across = lane + Math.sin(i * 0.9 + ph) * amp;
      const px = onX ? ox + along : ox + across, pz = onX ? oz + across : oz + along;
      const coin = new THREE.Mesh(geoCoin, matCoin); coin.scale.set(0.82, 0.82, 0.82); coin.position.set(px, 1.6, pz); coin.castShadow = true; group.add(coin);
      chunk.coins.push({ id: id, mesh: coin, x: px, z: pz, v: 1, gem: false });
    }
  }
  if (rand() < 0.4) {
    const id = cx + ',' + cz + ',gem';
    if (!collectedCoins.has(id)) {
      const onX = rand() < 0.5, along = 20 + rand() * (CHUNK - 40), across = (rand() - 0.5) * 8, px = onX ? ox + along : ox + across, pz = onX ? oz + across : oz + along;
      const gem = new THREE.Mesh(geoGem, matGem); gem.scale.set(0.8, 1.2, 0.8); gem.position.set(px, 1.9, pz); group.add(gem);
      chunk.coins.push({ id: id, mesh: gem, x: px, z: pz, v: 10, gem: true });
    }
  }

  if (rand() < 0.65) {
    const onX = rand() < 0.5, along = 25 + rand() * (CHUNK - 50), lane = rand() < 0.5 ? -4 : 4, px = onX ? ox + along : ox + lane, pz = onX ? oz + lane : oz + along;
    const base = new THREE.Mesh(geoPlane, matPad); base.scale.set(onX ? 12 : 6.5, 1, onX ? 6.5 : 12); base.position.set(px, 0.15, pz);
    const inn = new THREE.Mesh(geoPlane, matPadIn); inn.scale.set(onX ? 8 : 2, 1, onX ? 2 : 8); inn.position.set(px, 0.16, pz);
    group.add(base); group.add(inn); chunk.pads.push({ x: px, z: pz, cool: 0 });
  }
  // Ramps removed: road flow is now completely clear.

  scene.add(group); return chunk;
}
function removeChunk(chunk) { scene.remove(chunk.group); chunk.ownGeos.forEach(function (g) { g.dispose(); }); chunk.instanced.forEach(function (m) { if (m.dispose) m.dispose(); }); }
/* ------------------------------------------------------- collision spatial grid */
// Buckets every collider (buildings, trees, lamp posts, ramp backstops) into a
// uniform grid so collide()/moveCar() only ever test the handful of colliders near
// the car instead of the whole active list. Rebuilt whenever the active chunk set
// changes (rebuildLists), which is cheap and infrequent compared to per-frame movement.
const GRID_CELL = 20;
let colliderGrid = new Map(), queryStamp = 0;
function buildColliderGrid() {
  colliderGrid = new Map();
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    const rx = (c.hw !== undefined ? c.hw : c.r) || 0.5, rz = (c.hd !== undefined ? c.hd : c.r) || 0.5;
    const gx0 = Math.floor((c.x - rx) / GRID_CELL), gx1 = Math.floor((c.x + rx) / GRID_CELL);
    const gz0 = Math.floor((c.z - rz) / GRID_CELL), gz1 = Math.floor((c.z + rz) / GRID_CELL);
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
      const key = gx + '_' + gz; let arr = colliderGrid.get(key); if (!arr) { arr = []; colliderGrid.set(key, arr); } arr.push(c);
    }
  }
}
function queryGrid(x, z, margin) {
  queryStamp++;
  const gx0 = Math.floor((x - margin) / GRID_CELL), gx1 = Math.floor((x + margin) / GRID_CELL);
  const gz0 = Math.floor((z - margin) / GRID_CELL), gz1 = Math.floor((z + margin) / GRID_CELL);
  const out = [];
  for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
    const arr = colliderGrid.get(gx + '_' + gz); if (!arr) continue;
    for (let k = 0; k < arr.length; k++) { const c = arr[k]; if (c.__q !== queryStamp) { c.__q = queryStamp; out.push(c); } }
  }
  return out;
}
function rebuildLists() {
  colliders = []; activeCoins = []; activePads = []; activeRamps = [];
  chunks.forEach(function (ch) {
    Array.prototype.push.apply(colliders, ch.colliders); Array.prototype.push.apply(activePads, ch.pads); Array.prototype.push.apply(activeRamps, ch.ramps);
    ch.coins.forEach(function (c) { if (c.mesh.visible) activeCoins.push(c); });
  });
  buildColliderGrid();
}
const buildQueue = []; let streamCX = null, streamCZ = null;
function clearChunks() { chunks.forEach(function (ch) { removeChunk(ch); }); chunks.clear(); buildQueue.length = 0; streamCX = streamCZ = null; }
function updateChunks(force) {
  const ccx = Math.floor(car.x / CHUNK), ccz = Math.floor(car.z / CHUNK);
  if (!force && ccx === streamCX && ccz === streamCZ && !buildQueue.length) return;
  const V = Q.view; let changed = !!force;
  if (force || ccx !== streamCX || ccz !== streamCZ) {
    streamCX = ccx; streamCZ = ccz;
    chunks.forEach(function (ch, key) { if (Math.abs(ch.cx - ccx) > V || Math.abs(ch.cz - ccz) > V) { removeChunk(ch); chunks.delete(key); changed = true; } });
    buildQueue.length = 0;
    for (let dx = -V; dx <= V; dx++) for (let dz = -V; dz <= V; dz++) { const key = (ccx + dx) + ',' + (ccz + dz); if (!chunks.has(key)) buildQueue.push({ cx: ccx + dx, cz: ccz + dz, key: key, d: dx * dx + dz * dz }); }
    buildQueue.sort(function (a, b) { return a.d - b.d; });
  }
  let budget = force ? Infinity : 1;
  while (buildQueue.length && budget-- > 0) { const job = buildQueue.shift(); if (!chunks.has(job.key)) { chunks.set(job.key, buildChunk(job.cx, job.cz)); changed = true; } }
  if (changed) rebuildLists();
}

/* ================================================================ vehicles */
K.initMaterials(Q.phys);
const defs = K.defs;
function defById(id) { for (let i = 0; i < defs.length; i++) if (defs[i].id === id) return defs[i]; return defs[0]; }
function paintFor(def) { return save.paints[def.id] != null ? save.paints[def.id] : def.defaultPaint; }
function isOwned(id) { return save.owned.indexOf(id) >= 0; }

const headlight = new THREE.SpotLight(0xfff0d0, 0, 110, 0.55, 0.6, 1.0);
headlight.position.set(0, 1.0, 1.4); headlight.target.position.set(0, 0.2, 26);
const cur = { def: null, obj: null, phys: null };
let GEAR_TOP = [9, 18, 28, 38, 60];

function applyPhys() {
  const p = cur.phys;
  SETTINGS.maxSpeed = p.maxSpeed; SETTINGS.acceleration = p.accel; SETTINGS.brakePower = p.brake;
  BASE_SETTINGS.turnSpeed = p.turn; SETTINGS.turnSpeed = p.turn * prefs.steerSensitivity / 100;
  GEAR_TOP = [0.14, 0.3, 0.48, 0.7, 1.0].map(function (f) { return f * p.maxSpeed * 1.04; });
}
function setVehicle(id) {
  const def = defById(id);
  if (cur.obj) { cur.obj.remove(headlight); cur.obj.remove(headlight.target); scene.remove(cur.obj); K.dispose(cur.obj); }
  const obj = def.build({ paint: paintFor(def) });
  obj.traverse(function (o) { if (o.isMesh) o.castShadow = o.castShadow && !(o.material && o.material.transparent); });
  scene.add(obj);
  obj.add(headlight); obj.add(headlight.target);
  cur.def = def; cur.obj = obj; cur.phys = def.phys;
  applyPhys();
  setAudioProfile(def.sound.kind);
  renderDirty = true;
}
function rebuildVehicles() {        // after a quality change (materials are re-created)
  K.initMaterials(Q.phys);
  K.disposeTraffic();
  while (traffic.length) { const t = traffic.pop(); scene.remove(t.mesh); }
  setVehicle(cur.def.id);
  syncTrafficCount();
  gCache.thumbs = {}; gCache.obj = null;
}

/* ================================================================ particles */
const PMAX = 170;
const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 4), pPar = new Float32Array(PMAX * 2);
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('aColor', new THREE.BufferAttribute(pCol, 4).setUsage(THREE.DynamicDrawUsage));
pGeo.setAttribute('aParams', new THREE.BufferAttribute(pPar, 2).setUsage(THREE.DynamicDrawUsage));
const pUni = { uScale: { value: 600 } };
const pMat = new THREE.ShaderMaterial({
  uniforms: pUni, transparent: true, depthWrite: false, fog: false,
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  vertexShader: 'attribute vec4 aColor; attribute vec2 aParams; varying vec4 vC; varying float vG; uniform float uScale; void main(){ vC = aColor; vG = aParams.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aParams.x * uScale / max(0.5, -mv.z); gl_Position = projectionMatrix * mv; }',
  fragmentShader: ['varying vec4 vC; varying float vG;', 'void main(){', '  float d = length(gl_PointCoord - 0.5) * 2.0; float a = smoothstep(1.0, 0.0, d); a *= a;', '  gl_FragColor = vec4(vC.rgb * a * vC.a, a * vC.a * (1.0 - vG));', '  #include <tonemapping_fragment>', '  #include <encodings_fragment>', '}'].join('\n')
});
const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; pPoints.renderOrder = 5; scene.add(pPoints);
const parts = []; for (let i = 0; i < PMAX; i++) parts.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, g: 0, r: 1, gr: 1, b: 1, a: 1, glow: 0, grav: 0 });
let pHead = 0;
const cSmoke = C(0xc8c8cc), cDust = C(0xb8a070), cFlameB = C(0x7fc8ff), cFlameO = C(0xffa550), cSpark = C(0xffd070), cGold = C(0xffd24a), cGem = C(0x5fdcff);
function emit(x, y, z, vx, vy, vz, size, grow, life, col, a, glow, grav) {
  if (!Q.particles) return;
  const lim = Math.min(PMAX, Q.particles); pHead = (pHead + 1) % lim;
  const p = parts[pHead];
  p.life = p.max = life; p.x = x; p.y = y; p.z = z; p.vx = vx; p.vy = vy; p.vz = vz; p.s = size; p.g = grow; p.r = col.r; p.gr = col.g; p.b = col.b; p.a = a; p.glow = glow || 0; p.grav = grav || 0;
}
function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = parts[i];
    if (p.life > 0) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= p.grav * dt; p.s += p.g * dt;
      if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy *= -0.3; }
      const t = Math.max(0, p.life / p.max);
      pPos[i * 3] = p.x; pPos[i * 3 + 1] = p.y; pPos[i * 3 + 2] = p.z;
      pCol[i * 4] = p.r; pCol[i * 4 + 1] = p.gr; pCol[i * 4 + 2] = p.b; pCol[i * 4 + 3] = p.a * t;
      pPar[i * 2] = p.s; pPar[i * 2 + 1] = p.glow;
    } else { pCol[i * 4 + 3] = 0; pPar[i * 2] = 0; }
  }
  pGeo.attributes.position.needsUpdate = pGeo.attributes.aColor.needsUpdate = pGeo.attributes.aParams.needsUpdate = true;
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2());
  pUni.uScale.value = sz.y / (2 * Math.tan(camera.fov * Math.PI / 360));
}
function rearPoint(k, side) {       // point behind the car (k metres) and sideways
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading);
  return { x: car.x - fx * k + fz * side, z: car.z - fz * k - fx * side };
}
function onRoad(x, z) {
  const mx = ((x % CHUNK) + CHUNK) % CHUNK, mz = ((z % CHUNK) + CHUNK) % CHUNK;
  const dx = Math.min(mx, CHUNK - mx), dz = Math.min(mz, CHUNK - mz);
  return dx < ROAD_W / 2 + 0.5 || dz < ROAD_W / 2 + 0.5;
}
let fxAcc = 0;
function driveEffects(dt, input) {
  fxAcc += dt;
  const sp = Math.abs(car.speed), bike = cur.def.type === 'bike';
  const braking = input.brake > 0 && car.speed > 12, corner = Math.abs(car.steer) > 0.6 && sp > 20 && !car.airborne;
  const wide = bike ? 0.15 : 0.75;
  if (fxAcc > 0.03) {
    fxAcc = 0;
    if ((braking || corner) && !car.airborne) {
      [-1, 1].forEach(function (s) { const p = rearPoint(1.1, s * wide); emit(p.x, 0.3, p.z, (Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5, 1.1, 2.6, 0.9, cSmoke, 0.35, 0, 0); });
    }
    if (!onRoad(car.x, car.z) && sp > 8 && !car.airborne) {
      [-1, 1].forEach(function (s) { const p = rearPoint(1.2, s * wide); emit(p.x, 0.3, p.z, (Math.random() - 0.5) * 2, 1.2 + Math.random(), (Math.random() - 0.5) * 2, 1.0, 2.2, 0.8, cDust, 0.4, 0, 0); });
    }
    if (boost.t > 0) {
      [-1, 1].forEach(function (s) { const p = rearPoint(2.3, s * (bike ? 0.2 : 0.4)); const f = Math.sin(car.heading), g = Math.cos(car.heading);
        if (Math.random() < 0.6) emit(p.x, 0.45 + car.y, p.z, -f * 5, 0.2, -g * 5, 0.5, -1.4, 0.22, Math.random() < 0.5 ? cFlameB : cFlameO, 0.8, 1, 0); });
    }
  }
}
function sparksAt(x, y, z, n) { for (let i = 0; i < n; i++) emit(x, y, z, (Math.random() - 0.5) * 9, 2 + Math.random() * 5, (Math.random() - 0.5) * 9, 0.22, -0.2, 0.6, cSpark, 1, 1, 18); }

/* ================================================================== audio */
const audio = { ctx: null, master: null, muted: !!prefs.muted, volume: clamp(prefs.volume / 100, 0, 1), noise: null, eng: null, skid: null, wind: null, horn: null, prof: null };
const SND = {
  i4:     { b0: 38, b1: 70, b2: 7, w1: 'sawtooth', w2: 'square', sub: 0.45, c0: 320, c1: 900, g: 0.1, am: [0, 0] },
  v8:     { b0: 26, b1: 48, b2: 5, w1: 'sawtooth', w2: 'square', sub: 0.75, c0: 240, c1: 640, g: 0.13, am: [14, 0.4] },
  jdm:    { b0: 46, b1: 96, b2: 9, w1: 'sawtooth', w2: 'sawtooth', sub: 0.3, c0: 420, c1: 1500, g: 0.1, am: [0, 0], wh: { f0: 900, f1: 2600, g: 0.018 } },
  diesel: { b0: 24, b1: 38, b2: 4, w1: 'square', w2: 'square', sub: 0.6, c0: 200, c1: 520, g: 0.14, am: [18, 0.3] },
  ev:     { b0: 60, b1: 250, b2: 0, w1: 'sine', w2: 'triangle', sub: 0.15, c0: 900, c1: 3000, g: 0.05, am: [0, 0], wh: { f0: 500, f1: 2600, g: 0.05 } },
  v6:     { b0: 40, b1: 85, b2: 8, w1: 'sawtooth', w2: 'square', sub: 0.4, c0: 380, c1: 1200, g: 0.1, am: [0, 0] },
  v10:    { b0: 52, b1: 120, b2: 11, w1: 'sawtooth', w2: 'sawtooth', sub: 0.35, c0: 500, c1: 1800, g: 0.11, am: [0, 0] },
  v12:    { b0: 58, b1: 135, b2: 12, w1: 'sawtooth', w2: 'sawtooth', sub: 0.3, c0: 600, c1: 2200, g: 0.11, am: [0, 0], wh: { f0: 1200, f1: 3400, g: 0.012 } },
  two:    { b0: 70, b1: 150, b2: 10, w1: 'sawtooth', w2: 'square', sub: 0.3, c0: 800, c1: 2600, g: 0.09, am: [38, 0.3] },
  i4bike: { b0: 80, b1: 190, b2: 14, w1: 'sawtooth', w2: 'sawtooth', sub: 0.25, c0: 900, c1: 3200, g: 0.09, am: [0, 0] },
  twin:   { b0: 22, b1: 34, b2: 4, w1: 'square', w2: 'sawtooth', sub: 0.8, c0: 200, c1: 520, g: 0.14, am: [10, 0.55] },
  sbk:    { b0: 90, b1: 220, b2: 16, w1: 'sawtooth', w2: 'sawtooth', sub: 0.25, c0: 1000, c1: 3600, g: 0.09, am: [0, 0] }
};
function setAudioProfile(kind) {
  const P = SND[kind] || SND.i4; audio.prof = P;
  const e = audio.eng; if (!e) return;
  e.o1.type = P.w1; e.o2.type = P.w2; e.sub.gain.value = P.sub;
  e.am.gain.value = 1 - P.am[1] / 2; e.lfoG.gain.value = P.am[1] / 2;
}
function initAudio() {
  if (audio.ctx) { if (audio.ctx.resume) audio.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    const ctx = new AC(); audio.ctx = ctx;
    audio.master = ctx.createGain(); audio.master.gain.value = audio.muted ? 0 : audio.volume; audio.master.connect(ctx.destination);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), data = nb.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    audio.noise = nb;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), o3 = ctx.createOscillator(); o3.type = 'sine';
    const sub = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 2;
    const am = ctx.createGain(), eg = ctx.createGain(); eg.gain.value = 0;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 12; lfo.connect(lfoG); lfoG.connect(am.gain);
    const wh = ctx.createGain(); wh.gain.value = 0;
    o1.connect(lp); o2.connect(sub); sub.connect(lp); lp.connect(am); am.connect(eg); eg.connect(audio.master); o3.connect(wh); wh.connect(audio.master);
    o1.start(); o2.start(); o3.start(); lfo.start();
    audio.eng = { o1: o1, o2: o2, o3: o3, lp: lp, gain: eg, sub: sub, am: am, lfo: lfo, lfoG: lfoG, wh: wh };
    const loopNoise = function (freq, q, type) {
      const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(f); f.connect(g); g.connect(audio.master); src.start(); return { f: f, g: g };
    };
    audio.skid = loopNoise(1400, 3, 'bandpass'); audio.wind = loopNoise(500, 0.7, 'lowpass');
    const h1 = ctx.createOscillator(); h1.type = 'square'; h1.frequency.value = 415;
    const h2 = ctx.createOscillator(); h2.type = 'square'; h2.frequency.value = 523;
    const hg = ctx.createGain(); hg.gain.value = 0; h1.connect(hg); h2.connect(hg); hg.connect(audio.master); h1.start(); h2.start(); audio.horn = hg;
    setAudioProfile(cur.def ? cur.def.sound.kind : 'i4');
  } catch (e) { audio.ctx = null; }
}
function setMuted(m) {
  audio.muted = m;
  if (audio.master) audio.master.gain.setTargetAtTime(m ? 0 : audio.volume, audio.ctx.currentTime, 0.03);
  $('btnSnd').innerHTML = '<svg class="ic"><use href="#i-' + (m ? 'mute' : 'sound') + '"/></svg>';
  $('muteToggle').checked = m; savePrefs();
}
function setVolume(v) { audio.volume = clamp(v, 0, 1); if (audio.master && !audio.muted) audio.master.gain.setTargetAtTime(audio.volume, audio.ctx.currentTime, 0.03); savePrefs(); }
function noiseBurst(dur, freq, type, vol, sweepTo) {
  if (!audio.ctx || audio.muted) return;
  const c = audio.ctx, t = c.currentTime, src = c.createBufferSource(); src.buffer = audio.noise;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(audio.master); src.start(t); src.stop(t + dur + 0.05);
}
function tone(f1, f2, dur, vol, type) {
  if (!audio.ctx || audio.muted) return;
  const c = audio.ctx, t = c.currentTime, o = c.createOscillator(); o.type = type || 'sine';
  o.frequency.setValueAtTime(f1, t); if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(audio.master); o.start(t); o.stop(t + dur + 0.05);
}
function coinSound(pitch) { tone(880 * pitch, 880 * pitch, 0.09, 0.11, 'sine'); setTimeout(function () { tone(1320 * pitch, 1320 * pitch, 0.16, 0.11, 'sine'); }, 70); }
function gemSound() { tone(1200, 1800, 0.2, 0.12, 'triangle'); setTimeout(function () { tone(1800, 2400, 0.25, 0.12, 'triangle'); }, 90); }
function buySound() { [523, 659, 784, 1046].forEach(function (f, i) { setTimeout(function () { tone(f, f, 0.22, 0.13, 'triangle'); }, i * 90); }); }
function crashSound(impact) { const v = clamp(impact / 30, 0.25, 1); noiseBurst(0.4, 700, 'lowpass', 0.9 * v, 90); tone(110, 40, 0.3, 0.6 * v, 'sine'); }
function boostSound() { noiseBurst(0.9, 500, 'bandpass', 0.45, 3500); tone(300, 1000, 0.5, 0.08, 'sawtooth'); }
function jumpSound() { tone(220, 660, 0.25, 0.18, 'sine'); }
function updateAudio(input) {
  if (!audio.ctx || !audio.eng) return;
  const t = audio.ctx.currentTime, e = audio.eng, P = audio.prof, sp = Math.abs(car.speed);
  let g = 0; while (g < GEAR_TOP.length - 1 && sp > GEAR_TOP[g]) g++;
  const lo = g ? GEAR_TOP[g - 1] : 0, hi = GEAR_TOP[g];
  const rpm = clamp((sp - lo) / (hi - lo), 0, 1), throttle = input.gas > 0 ? 1 : 0;
  const ev = P.b2 === 0, rp = ev ? clamp(sp / SETTINGS.maxSpeed, 0, 1) : rpm;
  const base = P.b0 + rp * P.b1 + g * P.b2;
  e.o1.frequency.setTargetAtTime(base, t, 0.04); e.o2.frequency.setTargetAtTime(base / 2, t, 0.04);
  e.lp.frequency.setTargetAtTime(P.c0 + rp * (P.c1 - P.c0) + throttle * P.c0 * 0.5, t, 0.05);
  e.gain.gain.setTargetAtTime(P.g + throttle * P.g + rp * P.g * 0.5, t, 0.05);
  e.lfo.frequency.setTargetAtTime(Math.max(1, P.am[0] * (0.5 + rp)), t, 0.05);
  if (P.wh) { e.o3.frequency.setTargetAtTime(P.wh.f0 + (ev ? rp : rpm) * (P.wh.f1 - P.wh.f0), t, 0.05); e.wh.gain.setTargetAtTime(P.wh.g * (0.25 + throttle * 0.75) * (ev ? Math.min(1, sp / 6) : 1), t, 0.05); }
  else e.wh.gain.setTargetAtTime(0, t, 0.05);
  const braking = input.brake > 0 && car.speed > 10, cornering = Math.abs(car.steer) > 0.65 && sp > 22;
  const skid = Math.max(braking ? Math.min(1, sp / 25) : 0, cornering ? Math.min(1, (sp - 22) / 15) * Math.abs(car.steer) : 0);
  audio.skid.g.gain.setTargetAtTime(skid * 0.10, t, 0.05); audio.skid.f.frequency.setTargetAtTime(1100 + sp * 12, t, 0.1);
  audio.wind.g.gain.setTargetAtTime(Math.pow(sp / SETTINGS.maxSpeed, 2) * 0.09, t, 0.1);
  audio.horn.gain.setTargetAtTime(keys.KeyH ? 0.05 : 0, t, 0.01);
}
function silenceAudio() {
  if (!audio.ctx || !audio.eng) return;
  const t = audio.ctx.currentTime;
  audio.eng.gain.gain.setTargetAtTime(0, t, 0.05); audio.eng.wh.gain.setTargetAtTime(0, t, 0.05);
  audio.skid.g.gain.setTargetAtTime(0, t, 0.05); audio.wind.g.gain.setTargetAtTime(0, t, 0.05); audio.horn.gain.setTargetAtTime(0, t, 0.02);
}

/* ================================================================= traffic */
const traffic = [];
const trafficColors = [0x2f6fe0, 0xf2c230, 0xeeeeee, 0x2fb36b, 0x8b5cf6, 0xf28c28, 0x444b55, 0xc0392b];
function respawnTraffic(t) {
  const axis = Math.random() < 0.5 ? 'x' : 'z', dir = Math.random() < 0.5 ? 1 : -1;
  const off = axis === 'z' ? (dir > 0 ? -4 : 4) : (dir > 0 ? 4 : -4);
  const ahead = (Math.random() < 0.5 ? 1 : -1) * (110 + Math.random() * 150);
  t.axis = axis; t.dir = dir;
  if (axis === 'z') { const k = Math.round(car.x / CHUNK) + Math.floor(Math.random() * 3) - 1; t.x = k * CHUNK + off; t.z = car.z + ahead; t.heading = dir > 0 ? 0 : Math.PI; }
  else { const k = Math.round(car.z / CHUNK) + Math.floor(Math.random() * 3) - 1; t.z = k * CHUNK + off; t.x = car.x + ahead; t.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  t.speed = 9 + Math.random() * 12;
}
function syncTrafficCount() {
  const want = Q.trafficCars;
  while (traffic.length < want) {
    const kinds = K.trafficKinds, mesh = K.makeTraffic(kinds[traffic.length % kinds.length], trafficColors[traffic.length % trafficColors.length]);
    scene.add(mesh);
    const t = { mesh: mesh, x: 0, z: 0, heading: 0, speed: 10, axis: 'z', dir: 1, r: (mesh.userData.kind === 'van' ? 2.3 : 1.9) };
    respawnTraffic(t); traffic.push(t);
  }
  while (traffic.length > want) scene.remove(traffic.pop().mesh);
}
function updateTraffic(dt) {
  for (let i = 0; i < traffic.length; i++) {
    const t = traffic[i];
    if (t.axis === 'z') t.z += t.dir * t.speed * dt; else t.x += t.dir * t.speed * dt;
    if (Math.hypot(t.x - car.x, t.z - car.z) > 330) respawnTraffic(t);
    t.mesh.position.set(t.x, 0, t.z); t.mesh.rotation.y = t.heading;
    const sp = t.mesh.userData.spins;
    for (let k = 0; k < sp.length; k++) sp[k].rotation.x += sp[k].userData.dir * t.speed * dt / sp[k].userData.r;
  }
}
function collideTraffic() {
  let impact = 0;
  for (let i = 0; i < traffic.length; i++) {
    const t = traffic[i], dx = car.x - t.x, dz = car.z - t.z, d = Math.hypot(dx, dz), minD = cur.phys.R + t.r;
    if (d < minD && car.y < 1.5) {
      const n = d < 1e-4 ? 1 : d, nx = d < 1e-4 ? 1 : dx / n, nz = d < 1e-4 ? 0 : dz / n;
      car.x += nx * (minD - n); car.z += nz * (minD - n);
      impact = Math.max(impact, resolveHit(nx, nz) + 3);
      car.speed *= 1 - (1 - cur.phys.tough) * 0.3;
    }
  }
  return impact;
}

/* ================================================================== physics */
function stepCar(dt, input) {
  if (boost.cooldown > 0) boost.cooldown = Math.max(0, boost.cooldown - dt);
  const S = SETTINGS, boosting = boost.t > 0, maxV = S.maxSpeed * (boosting ? 1.5 : 1);
  if (input.gas > 0) { const room = 1 - clamp(car.speed / maxV, 0, 1); car.speed += S.acceleration * (boosting ? 2.65 : 1) * input.gas * room * dt; }
  if (input.brake > 0) { if (car.speed > 0.5) car.speed -= S.brakePower * input.brake * dt; else car.speed -= 12 * input.brake * dt; }
  if (input.gas <= 0 && input.brake <= 0) { const drag = 5 * dt; if (Math.abs(car.speed) <= drag) car.speed = 0; else car.speed -= Math.sign(car.speed) * drag; }
  if (boosting) { boost.t -= dt; car.speed = Math.max(car.speed, Math.min(maxV * 0.9, car.speed + 22 * dt)); }
  else if (car.speed > S.maxSpeed) car.speed = Math.max(S.maxSpeed, car.speed - 12 * dt);
  car.speed = clamp(car.speed, -10, maxV);
  car.steer += (input.steer - car.steer) * Math.min(1, dt * 10);
  const grip = car.airborne ? 0.2 : Math.min(1, Math.abs(car.speed) / 6) / (1 + Math.abs(car.speed) / (0.83 * S.maxSpeed));
  car.heading -= car.steer * S.turnSpeed * grip * (car.speed >= 0 ? 1 : -1) * dt;
  if (car.airborne) {
    car.vy -= S.gravity * dt; car.y += car.vy * dt; car.air += dt;
    car.trickSpin += Math.abs(car.steer) * dt * 40;
    const gy = groundHeightAt(car.x, car.z);
    if (car.y <= gy) { car.y = gy; landed(); }
  } else {
    // Not airborne: stick to whatever is directly underfoot (road, or a building roof
    // we drove/landed onto). If that surface drops away (walked off a roof edge), fall.
    const gy = groundHeightAt(car.x, car.z);
    if (car.y > gy + 0.05) { car.airborne = true; car.air = 0; car.trickSpin = 0; }
    else car.y = gy;
  }
  stats.dist += Math.abs(car.speed) * dt;
  stats.top = Math.max(stats.top, Math.abs(car.speed));
  if (stats.top > save.bestSpeed) save.bestSpeed = stats.top;
}
function landed() {
  const hard = -car.vy; car.vy = 0; car.airborne = false;
  if (car.air > 0.5) {
    const airBonus = 10 + Math.floor(car.air * 12), trickBonus = Math.floor(Math.min(40, car.trickSpin));
    addCoins(airBonus + trickBonus, trickBonus > 6 ? 'Trick + air bonus' : 'Jump bonus'); sparksAt(car.x, 0.3, car.z, 10);
    for (let i = 0; i < 8; i++) emit(car.x + (Math.random() - 0.5) * 3, 0.3, car.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, 1 + Math.random() * 2, (Math.random() - 0.5) * 4, 1.4, 3, 0.8, cDust, 0.5, 0, 0);
    shake = Math.min(1, hard / 18);
  }
  car.air = 0; car.trickSpin = 0;
}
/* ============================================================ collision (rewritten) */
// Building roofs (and, if we ever add one, another collider's flat top) double as
// walkable ground: whatever the highest box-collider roof under (x,z) is, or 0.
function groundHeightAt(x, z) {
  let top = 0;
  const cand = queryGrid(x, z, 24);
  for (let i = 0; i < cand.length; i++) {
    const c = cand[i];
    if (c.hw === undefined || c.ramp) continue;   // a ramp's own incline (not a flat roof) is handled by checkRamps
    if (x > c.x - c.hw && x < c.x + c.hw && z > c.z - c.hd && z < c.z + c.hd && c.h > top) top = c.h;
  }
  return top;
}
// Segment (x0,z0)->(x0+dx,z0+dz), t in [0,1], vs an axis-aligned box. Returns the
// entry t, or null if it never enters. (Building colliders arrive pre-expanded by R.)
function segmentVsBox(x0, z0, dx, dz, minX, maxX, minZ, maxZ) {
  let tmin = 0, tmax = 1;
  if (Math.abs(dx) < 1e-9) { if (x0 < minX || x0 > maxX) return null; }
  else {
    let t1 = (minX - x0) / dx, t2 = (maxX - x0) / dx; if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return null;
  }
  if (Math.abs(dz) < 1e-9) { if (z0 < minZ || z0 > maxZ) return null; }
  else {
    let t1 = (minZ - z0) / dz, t2 = (maxZ - z0) / dz; if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2); if (tmin > tmax) return null;
  }
  return tmin < 0 ? 0 : tmin;
}
function segmentVsCircle(x0, z0, dx, dz, cx, cz, rad) {
  const fx = x0 - cx, fz = z0 - cz, a = dx * dx + dz * dz, b = 2 * (fx * dx + fz * dz), cc = fx * fx + fz * fz - rad * rad;
  if (a < 1e-9) return cc <= 0 ? 0 : null;
  const disc = b * b - 4 * a * cc; if (disc < 0) return null;
  const sq = Math.sqrt(disc); let t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a); if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
  if (t2 < 0 || t1 > 1) return null;
  return t1 < 0 ? 0 : t1;
}
// Earliest thing the car (a circle of radius R) would hit travelling from (x0,z0) to
// (x1,z1) this substep. This is the actual continuous/swept test: it looks at the
// whole path, not just the end point, so nothing can tunnel through at any speed.
function findEarliestHit(x0, z0, x1, z1) {
  const R = cur.phys.R, dx = x1 - x0, dz = z1 - z0;
  const midx = (x0 + x1) / 2, midz = (z0 + z1) / 2, margin = Math.hypot(dx, dz) / 2 + R + 22;
  const cand = queryGrid(midx, midz, margin);
  let best = null;
  for (let i = 0; i < cand.length; i++) {
    const c = cand[i];
    if (car.y >= c.h) continue; // above the roof/canopy: flying over, not colliding
    if (c.ramp) {
      // The swept path can enter the ramp envelope between x0 and x1.
      // Ignore the ramp collider for that whole transition so the car can
      // actually cross onto the incline instead of getting stopped at its edge.
      const r = c.ramp, p0 = rampProgress(r, x0, z0), p1 = rampProgress(r, x1, z1);
      if (segmentVsBox(
        p0.along, p0.across,
        p1.along - p0.along, p1.across - p0.across,
        -3.6, r.length + 3.6,
        -r.halfWidth - 1.3, r.halfWidth + 1.3
      ) !== null) continue;
    } // properly riding / entering it
    let t;
    if (c.hw !== undefined) t = segmentVsBox(x0, z0, dx, dz, c.x - c.hw - R, c.x + c.hw + R, c.z - c.hd - R, c.z + c.hd + R);
    else t = segmentVsCircle(x0, z0, dx, dz, c.x, c.z, c.r + R);
    if (t === null || (best && t >= best.t)) continue;
    const hx = x0 + dx * t, hz = z0 + dz * t;
    let nx, nz;
    if (c.hw !== undefined) {
      const px = clamp(hx, c.x - c.hw, c.x + c.hw), pz = clamp(hz, c.z - c.hd, c.z + c.hd);
      let ddx = hx - px, ddz = hz - pz, dd = Math.hypot(ddx, ddz);
      if (dd < 1e-6) { ddx = hx - c.x; ddz = hz - c.z; dd = Math.hypot(ddx, ddz) || 1; }
      nx = ddx / dd; nz = ddz / dd;
    } else { let ddx = hx - c.x, ddz = hz - c.z, dd = Math.hypot(ddx, ddz) || 1; nx = ddx / dd; nz = ddz / dd; }
    best = { t: t, nx: nx, nz: nz };
  }
  return best;
}
// Speed response to a wall hit: only kills the velocity component pointing INTO the
// surface, so a head-on hit stops the car hard but a glancing hit barely slows it down
// at all - i.e. sliding along a wall instead of grinding to a halt against it.
function resolveHit(nx, nz) {
  const tough = cur.phys.tough, wallF = lerp(0.86, 0.95, tough), R = cur.phys.R;
  const sgn = car.speed >= 0 ? 1 : -1, vheadx = Math.sin(car.heading) * sgn, vheadz = Math.cos(car.heading) * sgn;
  const into = clamp(-(vheadx * nx + vheadz * nz), 0, 1);
  const impact = Math.abs(car.speed) * into;
  car.speed *= lerp(1, wallF, into);
  if (impact > 5 && crashCool <= 0) sparksAt(car.x - nx * R, 0.7, car.z - nz * R, Math.round(6 + into * 8));
  return impact;
}
function sweepAndResolve(dirx, dirz, stepLen) {
  if (stepLen <= 1e-6) return 0;
  const x0 = car.x, z0 = car.z, x1 = car.x + dirx * stepLen, z1 = car.z + dirz * stepLen;
  const hit = findEarliestHit(x0, z0, x1, z1);
  if (!hit) { car.x = x1; car.z = z1; return 0; }
  const travel = Math.max(0, hit.t * stepLen - 0.02);
  car.x = x0 + dirx * travel; car.z = z0 + dirz * travel;
  return resolveHit(hit.nx, hit.nz);
}
// Discrete overlap resolver: run after every swept substep as a safety net, and also
// the thing that actually fixes "car ends up inside a building" - if the car's centre
// is genuinely inside a box (e.g. it spawned there, or floating-point edge cases),
// this pushes it out the NEAREST side (minimum penetration), never a fixed direction.
function collide() {
  const R = cur.phys.R;
  let impact = 0;
  const cand = queryGrid(car.x, car.z, R + 22);
  for (let i = 0; i < cand.length; i++) {
    const c = cand[i];
    if (car.y >= c.h) continue;
    if (c.ramp && inRampEnvelope(c.ramp, car.x, car.z)) continue;
    if (c.hw !== undefined) {
      const px = clamp(car.x, c.x - c.hw, c.x + c.hw), pz = clamp(car.z, c.z - c.hd, c.z + c.hd);
      const dx = car.x - px, dz = car.z - pz, dist = Math.hypot(dx, dz);
      if (dist > 1e-6) {
        if (dist < R) {
          const nx = dx / dist, nz = dz / dist;
          impact = Math.max(impact, resolveHit(nx, nz));
          car.x += nx * (R - dist); car.z += nz * (R - dist);
        }
      } else {
        const penX = c.hw + R - Math.abs(car.x - c.x), penZ = c.hd + R - Math.abs(car.z - c.z);
        if (penX < penZ) { const s = (car.x - c.x) >= 0 ? 1 : -1; car.x += s * penX; impact = Math.max(impact, resolveHit(s, 0)); }
        else { const s = (car.z - c.z) >= 0 ? 1 : -1; car.z += s * penZ; impact = Math.max(impact, resolveHit(0, s)); }
      }
    } else {
      let dx = car.x - c.x, dz = car.z - c.z, dist = Math.hypot(dx, dz); if (dist < 1e-6) { dx = 1; dz = 0; dist = 1; }
      const minDist = R + c.r;
      if (dist < minDist) { const nx = dx / dist, nz = dz / dist; car.x += nx * (minDist - dist); car.z += nz * (minDist - dist); impact = Math.max(impact, resolveHit(nx, nz)); }
    }
  }
  return impact;
}
function moveCar(dt) {
  let impact = collide();
  const dist = Math.abs(car.speed) * dt;
  if (dist < 1e-6) return impact;
  const stepLen = 1.2, n = Math.max(1, Math.ceil(dist / stepLen)), sub = dist / n;
  const sgn = car.speed >= 0 ? 1 : -1, dirx = Math.sin(car.heading) * sgn, dirz = Math.cos(car.heading) * sgn;
  for (let i = 0; i < n; i++) {
    impact = Math.max(impact, sweepAndResolve(dirx, dirz, sub));
    impact = Math.max(impact, collide());
  }
  return impact;
}
/* ---------------------------------------------------------------------- ramps */
// Real geometry: while grounded and inside a ramp's footprint the car's height follows
// the incline exactly; crossing the lip with enough speed launches it, with the launch
// angle and vertical speed both derived from the ramp's actual slope and the car's speed.
function checkRamps(dt) {
  if (car.airborne) return;
  for (let i = 0; i < activeRamps.length; i++) {
    const r = activeRamps[i], p = rampProgress(r, car.x, car.z), width = r.halfWidth + 0.65;
    if (p.along < -2.0 || p.along > r.length + 2.2 || Math.abs(p.across) > width) { if (car.onRamp === r) car.onRamp = null; continue; }
    if (p.along < r.length) {
      const target = rampHeightAt(r, p.along); car.y += (target - car.y) * Math.min(1, dt * 18); if (Math.abs(car.y - target) < 0.035) car.y = target;
      if (car.onRamp !== r) { car.onRamp = r; boost.t = Math.max(boost.t, 0.55); boostSound(); }
      const slope = (rampHeightAt(r, p.along + 0.08) - rampHeightAt(r, Math.max(0, p.along - 0.08))) / 0.16;
      car.speed += (7 + r.sizeIndex * 5) * (car.speed >= 0 ? 1 : -1) * dt; car.speed += Math.sin(Math.atan(slope)) * 3 * dt; continue;
    }
    if (car.onRamp !== r) continue;
    car.onRamp = null; const vx = Math.sin(car.heading) * car.speed, vz = Math.cos(car.heading) * car.speed, fwdSpeed = (r.axis === 'x' ? vx : vz) * r.dir;
    if (fwdSpeed <= 2.5) { car.y = r.rise; continue; }
    const eps = 0.08, slope = (rampHeightAt(r, r.length) - rampHeightAt(r, r.length - eps)) / eps, angle = Math.atan(slope), launchK = 0.92 + r.sizeIndex * 0.08;
    car.y = r.rise; car.vy = Math.max(SETTINGS.jumpPower * 0.55, fwdSpeed * Math.sin(angle) * launchK * cur.phys.jump);
    car.speed = Math.sign(car.speed || 1) * Math.min(Math.abs(car.speed) + r.boostAdd, SETTINGS.maxSpeed * 1.45); car.airborne = true; car.air = 0; car.trickSpin = 0; boost.t = Math.max(boost.t, 0.9);
    stats.jumps++; jumpSound(); boostSound();
    for (let k = 0; k < 14; k++) emit(car.x + (Math.random() - 0.5) * 3, r.rise * 0.45 + 0.25, car.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3.5, 1 + Math.random() * 2.2, (Math.random() - 0.5) * 3.5, 0.6, -0.3, 0.5, cSpark, 0.8, 1, 6);
  }
}
let crashCool = 0, shake = 0;
function handleImpact(impact, dt) {
  crashCool -= dt; shake = Math.max(0, shake - dt * 2.5);
  if (impact > 4 && crashCool <= 0) { crashCool = 0.35; shake = Math.min(1, impact / 25); crashSound(impact); }
}

/* --- coins, gems, combo --- */
const combo = { chain: 0, last: -99, mult: 1 };
let gainTimer = 0, gainSum = 0;
function updateWallet() {
  const t = save.coins.toLocaleString();
  $('menuWallet').lastElementChild.textContent = t; $('gWallet').lastElementChild.textContent = t; hudLast.coins = null; $('coins').textContent = t;
}
function addCoins(n, label) {
  save.coins += n; stats.coins += n; updateWallet(); savePrefs();
  gainSum += n; gainTimer = 1.2;
  const em = $('coinGain'); em.textContent = '+' + gainSum; em.classList.add('show');
  if (label) toast(label + ' <b>+' + n + '</b>');
}
function toast(html, cls) {
  const el = document.createElement('div'); el.className = cls ? 'toast ' + cls : 'toast'; el.innerHTML = html; $('toasts').appendChild(el);
  while ($('toasts').children.length > 3) $('toasts').removeChild($('toasts').firstChild);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, cls === 'cheat' ? 3000 : 2300);
}

/* ============================================================== cheat codes */
// GTA-style: type a vehicle's name (or id) while playing and it instantly unlocks
// and becomes your ride, plus a handful of bonus words. Keystrokes feed a small
// rolling buffer that auto-clears after a pause, and every keystroke re-checks it
// against every known target - so the match fires the moment enough of a name
// has been typed, the same way the classic GTA cheat prompt behaves.
function cheatName(s) { return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
const CHEAT_EXTRA = [
  { code: 'GIVEMECASH', run: function () { save.coins += 5000; updateWallet(); savePrefs(); toast('Cheat activated: <b>+5000 coins</b>', 'cheat'); } },
  { code: 'UNLOCKALL', run: function () { defs.forEach(function (d) { if (!isOwned(d.id)) save.owned.push(d.id); }); savePrefs(); toast('Cheat activated: <b>All vehicles unlocked</b>', 'cheat'); } },
  { code: 'NIGHTTIME', run: function () { sky.frozen = true; sky.t = 0.84; toast('Cheat activated: <b>Night time</b>', 'cheat'); } },
  { code: 'DAYTIME', run: function () { sky.frozen = true; sky.t = 0.3; toast('Cheat activated: <b>Day time</b>', 'cheat'); } }
];
// All valid cheat targets, built once: every vehicle's uppercased name AND id (so
// both "SPECTRE" and "SPECTREX" - from "Spectre X" - work), plus the bonus words.
let CHEAT_CODES = null;
function allCheatCodes() {
  if (!CHEAT_CODES) {
    CHEAT_CODES = [];
    defs.forEach(function (d) { [cheatName(d.name), cheatName(d.id)].forEach(function (c) { if (c.length >= 3 && CHEAT_CODES.indexOf(c) < 0) CHEAT_CODES.push(c); }); });
    CHEAT_EXTRA.forEach(function (c) { CHEAT_CODES.push(c.code); });
  }
  return CHEAT_CODES;
}
function isCheatPrefix(buf) { if (!buf) return false; const codes = allCheatCodes(); for (let i = 0; i < codes.length; i++) if (codes[i].indexOf(buf) === 0) return true; return false; }
let cheatBuf = '', cheatClearT = null, garageHotkeyTimer = null;
function armCheatClear() { if (cheatClearT) clearTimeout(cheatClearT); cheatClearT = setTimeout(function () { cheatBuf = ''; }, 2500); }
function tryCheat() {
  for (let i = 0; i < defs.length; i++) {
    const d = defs[i], hit = [cheatName(d.name), cheatName(d.id)];
    for (let j = 0; j < hit.length; j++) {
      const code = hit[j];
      if (code.length >= 3 && cheatBuf === code) {
        if (!isOwned(d.id)) save.owned.push(d.id);
        save.selected = d.id; setVehicle(d.id); savePrefs(); flushPrefs();
        toast('Cheat activated: <b>' + d.name + '</b> unlocked', 'cheat');
        cheatBuf = '';
        return;
      }
    }
  }
  for (let i = 0; i < CHEAT_EXTRA.length; i++) {
    if (cheatBuf === CHEAT_EXTRA[i].code) { CHEAT_EXTRA[i].run(); cheatBuf = ''; return; }
  }
}
// Feeds one typed character into the rolling cheat buffer and reports whether it was
// claimed as part of an in-progress code match (buffer was already non-empty AND the
// extended buffer is still a valid prefix of some code). The keydown handler uses this
// to decide whether to also fire a same-letter gameplay hotkey (R/G/Z/C/F/M/P): a bare
// first keystroke still works as its normal hotkey (so single-tap shortcuts keep
// working), but a letter that continues a word already being typed does not, so typing
// a vehicle name like "SPECTRE" isn't interrupted by the P hotkey partway through.
function feedCheat(ch) {
  const hadBuf = cheatBuf.length > 0;
  const extended = (cheatBuf + ch).slice(-24);
  if (isCheatPrefix(extended)) { cheatBuf = extended; armCheatClear(); tryCheat(); return hadBuf; }
  if (isCheatPrefix(ch)) { cheatBuf = ch; armCheatClear(); tryCheat(); return false; }
  cheatBuf = ''; return false;
}
function updateCoins(dt) {
  const tnow = performance.now() / 1000;
  chunks.forEach(function (ch) { ch.coins.forEach(function (c) { if (c.mesh.visible) { c.mesh.rotation.y += dt * (c.gem ? 1.8 : 2.8); if (c.gem) c.mesh.position.y = 1.9 + Math.sin(tnow * 3) * 0.2; } }); });
  const rr = cur.phys.R + 1.9;
  for (let i = activeCoins.length - 1; i >= 0; i--) {
    const c = activeCoins[i];
    if (!c.mesh.visible) continue;
    if (Math.hypot(car.x - c.x, car.z - c.z) < rr && car.y < 3) {
      c.mesh.visible = false; collectedCoins.add(c.id); activeCoins.splice(i, 1);
      if (tnow - combo.last < 2.5) combo.chain++; else combo.chain = 1;
      combo.last = tnow; combo.mult = combo.chain >= 25 ? 3 : combo.chain >= 10 ? 2 : 1;
      addCoins(c.v * combo.mult);
      if (c.gem) { gemSound(); toast('Gem <b>+' + c.v * combo.mult + '</b>'); } else coinSound(1 + Math.min(0.5, combo.chain * 0.02));
      for (let k = 0; k < 6; k++) emit(c.x, 1.6, c.z, (Math.random() - 0.5) * 5, 1 + Math.random() * 3, (Math.random() - 0.5) * 5, 0.35, -0.2, 0.5, c.gem ? cGem : cGold, 1, 1, 8);
    }
  }
  if (combo.chain > 0 && tnow - combo.last > 2.5) combo.chain = 0;
  const on = combo.chain >= 5;
  if (hudLast.combo !== (on ? combo.mult + ':' + combo.chain : 0)) {
    hudLast.combo = on ? combo.mult + ':' + combo.chain : 0;
    $('combo').classList.toggle('on', on); if (on) $('comboX').textContent = 'x' + combo.mult + ' ' + combo.chain;
  }
  if (gainTimer > 0) { gainTimer -= dt; if (gainTimer <= 0) { gainSum = 0; $('coinGain').classList.remove('show'); } }
}
function updatePads(dt) {
  for (let i = 0; i < activePads.length; i++) {
    const p = activePads[i];
    if (p.cool > 0) { p.cool -= dt; continue; }
    if (Math.hypot(car.x - p.x, car.z - p.z) < 5) { p.cool = 3; boost.t = 2.4; boostSound(); }
  }
}

/* ================================================================== camera */
function placeCamera(snap, dt) {
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading), cm = cur.def.cam;
  const back = cm.back + clamp(car.speed, 0, SETTINGS.maxSpeed) * 0.05 + boost.visual * 2;
  const tx = car.x - fx * back, tz = car.z - fz * back, ty = cm.up + car.y * 0.5, k = snap ? 1 : 1 - Math.pow(0.0001, dt);
  const kY = snap ? 1 : (car.airborne ? 1 - Math.pow(0.02, dt) : k); // gentler vertical follow in the air: less yo-yo over jumps
  camPos.x += (tx - camPos.x) * k; camPos.y += (ty - camPos.y) * kY; camPos.z += (tz - camPos.z) * k;

  // Smoothed "wander" replaces raw per-frame random jitter: a target offset is re-rolled
  // every 45ms and eased toward, so camera shake reads as a handheld wobble, not static noise.
  if (snap) { shakeTimer = 0; shakeOff.x = shakeOff.y = shakeOff.z = shakeTarget.x = shakeTarget.y = shakeTarget.z = 0; }
  shakeTimer -= dt || 0;
  if (shakeTimer <= 0) { shakeTimer = 0.045; shakeTarget.x = Math.random() - 0.5; shakeTarget.y = Math.random() - 0.5; shakeTarget.z = Math.random() - 0.5; }
  const sk = snap ? 1 : Math.min(1, (dt || 0) * 16);
  shakeOff.x += (shakeTarget.x - shakeOff.x) * sk; shakeOff.y += (shakeTarget.y - shakeOff.y) * sk; shakeOff.z += (shakeTarget.z - shakeOff.z) * sk;
  camera.position.set(camPos.x + shakeOff.x * shake * 0.9, camPos.y + shakeOff.y * shake * 0.6, camPos.z + shakeOff.z * shake * 0.9);

  // The look target tracks the car's heading directly, with no lag and no sideways lean:
  // steering - and especially drifting - depends on the view always pointing exactly where
  // the car is pointed right now. An eased/leaning look target was tried here and made
  // cornering feel disconnected and imprecise, so this stays an instant lookAt like before;
  // only the camera's own position (above) and its shake (below) are smoothed.
  camLook.set(car.x + fx * 8, 1.8 + car.y * 0.6, car.z + fz * 8);
  camera.lookAt(camLook);

  const speedT = clamp(Math.abs(car.speed) / SETTINGS.maxSpeed, 0, 1.4);
  const targetFov = 66 + speedT * 14 + boost.visual * 8;
  if (Math.abs(camera.fov - targetFov) > 0.05) { camera.fov += (targetFov - camera.fov) * (snap ? 1 : Math.min(1, dt * 4)); camera.updateProjectionMatrix(); }
}

/* =============================================================== photo mode */
// A free-look orbit camera around the parked car: physics and the vehicle's own
// idle animation are frozen, the player drags to orbit and scrolls to zoom, and
// S saves a PNG straight from the canvas. P toggles it, Esc backs out of it.
const photo = { yaw: 0, pitch: 0.28, dist: 9, dragging: false, lastX: 0, lastY: 0 };
function enterPhotoMode() {
  if (!state.playing || state.garage || state.paused || state.photo) return;
  state.photo = true;
  photo.yaw = car.heading + Math.PI; photo.pitch = 0.28; photo.dist = cur.def.cam.back + 4;
  $('hud').style.visibility = 'hidden'; $('bottomLeft').style.display = 'none';
  const bar = $('photoBar'); if (bar) bar.classList.add('on');
  silenceAudio();
}
function exitPhotoMode() {
  if (!state.photo) return;
  state.photo = false;
  $('hud').style.visibility = ''; if (prefs.showCam && gesture.on) $('bottomLeft').style.display = '';
  const bar = $('photoBar'); if (bar) bar.classList.remove('on');
  placeCamera(true, 0);
}
function photoCamera() {
  const cx = car.x, cy = 1.6 + car.y, cz = car.z;
  const cp = Math.cos(photo.pitch), sx = Math.sin(photo.yaw) * cp, sz = Math.cos(photo.yaw) * cp, sy = Math.sin(photo.pitch);
  camera.position.set(cx + sx * photo.dist, cy + sy * photo.dist + 1.2, cz + sz * photo.dist);
  camera.lookAt(cx, cy, cz);
  if (Math.abs(camera.fov - 52) > 0.05) { camera.fov += (52 - camera.fov) * 0.12; camera.updateProjectionMatrix(); }
}
canvas.addEventListener('pointerdown', function (e) { if (!state.photo) return; photo.dragging = true; photo.lastX = e.clientX; photo.lastY = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (x) {} });
canvas.addEventListener('pointermove', function (e) {
  if (!state.photo || !photo.dragging) return;
  photo.yaw -= (e.clientX - photo.lastX) * 0.006; photo.pitch = clamp(photo.pitch - (e.clientY - photo.lastY) * 0.006, -0.95, 1.2);
  photo.lastX = e.clientX; photo.lastY = e.clientY;
});
window.addEventListener('pointerup', function () { photo.dragging = false; });
canvas.addEventListener('wheel', function (e) { if (!state.photo) return; e.preventDefault(); photo.dist = clamp(photo.dist + e.deltaY * 0.01, 3, 24); }, { passive: false });
function savePhoto() {
  try {
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a'); a.href = url; a.download = 'gesturedrive-' + Date.now() + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('Photo saved');
  } catch (e) { toast('Could not save photo'); }
}

/* ============================================================ hand tracking (MediaPipe) */
const HAND_LINES = [
  [0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]
];

const gesture = {
  landmarker: null, video: null, on: false, lastTime: -1, lastDetect: 0,
  hands: 0, steer: 0, gas: 0, brake: 0, lastBoth: 0, angleDeg: 0
};

function pdist(a, b, vw, vh) { return Math.hypot((a.x - b.x) * vw, (a.y - b.y) * vh); }
function indexUp(lm, vw, vh) {
  return pdist(lm[0], lm[8], vw, vh) > pdist(lm[0], lm[5], vw, vh) * SETTINGS.fingerRatio;
}
function analyzeHands(hands, vw, vh) {
  const out = { count: hands.length, both: false, angleDeg: 0, steer: 0, gas: false, brake: false };
  if (!hands.length) return out;
  const list = hands.map(function (lm) { return { lm: lm, mx: 1 - lm[0].x }; });
  list.sort(function (a, b) { return a.mx - b.mx; });
  if (list.length >= 2) {
    const L = list[0], R = list[list.length - 1];
    const dx = (R.mx - L.mx) * vw;
    const dy = (R.lm[0].y - L.lm[0].y) * vh;
    let deg = Math.atan2(dy, dx) * 180 / Math.PI;
    if (deg > 90) deg -= 180;
    if (deg < -90) deg += 180;
    out.both = true;
    out.angleDeg = deg;
    const dz = SETTINGS.steerDeadzoneDeg, full = SETTINGS.steerFullDeg;
    const mag = Math.max(0, Math.abs(deg) - dz) / (full - dz);
    out.steer = Math.sign(deg) * Math.min(1, mag);
    out.gas = indexUp(R.lm, vw, vh);
    out.brake = indexUp(L.lm, vw, vh);
  } else {
    const h = list[0];
    if (h.mx >= 0.5) out.gas = indexUp(h.lm, vw, vh);
    else out.brake = indexUp(h.lm, vw, vh);
  }
  return out;
}
function drawOverlay(hands) {
  const cv = $('camOverlay'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  g.lineWidth = 4;
  hands.forEach(function (lm) {
    g.strokeStyle = '#3cff7a';
    HAND_LINES.forEach(function (p) {
      g.beginPath();
      g.moveTo((1 - lm[p[0]].x) * W, lm[p[0]].y * H);
      g.lineTo((1 - lm[p[1]].x) * W, lm[p[1]].y * H);
      g.stroke();
    });
    g.fillStyle = '#ff3b3b';
    lm.forEach(function (pt) {
      g.beginPath(); g.arc((1 - pt.x) * W, pt.y * H, 5, 0, 6.283); g.fill();
    });
  });
  if (hands.length >= 2) {
    const sorted = hands.slice().sort(function (a, b) { return (1 - a[0].x) - (1 - b[0].x); });
    const a = sorted[0][0], b = sorted[sorted.length - 1][0];
    g.strokeStyle = '#ffd86b'; g.lineWidth = 6;
    g.beginPath(); g.moveTo((1 - a.x) * W, a.y * H); g.lineTo((1 - b.x) * W, b.y * H); g.stroke();
  }
}
function updateGesture(now) {
  const v = gesture.video;
  if (!gesture.on || !gesture.landmarker || !v || v.readyState < 2) return;
  if (v.currentTime === gesture.lastTime) return;
  gesture.lastTime = v.currentTime;
  if (Q.gestureIntervalMs && now - gesture.lastDetect < Q.gestureIntervalMs) return;
  gesture.lastDetect = now;
  let result;
  try { result = gesture.landmarker.detectForVideo(v, now); } catch (e) { return; }
  const hands = (result && result.landmarks) || [];
  const a = analyzeHands(hands, v.videoWidth || 640, v.videoHeight || 480);
  gesture.hands = a.count;
  gesture.gas = a.gas ? 1 : 0;
  gesture.brake = a.brake ? 1 : 0;
  if (a.both) {
    gesture.steer += (a.steer - gesture.steer) * 0.6;
    gesture.angleDeg = a.angleDeg;
    gesture.lastBoth = now;
  } else if (now - gesture.lastBoth > 500) {
    gesture.steer = 0;
  }
  drawOverlay(hands);
  let msg;
  if (a.count === 0) msg = 'No hands seen - raise both hands';
  else if (!a.both) msg = 'One hand seen - show both hands to steer';
  else msg = 'Steering ' + (a.angleDeg >= 0 ? '+' : '') + Math.round(a.angleDeg) + '°';
  $('gstatus').textContent = msg;
}
async function startHandTracking(setMsg) {
  setMsg('Waiting for camera permission... click Allow.');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: Q.camWidth }, height: { ideal: Q.camHeight }, frameRate: { ideal: Q.camFPS }, facingMode: 'user' },
    audio: false
  });
  const v = $('camVideo');
  v.srcObject = stream;
  await v.play();
  if (v.videoWidth) {
    $('camWrap').style.aspectRatio = v.videoWidth + ' / ' + v.videoHeight;
    $('camOverlay').width = v.videoWidth;
    $('camOverlay').height = v.videoHeight;
  }
  setMsg('Loading hand tracking... (first time takes 5-15 seconds)');
  const vision = await import(MEDIAPIPE_JS);
  const files = await vision.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
  function opts(delegate) {
    return {
      baseOptions: { modelAssetPath: HAND_MODEL, delegate: delegate },
      runningMode: 'VIDEO', numHands: 2,
      minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5
    };
  }
  try { gesture.landmarker = await vision.HandLandmarker.createFromOptions(files, opts('GPU')); }
  catch (e) { gesture.landmarker = await vision.HandLandmarker.createFromOptions(files, opts('CPU')); }
  gesture.video = v;
  gesture.on = true;
}


/* ============================================================ settings menu */
function syncSettingsUI() {
  $('volSlider').value = Math.round(audio.volume * 100);
  $('volVal').textContent = Math.round(audio.volume * 100) + '%';
  $('muteToggle').checked = audio.muted;
  $('steerSlider').value = prefs.steerSensitivity;
  $('steerVal').textContent = prefs.steerSensitivity + '%';
  $('gestureSlider').value = prefs.gestureSensitivity;
  $('gestureVal').textContent = prefs.gestureSensitivity + '%';
  $('autoToggleSettings').checked = prefs.autoAccel;
  $('auto').checked = prefs.autoAccel;
  $('camToggle').checked = prefs.showCam;
  $('qualitySelect').value = prefs.quality;
  $('fpsToggle').checked = prefs.showFps;
  updateQualityHint();
}
function openSettings() {
  if (!state.playing || state.paused) return;
  state.paused = true;
  silenceAudio();
  syncSettingsUI();
  $('settingsMenu').style.display = 'flex';
}
function closeSettings() {
  $('settingsMenu').style.display = 'none';
  if (state.paused) { state.paused = false; lastT = performance.now(); }
  if (audio.ctx && audio.ctx.state === 'suspended' && audio.ctx.resume) audio.ctx.resume();
  flushPrefs();
  renderDirty = true;
}

$('btnGear').addEventListener('click', function () {
  if (state.paused) closeSettings(); else openSettings();
});
$('btnResume').addEventListener('click', closeSettings);
$('btnRestartCar').addEventListener('click', function () { resetCar(); closeSettings(); });
$('volSlider').addEventListener('input', function () {
  const pct = Number(this.value);
  $('volVal').textContent = pct + '%';
  setVolume(pct / 100);
  if (pct > 0 && audio.muted) setMuted(false);
});
$('muteToggle').addEventListener('change', function () { setMuted(this.checked); });

$('steerSlider').addEventListener('input', function () {
  const pct = Number(this.value);
  $('steerVal').textContent = pct + '%';
  applySteerSensitivity(pct);
});
$('gestureSlider').addEventListener('input', function () {
  const pct = Number(this.value);
  $('gestureVal').textContent = pct + '%';
  applyGestureSensitivity(pct);
});

function setAutoAccel(v) {
  prefs.autoAccel = v;
  $('auto').checked = v;
  $('autoToggleSettings').checked = v;
  savePrefs();
}
$('autoToggleSettings').addEventListener('change', function () { setAutoAccel(this.checked); });
$('auto').addEventListener('change', function () { setAutoAccel(this.checked); });

$('camToggle').addEventListener('change', function () {
  prefs.showCam = this.checked;
  $('bottomLeft').style.display = (this.checked && gesture.on) ? '' : 'none';
  savePrefs();
});

$('qualitySelect').addEventListener('change', function () {
  applyQuality(this.value);
  savePrefs();
});
$('fpsToggle').addEventListener('change', function () {
  prefs.showFps = this.checked;
  $('fpsBadge').style.display = this.checked ? 'block' : 'none';
  savePrefs();
});

const rootEl = document.documentElement;
if (!rootEl.requestFullscreen) $('btnFull').style.display = 'none';   // e.g. iPhone Safari has no fullscreen API
$('btnFull').addEventListener('click', function () {
  let p;
  if (!document.fullscreenElement) p = rootEl.requestFullscreen();
  else if (document.exitFullscreen) p = document.exitFullscreen();
  if (p && p.catch) p.catch(function () {});
});

$('btnDefaults').addEventListener('click', function () {
  applySteerSensitivity(DEFAULT_PREFS.steerSensitivity);
  applyGestureSensitivity(DEFAULT_PREFS.gestureSensitivity);
  setVolume(DEFAULT_PREFS.volume / 100);
  setMuted(false);
  setAutoAccel(DEFAULT_PREFS.autoAccel);
  prefs.showCam = DEFAULT_PREFS.showCam;
  $('bottomLeft').style.display = (prefs.showCam && gesture.on) ? '' : 'none';
  prefs.showFps = DEFAULT_PREFS.showFps;
  $('fpsBadge').style.display = 'none';
  applyQuality(DEFAULT_PREFS.quality);
  syncSettingsUI();
  savePrefs();
});

// Keep the screen awake: a gesture-controlled game never touches the screen, so phones would dim and lock.
let wakeLock = null;
function requestWakeLock() {
  if (wakeLock || !state.playing || document.hidden || !navigator.wakeLock) return;
  navigator.wakeLock.request('screen').then(function (l) {
    wakeLock = l;
    l.addEventListener('release', function () { if (wakeLock === l) wakeLock = null; });
  }).catch(function () {});
}
function releaseWakeLock() {
  if (!wakeLock) return;
  const l = wakeLock;
  wakeLock = null;
  l.release().catch(function () {});
}

// Leaving the tab/app pauses the game, stops audio and saves settings.
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    openSettings();
    if (audio.ctx && audio.ctx.suspend) audio.ctx.suspend();
    flushPrefs();
  } else {
    if (audio.ctx && audio.ctx.resume) audio.ctx.resume();
    requestWakeLock();
  }
});
window.addEventListener('pagehide', flushPrefs);


/* =================================================================== input */
function readInput(now) {
  updateGesture(now);
  let steer = gesture.on ? gesture.steer : 0, gas = gesture.on ? gesture.gas : 0, brake = gesture.on ? gesture.brake : 0;
  const kl = keys.KeyA || keys.ArrowLeft, kr = keys.KeyD || keys.ArrowRight;
  if (kl || kr) steer = (kr ? 1 : 0) - (kl ? 1 : 0);
  if (keys.KeyW || keys.ArrowUp) gas = 1;
  if (keys.KeyS || keys.ArrowDown) brake = 1;
  if (keys.Space) brake = 1;
  if (prefs.autoAccel && !brake && car.speed < SETTINGS.maxSpeed * 0.72) gas = 1;
  return { steer: steer, gas: gas, brake: brake };
}

/* ====================================================================== HUD */
const HUD = {};
['speed', 'gear', 'rpmBar', 'nitroFill', 'pGas', 'pBrake', 'pBoost', 'wheel', 'top', 'jumps', 'dist'].forEach(function (id) { HUD[id] = $(id); });
const hudLast = {};
function hudText(id, v) { if (hudLast[id] !== v) { hudLast[id] = v; HUD[id].textContent = v; } }
function hudOn(id, on) { if (hudLast[id] !== on) { hudLast[id] = on; HUD[id].classList.toggle('on', on); } }
function updateHUD(input) {
  const sp = Math.abs(car.speed);
  hudText('speed', Math.round(sp * 3.6));
  let gear = 0; while (gear < GEAR_TOP.length - 1 && sp > GEAR_TOP[gear]) gear++;
  hudText('gear', car.speed < -0.5 ? 'R' : (sp < 0.5 ? 'N' : String(gear + 1)));
  const lo = gear ? GEAR_TOP[gear - 1] : 0, hi = GEAR_TOP[gear], rpmPct = Math.round(clamp((sp - lo) / (hi - lo), 0, 1) * 100);
  if (hudLast.rpm !== rpmPct) { hudLast.rpm = rpmPct; HUD.rpmBar.style.width = rpmPct + '%'; }
  const npct = Math.round(clamp(boost.t / 2.4, 0, 1) * 100);
  if (hudLast.nitro !== npct) { hudLast.nitro = npct; HUD.nitroFill.style.transform = 'scaleX(' + (npct / 100) + ')'; }
  hudOn('pGas', input.gas > 0); hudOn('pBrake', input.brake > 0); hudOn('pBoost', boost.t > 0);
  const wdeg = Math.round(car.steer * 85 / 2) * 2;
  if (hudLast.wheel !== wdeg) { hudLast.wheel = wdeg; HUD.wheel.style.transform = 'rotate(' + wdeg + 'deg)'; }
  hudText('top', Math.round(stats.top * 3.6)); hudText('jumps', stats.jumps); hudText('dist', (Math.floor(stats.dist / 100) / 10).toFixed(1));
  const st = clamp((sp / SETTINGS.maxSpeed - 0.9) * 4, 0, 0.55) + boost.visual * 0.5, sv = Math.round(st * 20) / 20;
  if (hudLast.streak !== sv) { hudLast.streak = sv; $('streaks').style.opacity = sv; }
}

/* ================================================================= minimap */
const mini = { S: 210, dpr: 1, zoom: 1 };
const ZOOMS = [110, 180, 300];
mini.zoom = clamp(Math.round(prefs.mapZoom == null ? 1 : prefs.mapZoom), 0, 2);
function sizeMinimap() {
  const cv = $('mini'), S = cv.clientWidth || 210, dpr = Math.min(window.devicePixelRatio || 1, 2);
  mini.S = S; mini.dpr = dpr; cv.width = cv.height = Math.round(S * dpr);
}
function cycleZoom() { mini.zoom = (mini.zoom + 1) % ZOOMS.length; prefs.mapZoom = mini.zoom; savePrefs(); }
$('btnZoom').addEventListener('click', cycleZoom); $('mini').addEventListener('click', cycleZoom);
const DISTRICT = [{ n: 'Downtown', c: 'rgba(120,140,255,0.20)' }, { n: 'Woodland', c: 'rgba(70,200,120,0.22)' }, { n: 'Suburbs', c: 'rgba(245,190,100,0.15)' }];
function drawMinimap(dt) {
  const cv = $('mini'), g = cv.getContext('2d'), S = mini.S, dpr = mini.dpr;
  if (cv.width !== Math.round(S * dpr)) sizeMinimap();
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, S, S);
  const c = S / 2, ringW = Math.max(9, S * 0.058), R = c - ringW - 2, view = ZOOMS[mini.zoom], scale = R / view;
  const fx = Math.sin(car.heading), fz = Math.cos(car.heading), rx = -fz, rz = fx, H = car.heading;
  const tx = function (x, z) { const dx = x - car.x, dz = z - car.z; return [c + (dx * rx + dz * rz) * scale, c - (dx * fx + dz * fz) * scale]; };
  const t = performance.now() / 1000;

  g.save(); g.beginPath(); g.arc(c, c, R, 0, 6.2832); g.clip();
  const bg = g.createRadialGradient(c, c * 0.9, R * 0.1, c, c, R); bg.addColorStop(0, '#1c2044'); bg.addColorStop(1, '#0a0b1c'); g.fillStyle = bg; g.fillRect(0, 0, S, S);

  // districts (deterministic per chunk, so you can read the world from the map)
  const ext = view * 1.5, k0x = Math.floor((car.x - ext) / CHUNK), k1x = Math.floor((car.x + ext) / CHUNK), k0z = Math.floor((car.z - ext) / CHUNK), k1z = Math.floor((car.z + ext) / CHUNK);
  for (let kx = k0x; kx <= k1x; kx++) for (let kz = k0z; kz <= k1z; kz++) {
    const a = tx(kx * CHUNK, kz * CHUNK), b = tx((kx + 1) * CHUNK, kz * CHUNK), d = tx((kx + 1) * CHUNK, (kz + 1) * CHUNK), e = tx(kx * CHUNK, (kz + 1) * CHUNK);
    g.fillStyle = DISTRICT[chunkKind(kx, kz)].c; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(d[0], d[1]); g.lineTo(e[0], e[1]); g.closePath(); g.fill();
  }
  // roads: dark casing, light surface, amber centre dashes
  const rw = ROAD_W * scale;
  const roads = function (w, col, dash) {
    g.strokeStyle = col; g.lineWidth = w; g.setLineDash(dash || []); g.beginPath();
    for (let kx = k0x; kx <= k1x + 1; kx++) { const p = tx(kx * CHUNK, car.z - ext), q = tx(kx * CHUNK, car.z + ext); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
    for (let kz = k0z; kz <= k1z + 1; kz++) { const p = tx(car.x - ext, kz * CHUNK), q = tx(car.x + ext, kz * CHUNK); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); }
    g.stroke(); g.setLineDash([]);
  };
  roads(rw + 3, '#070813'); roads(rw, '#5b628f'); roads(Math.max(1, rw * 0.08), 'rgba(255,200,61,0.75)', [5, 5]);

  // trees + buildings (buildings are drawn "extruded" so tall towers stand out)
  const lim = view * 1.12, bl = [];
  for (let i = 0; i < colliders.length; i++) {
    const o = colliders[i], dx = o.x - car.x, dz = o.z - car.z;
    if (Math.abs(dx) > lim + 20 || Math.abs(dz) > lim + 20) continue;
    if (o.r !== undefined) { if (Q.mapDetail >= 1 && o.r > 0.6) { const p = tx(o.x, o.z); g.fillStyle = 'rgba(90,210,130,0.5)'; g.beginPath(); g.arc(p[0], p[1], Math.max(1, o.r * 1.6 * scale), 0, 6.2832); g.fill(); } }
    else bl.push(o);
  }
  const bp = bl.map(function (o) { const p = tx(o.x, o.z); return { o: o, cy: p[1], pts: [tx(o.x - o.hw, o.z - o.hd), tx(o.x + o.hw, o.z - o.hd), tx(o.x + o.hw, o.z + o.hd), tx(o.x - o.hw, o.z + o.hd)] }; });
  bp.sort(function (a, b) { return a.cy - b.cy; });
  const ext3 = Q.mapDetail >= 2;
  for (let i = 0; i < bp.length; i++) {
    const b = bp[i], up = ext3 ? Math.min(14, b.o.h * scale * 0.32) : 0, p = b.pts;
    if (ext3 && up > 0.5) {
      g.fillStyle = 'rgba(28,32,70,0.98)';
      for (let k = 0; k < 4; k++) { const a = p[k], d = p[(k + 1) % 4]; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(d[0], d[1]); g.lineTo(d[0], d[1] - up); g.lineTo(a[0], a[1] - up); g.closePath(); g.fill(); }
    }
    const tall = clamp(b.o.h / 70, 0, 1);
    g.fillStyle = 'rgb(' + Math.round(96 + tall * 70) + ',' + Math.round(108 + tall * 60) + ',' + Math.round(178 + tall * 60) + ')';
    g.strokeStyle = 'rgba(200,215,255,0.55)'; g.lineWidth = 0.8;
    g.beginPath(); g.moveTo(p[0][0], p[0][1] - up); for (let k = 1; k < 4; k++) g.lineTo(p[k][0], p[k][1] - up); g.closePath(); g.fill(); g.stroke();
  }

  // ramps (with their landing zones) + pads, coins, gems
  activeRamps.forEach(function (rp) {
    const dirx = (rp.axis === 'x' ? 1 : 0) * rp.dir, dirz = (rp.axis === 'x' ? 0 : 1) * rp.dir, acx = -dirz, acz = dirx, hw = rp.halfWidth + 1;
    const lipX = rp.x + dirx * rp.length, lipZ = rp.z + dirz * rp.length, farX = rp.x + dirx * (rp.length + rp.landing), farZ = rp.z + dirz * (rp.length + rp.landing);
    const p1 = tx(lipX + acx * hw, lipZ + acz * hw), p2 = tx(lipX - acx * hw, lipZ - acz * hw), p3 = tx(farX - acx * hw, farZ - acz * hw), p4 = tx(farX + acx * hw, farZ + acz * hw);
    g.fillStyle = 'rgba(255,154,42,0.16)'; g.strokeStyle = 'rgba(255,154,42,0.4)'; g.lineWidth = 1; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.lineTo(p4[0], p4[1]); g.closePath(); g.fill(); g.stroke(); g.setLineDash([]);
    // icon oriented along the ramp's actual travel direction
    const idx = dirx * rx + dirz * rz, idy = -(dirx * fx + dirz * fz), il = Math.hypot(idx, idy) || 1, ux = idx / il, uy = idy / il, vx = -uy, vy = ux;
    const p = tx(rp.x, rp.z), tip = [p[0] + ux * 6, p[1] + uy * 6], b1 = [p[0] - ux * 3.5 + vx * 4, p[1] - uy * 3.5 + vy * 4], b2 = [p[0] - ux * 3.5 - vx * 4, p[1] - uy * 3.5 - vy * 4];
    g.fillStyle = '#ff9a2a'; g.strokeStyle = '#4a2600'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(tip[0], tip[1]); g.lineTo(b1[0], b1[1]); g.lineTo(b2[0], b2[1]); g.closePath(); g.fill(); g.stroke();
  });
  activePads.forEach(function (pd) { const p = tx(pd.x, pd.z); g.strokeStyle = '#4cc9ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(p[0] - 4, p[1] + 2); g.lineTo(p[0], p[1] - 3); g.lineTo(p[0] + 4, p[1] + 2); g.stroke(); });
  let nearest = null, nd = 1e9;
  activeCoins.forEach(function (cn) {
    if (!cn.mesh.visible) return;
    const d = Math.hypot(cn.x - car.x, cn.z - car.z), p = tx(cn.x, cn.z);
    if (d < nd) { nd = d; nearest = cn; }
    if (d > view * 1.1) return;
    if (cn.gem) { g.fillStyle = '#5fdcff'; g.beginPath(); g.moveTo(p[0], p[1] - 4); g.lineTo(p[0] + 3, p[1]); g.lineTo(p[0], p[1] + 4); g.lineTo(p[0] - 3, p[1]); g.closePath(); g.fill(); }
    else {
      if (d < 70) { g.fillStyle = 'rgba(255,200,60,' + (0.16 + 0.1 * Math.sin(t * 6 + cn.x)) + ')'; g.beginPath(); g.arc(p[0], p[1], 5.5, 0, 6.2832); g.fill(); }
      g.fillStyle = '#ffc83d'; g.beginPath(); g.arc(p[0], p[1], 2.3, 0, 6.2832); g.fill();
    }
  });
  // traffic
  traffic.forEach(function (tr) {
    const p = tx(tr.x, tr.z); if (Math.hypot(p[0] - c, p[1] - c) > R + 6) return;
    g.save(); g.translate(p[0], p[1]); g.rotate(tr.heading - H); g.fillStyle = '#ff5468'; g.fillRect(-2, -3.6, 4, 7.2); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(-1.4, -3.2, 2.8, 1.6); g.restore();
  });
  // view cone + player
  const cone = g.createRadialGradient(c, c, 0, c, c, R * 0.85); cone.addColorStop(0, 'rgba(255,106,43,0.42)'); cone.addColorStop(1, 'rgba(255,106,43,0)');
  g.fillStyle = cone; g.beginPath(); g.moveTo(c, c); g.arc(c, c, R * 0.85, -Math.PI / 2 - 0.62, -Math.PI / 2 + 0.62); g.closePath(); g.fill();
  const pulse = (t % 1.6) / 1.6; g.strokeStyle = 'rgba(255,200,61,' + (0.5 * (1 - pulse)) + ')'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, 8 + pulse * 46, 0, 6.2832); g.stroke();
  g.fillStyle = '#ff6a2b'; g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(c, c - 9); g.lineTo(c + 6.5, c + 7); g.lineTo(c, c + 3.5); g.lineTo(c - 6.5, c + 7); g.closePath(); g.fill(); g.stroke();
  // district chip
  const dk = DISTRICT[chunkKind(Math.floor(car.x / CHUNK), Math.floor(car.z / CHUNK))].n;
  g.font = '700 ' + Math.round(S * 0.055) + 'px "Barlow Semi Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const tw = g.measureText(dk).width + 16, chH = S * 0.085, chY = c + R * 0.66;
  g.fillStyle = 'rgba(8,9,22,0.72)'; g.beginPath(); if (g.roundRect) g.roundRect(c - tw / 2, chY - chH / 2, tw, chH, chH / 2); else g.rect(c - tw / 2, chY - chH / 2, tw, chH); g.fill();
  g.fillStyle = '#fff'; g.fillText(dk, c, chY + 1);
  const vg = g.createRadialGradient(c, c, R * 0.72, c, c, R); vg.addColorStop(0, 'rgba(6,7,18,0)'); vg.addColorStop(1, 'rgba(6,7,18,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, S, S);
  g.restore();

  // bezel: dark ring, nitro arc, rotating compass ticks, coin pointer
  g.lineWidth = ringW; g.strokeStyle = '#151831'; g.beginPath(); g.arc(c, c, R + ringW / 2, 0, 6.2832); g.stroke();
  g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.beginPath(); g.arc(c, c, R + ringW + 0.5, 0, 6.2832); g.stroke();
  const nf = clamp(boost.t / 2.4, 0, 1);
  g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.08)'; g.beginPath(); g.arc(c, c, R + 2.5, 0, 6.2832); g.stroke();
  if (nf > 0) { g.strokeStyle = '#4cc9ff'; g.beginPath(); g.arc(c, c, R + 2.5, -Math.PI / 2, -Math.PI / 2 + nf * 6.2832); g.stroke(); }
  g.font = '700 ' + Math.round(ringW * 0.85) + 'px "Barlow Semi Condensed", sans-serif';
  for (let b = 0; b < 360; b += 15) {
    const a = H - Math.PI / 2 + b * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), card = b % 90 === 0;
    const r1 = R + ringW - 1, r2 = r1 - (card ? 0 : (b % 45 === 0 ? 4 : 2.5));
    if (card) {
      g.fillStyle = b === 0 ? '#ff6a2b' : 'rgba(255,255,255,0.85)'; g.fillText(['N', 'E', 'S', 'W'][b / 90], c + ca * (R + ringW / 2 + 0.5), c + sa * (R + ringW / 2 + 0.5) + 1);
    } else { g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(c + ca * r1, c + sa * r1); g.lineTo(c + ca * r2, c + sa * r2); g.stroke(); }
  }
  g.fillStyle = '#fff'; g.beginPath(); g.moveTo(c, c - R - ringW - 1); g.lineTo(c - 4, c - R - ringW - 8); g.lineTo(c + 4, c - R - ringW - 8); g.closePath(); g.fill();
  if (nearest && nd > view * 1.05) {
    const p = tx(nearest.x, nearest.z), a = Math.atan2(p[1] - c, p[0] - c), pr = R - 7;
    g.save(); g.translate(c + Math.cos(a) * pr, c + Math.sin(a) * pr); g.rotate(a); g.fillStyle = '#ffc83d'; g.strokeStyle = '#1a0b03'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(6, 0); g.lineTo(-4, -5); g.lineTo(-2, 0); g.lineTo(-4, 5); g.closePath(); g.fill(); g.stroke(); g.restore();
  }
}

/* ================================================================== garage */
const gScene = new THREE.Scene();
gScene.background = C(0x0e1024); gScene.environment = envStudio;
const gCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
gScene.add(new THREE.HemisphereLight(0xa8b4ff, 0x20233f, 0.55));
const gKey = new THREE.DirectionalLight(0xfff0e0, 2.0); gKey.position.set(5, 9, 6); gKey.castShadow = true; gKey.shadow.mapSize.set(1024, 1024);
Object.assign(gKey.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 }); gKey.shadow.bias = -0.0005; gScene.add(gKey);
const gRim = new THREE.DirectionalLight(0x6ab0ff, 1.6); gRim.position.set(-6, 3, -6); gScene.add(gRim);
const gWarm = new THREE.DirectionalLight(0xff8a4c, 1.1); gWarm.position.set(6, 2, -5); gScene.add(gWarm);
const gFloor = new THREE.Mesh(new THREE.CircleGeometry(14, 72), new THREE.MeshStandardMaterial({ color: C(0x141730), roughness: 0.55, metalness: 0.15, envMapIntensity: 0.25 }));
gFloor.rotation.x = -Math.PI / 2; gFloor.receiveShadow = true; gScene.add(gFloor);
const gRing = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: C(0xff6a2b) })); gRing.rotation.x = Math.PI / 2; gRing.position.y = 0.02; gScene.add(gRing);
const gRing2 = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.02, 8, 96), new THREE.MeshBasicMaterial({ color: C(0x4b527f) })); gRing2.rotation.x = Math.PI / 2; gRing2.position.y = 0.02; gScene.add(gRing2);
const gCache = { obj: null, id: null, thumbs: {} };
let gSel = 'comet', gTab = 'all', gRot = 0.6, gDrag = null, gAuto = true, thumbTimer = 0;
const PALETTE = [0xd8232a, 0xff7a1a, 0xffc21a, 0x2fb36b, 0x1d5fe0, 0x7a3fe0, 0xeceff3, 0x1b1d22, 0xff4f9a];
const hex6 = function (h) { return '#' + ('000000' + h.toString(16)).slice(-6); };

function statNorm(def) {
  const p = def.phys;
  return { speed: p.maxSpeed / 84, accel: p.accel / 33, handling: clamp((p.turn - 1.3) / 1.4, 0.1, 1) * 0.75 + clamp(1 - p.maxSpeed / 140, 0, 1) * 0.25, brake: p.brake / 54 };
}
function barsHTML(def, compact) {
  const n = statNorm(def), rows = [['Top speed', n.speed, Math.round(def.phys.maxSpeed * 3.6) + ' km/h'], ['Acceleration', n.accel, (n.accel * 10).toFixed(1)], ['Handling', n.handling, (n.handling * 10).toFixed(1)], ['Braking', n.brake, (n.brake * 10).toFixed(1)]];
  return rows.map(function (r) { return '<div class="bar"><span>' + r[0] + '</span><i><b style="width:' + Math.round(clamp(r[1], 0.05, 1) * 100) + '%"></b></i><em>' + r[2] + '</em></div>'; }).join('');
}
function refreshRideCard() {
  $('rideName').textContent = cur.def.name; $('rideCls').textContent = cur.def.cls; $('rideBars').innerHTML = barsHTML(cur.def);
}
function applyGarageView() {
  const w = window.innerWidth, h = window.innerHeight, narrow = w < 900;
  if (narrow) gCamera.setViewOffset(w, h, 0, h * 0.14, w, h); else gCamera.setViewOffset(w, h, 0, h * 0.05, w, h);
  gCamera.aspect = w / h; gCamera.updateProjectionMatrix();
}
function fitGarageCamera(dims) {
  const R = dims.L * 1.95 + 3.6;
  gCamera.position.set(0, dims.H * 1.0 + 1.6, R); gCamera.lookAt(0, dims.H * 0.32, 0);
}
function showInGarage(id) {
  const def = defById(id);
  if (gCache.obj) { gScene.remove(gCache.obj); K.dispose(gCache.obj); gCache.obj = null; }
  const obj = def.build({ paint: paintFor(def) });
  obj.userData.animate(obj, { speed: 0, steer: 0, accel: 0, night: 0.55, brake: 0, boost: false, dt: 0.016 });
  obj.rotation.y = gRot; gScene.add(obj); gCache.obj = obj; gCache.id = id;
  fitGarageCamera(obj.userData.dims);
}
function renderThumb(def) {
  const obj = def.build({ paint: def.defaultPaint }), d = obj.userData.dims;
  obj.userData.animate(obj, { speed: 0, steer: 0, accel: 0, night: 0.5, brake: 0, boost: false, dt: 0.016 });
  const cam = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
  cam.position.set(d.L * 0.8 + 1.8, d.H * 1.0 + 0.9, d.L * 1.05 + 2.6); cam.lookAt(0, d.H * 0.3, 0);
  if (gCache.obj) gCache.obj.visible = false;
  obj.rotation.y = 0; gScene.add(obj);
  renderer.setPixelRatio(1); renderer.setSize(320, 180, false); renderer.render(gScene, cam);
  const url = renderer.domElement.toDataURL('image/jpeg', 0.88);
  gScene.remove(obj); K.dispose(obj); if (gCache.obj) gCache.obj.visible = true;
  applyPixelRatio(); resize();
  return url;
}
function pumpThumbs() {
  thumbTimer = 0; if (!state.garage) return;
  const def = defs.filter(function (d) { return !gCache.thumbs[d.id]; })[0];
  if (!def) return;
  try { gCache.thumbs[def.id] = renderThumb(def); const im = document.querySelector('.card[data-id="' + def.id + '"] .thumb'); if (im) im.src = gCache.thumbs[def.id]; } catch (e) { gCache.thumbs[def.id] = ''; }
  thumbTimer = setTimeout(pumpThumbs, 30);
}
function buildGarageList() {
  const box = $('gList'); box.innerHTML = '';
  defs.filter(function (d) { return gTab === 'all' || d.type === gTab; }).forEach(function (d) {
    const owned = isOwned(d.id), b = document.createElement('button');
    b.className = 'card' + (owned ? '' : ' lock') + (d.id === gSel ? ' sel' : ''); b.dataset.id = d.id;
    b.innerHTML = '<img class="thumb" alt="" src="' + (gCache.thumbs[d.id] || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7') + '"><span class="nm">' + d.name + '</span><span class="sub"><span>' + d.cls + '</span>' +
      (owned ? '<span class="own">Owned</span>' : '<span class="price"><svg class="ic"><use href="#i-coin"/></svg>' + d.price.toLocaleString() + '</span>') + '</span>';
    b.addEventListener('click', function () { selectInGarage(d.id); });
    box.appendChild(b);
  });
}
function selectInGarage(id) {
  gSel = id; showInGarage(id);
  document.querySelectorAll('#gList .card').forEach(function (c) { c.classList.toggle('sel', c.dataset.id === id); });
  renderGarageDetail(); $('dNote').textContent = '';
}
function renderGarageDetail() {
  const d = defById(gSel), owned = isOwned(d.id), driving = cur.def.id === d.id;
  $('dCls').textContent = d.cls + (d.type === 'bike' ? ' (bike)' : '');
  const bd = $('dBadge'); bd.textContent = driving ? 'Driving' : owned ? 'Owned' : 'Locked'; bd.className = 'badge ' + (driving ? 'drive' : owned ? 'owned' : 'locked');
  $('dName').textContent = d.name; $('dBlurb').textContent = d.blurb; $('dBars').innerHTML = barsHTML(d);
  const pr = $('dPaint'); pr.innerHTML = '';
  [d.defaultPaint].concat(PALETTE).forEach(function (hx) {
    const b = document.createElement('button'); b.style.background = hex6(hx); b.setAttribute('aria-label', 'Paint ' + hex6(hx));
    if (hx === paintFor(d)) b.className = 'on';
    b.addEventListener('click', function () { save.paints[d.id] = hx; savePrefs(); if (gCache.obj) gCache.obj.userData.paint[0].color.copy(C(hx)); if (cur.def.id === d.id) cur.obj.userData.paint[0].color.copy(C(hx)); renderGarageDetail(); });
    pr.appendChild(b);
  });
  const btn = $('dAction');
  if (driving) { btn.textContent = 'Selected'; btn.disabled = true; }
  else if (owned) { btn.textContent = 'Drive this'; btn.disabled = false; }
  else { btn.innerHTML = 'Buy for ' + d.price.toLocaleString() + ' coins'; btn.disabled = save.coins < d.price; }
  if (!owned && save.coins < d.price) $('dNote').textContent = 'Collect ' + (d.price - save.coins).toLocaleString() + ' more coins to unlock';
}
$('dAction').addEventListener('click', function () {
  const d = defById(gSel);
  if (!isOwned(d.id)) {
    if (save.coins < d.price) return;
    save.coins -= d.price; save.owned.push(d.id); buySound(); toast('Unlocked <b>' + d.name + '</b>');
    const gd = $('gDetail'); gd.classList.remove('flash'); void gd.offsetWidth; gd.classList.add('flash');
  }
  save.selected = d.id; setVehicle(d.id); flushPrefs(); updateWallet(); refreshRideCard(); buildGarageList(); renderGarageDetail();
  if (!$('dNote').textContent) $('dNote').textContent = '';
});
$('gTabs').addEventListener('click', function (e) { const b = e.target.closest('button'); if (!b) return; gTab = b.dataset.tab; Array.prototype.forEach.call($('gTabs').children, function (x) { x.classList.toggle('on', x === b); }); buildGarageList(); });
function openGarage(fromPause) {
  state.garage = true; state.garageFromPause = fromPause;
  $('menu').style.display = 'none'; $('settingsMenu').style.display = 'none'; $('hud').style.visibility = 'hidden'; $('fx').style.display = 'none'; $('garage').style.display = 'block';
  gSel = cur.def.id; gTab = 'all'; Array.prototype.forEach.call($('gTabs').children, function (x) { x.classList.toggle('on', x.dataset.tab === 'all'); });
  updateWallet(); buildGarageList(); showInGarage(gSel); renderGarageDetail(); $('dNote').textContent = '';
  applyGarageView(); resize(); if (thumbTimer) clearTimeout(thumbTimer); thumbTimer = setTimeout(pumpThumbs, 60);
}
function closeGarage() {
  if (!state.garage) return;
  state.garage = false; if (thumbTimer) { clearTimeout(thumbTimer); thumbTimer = 0; }
  $('garage').style.display = 'none'; $('hud').style.visibility = ''; $('fx').style.display = '';
  if (gCache.obj) { gScene.remove(gCache.obj); K.dispose(gCache.obj); gCache.obj = null; }
  if (state.garageFromPause) $('settingsMenu').style.display = 'flex'; else $('menu').style.display = 'flex';
  refreshRideCard(); resize(); renderDirty = true; lastT = performance.now(); flushPrefs();
}
$('gBack').addEventListener('click', closeGarage);
$('btnGarage').addEventListener('click', function () { initAudio(); openGarage(false); });
$('btnChange').addEventListener('click', function () { openGarage(false); });
$('btnGarageIn').addEventListener('click', function () { openGarage(true); });
$('garage').addEventListener('pointerdown', function (e) { if (e.target === $('garage')) { gDrag = { x: e.clientX, r: gRot }; gAuto = false; try { $('garage').setPointerCapture(e.pointerId); } catch (x) {} } });
$('garage').addEventListener('pointermove', function (e) { if (gDrag) gRot = gDrag.r + (e.clientX - gDrag.x) * 0.012; });
window.addEventListener('pointerup', function () { if (gDrag) { gDrag = null; setTimeout(function () { if (!gDrag) gAuto = true; }, 1500); } });
function garageFrame(now, dt) {
  if (gAuto) gRot += dt * 0.45;
  if (gCache.obj) { gCache.obj.rotation.y = gRot; }
  renderer.render(gScene, gCamera);
}

/* ================================================================ keyboard */
window.addEventListener('keydown', function (e) {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight'].indexOf(e.code) >= 0) e.preventDefault();
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && state.playing && !state.garage && !state.paused) {
    if (boost.cooldown <= 0) {
      boost.t = Math.max(boost.t, 2.0);
      boost.cooldown = 0.35;
      car.speed = Math.min(Math.max(car.speed, 10), SETTINGS.maxSpeed * 1.28);
      boostSound();
    }
  }
  // Feed the cheat-code buffer before the single-letter hotkeys below: a letter that's
  // continuing an in-progress word match (buffer already non-empty) is claimed by the
  // cheat system so e.g. typing "SPECTRE" isn't derailed by the P hotkey partway
  // through; a bare first keystroke is left alone so single-tap shortcuts still work.
  let cheatClaimed = false;
  if (state.playing && !state.garage && !state.paused && !state.photo && e.key && e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) cheatClaimed = feedCheat(e.key.toUpperCase());
  // G is special: it's both the garage hotkey AND the first letter of two cheat words
  // ("GHOST", "GIVEMECASH"), so a bare first "G" can't be told apart from the start of
  // one of those yet. Give it a brief grace window before actually opening the garage,
  // and cancel that if the very next keystroke turns out to continue a cheat match.
  if (cheatClaimed && garageHotkeyTimer) { clearTimeout(garageHotkeyTimer); garageHotkeyTimer = null; }
  if (e.code === 'KeyR' && state.playing && !state.garage && !state.photo && !cheatClaimed) resetCar();
  if (e.code === 'KeyM' && !cheatClaimed) setMuted(!audio.muted);
  if (e.code === 'KeyZ' && state.playing && !state.photo && !cheatClaimed) cycleZoom();
  if (e.code === 'KeyG' && state.playing && !state.garage && !state.photo && !cheatClaimed) {
    if (cheatBuf === 'G') { if (garageHotkeyTimer) clearTimeout(garageHotkeyTimer); garageHotkeyTimer = setTimeout(function () { garageHotkeyTimer = null; if (state.playing && !state.garage && !state.photo) { if (!state.paused) openSettings(); openGarage(true); } }, 280); }
    else { if (!state.paused) openSettings(); openGarage(true); }
  }
  if (e.code === 'KeyC' && !cheatClaimed) { const p = $('bottomLeft'); p.style.display = (p.style.display === 'none') ? '' : 'none'; }
  if (e.code === 'KeyF' && !cheatClaimed) { if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); } else if (document.exitFullscreen) document.exitFullscreen(); }
  if (e.code === 'KeyP' && state.playing && !state.garage && !state.paused && !cheatClaimed) { if (state.photo) exitPhotoMode(); else enterPhotoMode(); }
  if (e.code === 'KeyS' && state.photo) savePhoto();
  if (e.code === 'Escape') { if (state.photo) exitPhotoMode(); else if (state.garage) closeGarage(); else if (state.playing) { if (state.paused) closeSettings(); else openSettings(); } }
});
window.addEventListener('keyup', function (e) { keys[e.code] = false; });
$('btnSnd').addEventListener('click', function () { setMuted(!audio.muted); });
$('btnQuitMenu').addEventListener('click', function () {
  closeSettings(); silenceAudio(); releaseWakeLock();
  state.playing = false; $('hud').style.display = 'none'; $('menu').style.display = 'flex'; $('menuMsg').textContent = '';
  car.x = -4; car.z = 0; car.y = 0; car.vy = 0; car.speed = 0; car.heading = 0; car.steer = 0; car.airborne = false; car.air = 0; car.trickSpin = 0; boost.t = 0; boost.cooldown = 0; sky.frozen = true; sky.t = 0.47; updateChunks(true); renderDirty = true;
});

/* ============================================================ quality hint */
function updateQualityHint() {
  const level = resolveQuality(prefs.quality), names = { low: 'Low', medium: 'Medium', high: 'High' };
  let t = prefs.quality === 'auto' ? 'Auto picked ' + names[level] + ' for this device. ' : '';
  if (QUALITY[level].antialias !== Q.antialias) t += 'Anti-aliasing only changes after a page reload.';
  $('qualityHint').textContent = t;
}
function applyQuality(pref, initial) {
  prefs.quality = pref;
  const old = { treeMult: Q.treeMult, simpleBuildings: Q.simpleBuildings, simpleRamps: Q.simpleRamps, lamps: Q.lamps, phys: Q.phys, shadow: Q.shadow };
  Object.assign(Q, QUALITY[resolveQuality(pref)]); Q.antialias = rendererAA;
  document.body.classList.toggle('lowfx', !!Q.lowfx);
  scene.fog.near = Q.fogNear; scene.fog.far = Q.fogFar; headlight.visible = !!Q.spotlight;
  SETTINGS.trafficCars = Q.trafficCars;
  applyPixelRatio(); applyShadowQuality();
  if (!initial) {
    if ((old.shadow > 0) !== (Q.shadow > 0)) { scene.traverse(function (o) { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(function (m) { m.needsUpdate = true; }); }); }
    if (old.phys !== Q.phys) rebuildVehicles(); else syncTrafficCount();
    if (old.treeMult !== Q.treeMult || old.simpleBuildings !== Q.simpleBuildings || old.simpleRamps !== Q.simpleRamps || old.lamps !== Q.lamps) clearChunks();
    updateChunks(true);
  }
  resize(); skyAccum = 0; hudAccum = 0; updateQualityHint();
}

/* ================================================================== the loop */
function resetCar() {
  car.x = -4; car.z = 0; car.y = 0; car.vy = 0; car.heading = 0; car.speed = 0; car.steer = 0; car.airborne = false; car.air = 0; car.trickSpin = 0; boost.t = 0;
  updateChunks(true); camPos.set(car.x, cur.def.cam.up, car.z - cur.def.cam.back); placeCamera(true, 0);
}
function setViewShift(x, y) { if (viewShift.x !== x || viewShift.y !== y) { viewShift = { x: x, y: y }; resize(); } }
let lastT = performance.now(), lastMinimap = 0, skyAccum = 0, hudAccum = 0, fpsFrames = 0, fpsT = performance.now(), prevSpeed = 0, menuT = 0;
let timeScale = 1, pitchVisual = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (state.garage) { const gdt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000)); lastT = now; garageFrame(now, gdt); return; }
  if (state.playing && state.paused) { if (renderDirty) { renderDirty = false; renderer.render(scene, camera); } return; }
  const elapsed = now - lastT, interval = Q.frameIntervalMs;
  if (interval && elapsed < interval - 1.5) return;
  lastT = (interval && elapsed >= interval) ? now - (elapsed % interval) : now;
  const dt = Math.min(0.033, Math.max(0.001, elapsed / 1000));
  boost.visual += ((boost.t > 0 ? 1 : 0) - boost.visual) * Math.min(1, dt * (boost.t > 0 ? 9 : 3.2));

  sun.target.position.set(Math.round(car.x / 2) * 2, 0, Math.round(car.z / 2) * 2);
  if (Q.skyIntervalMs) { skyAccum += dt; if (skyAccum * 1000 >= Q.skyIntervalMs) { updateSky(skyAccum); skyAccum = 0; } } else updateSky(dt);

  let input = { steer: 0, gas: 0, brake: 0 };
  if (state.photo) {
    photoCamera();
  } else if (state.playing) {
    input = readInput(now);
    // A big-air jump earns a brief beat of slow-motion (bullet-time), purely cosmetic:
    // it scales the dt fed to physics/camera/particles, not the real frame timer above.
    const wantSlowmo = car.airborne && car.air > 1.3;
    timeScale += ((wantSlowmo ? 0.4 : 1) - timeScale) * Math.min(1, dt * 6);
    const gdt = dt * timeScale;
    stepCar(gdt, input);
    let impact = moveCar(gdt);
    checkRamps(gdt); updateTraffic(gdt); impact = Math.max(impact, collideTraffic());
    handleImpact(impact, gdt);
    updateChunks(false); updateCoins(dt); updatePads(dt); driveEffects(gdt, input);
    placeCamera(false, gdt); updateAudio(input);
    hudAccum += dt * 1000;
    if (!Q.hudIntervalMs || hudAccum >= Q.hudIntervalMs) { updateHUD(input); hudAccum = 0; }
    if (!Q.minimapIntervalMs || now - lastMinimap >= Q.minimapIntervalMs) { drawMinimap(dt); lastMinimap = now; }
  } else {
    menuT += dt; updateTraffic(dt); updateChunks(false);
    const d = cur.obj.userData.dims, wide = window.innerWidth / window.innerHeight > 1.05;
    setViewShift(wide ? 0.2 : 0, wide ? 0 : 0.17);
    const asp = window.innerWidth / window.innerHeight, R = (d.L * 1.05 + 3.4) / (wide ? 1 : Math.max(0.35, Math.min(1, asp)) * 0.95), a = 0.62 + Math.sin(menuT * 0.32) * 0.95;
    camera.fov = 36; camera.updateProjectionMatrix();
    camera.position.set(car.x + Math.sin(a) * R, d.H * 0.8 + 0.55 + Math.sin(menuT * 0.5) * 0.12, car.z + Math.cos(a) * R);
    camera.lookAt(car.x, d.H * 0.4, car.z);
    updateParticles(dt);
  }
  if (state.playing && !state.photo) setViewShift(0, 0);
  updateParticles(dt);

  ground.position.x = Math.round(car.x / GRASS_TILE) * GRASS_TILE; ground.position.z = Math.round(car.z / GRASS_TILE) * GRASS_TILE;
  skyDome.position.copy(camera.position); hills.position.set(camera.position.x, 0, camera.position.z);
  const o = cur.obj;
  if (!state.photo) {
    o.position.set(car.x, car.y, car.z); o.rotation.y = car.heading;
    const targetPitch = car.airborne ? clamp(-car.vy * 0.03, -0.35, 0.35) : 0;
    pitchVisual += (targetPitch - pitchVisual) * Math.min(1, dt * 10); o.rotation.x = pitchVisual;
    const acc = (car.speed - prevSpeed) / Math.max(dt, 0.001); prevSpeed = car.speed;
    K.animateVehicle(o, { speed: car.speed, steer: car.steer, accel: clamp(acc, -60, 60), night: sky.night || 0, brake: (input.brake > 0 && car.speed > 0.5) ? 1 : 0, boost: boost.visual, dt: dt });
    if (o.userData.blob) { o.userData.blob.position.y = 0.03 - car.y; o.userData.blob.scale.setScalar(1 / (1 + car.y * 0.25)); }
  }
  if (Q.bloom) renderWithBloom(); else renderer.render(scene, camera);
  renderDirty = false;
  fpsFrames++;
  if (now - fpsT >= 500) { if (prefs.showFps) $('fpsBadge').textContent = Math.round(fpsFrames * 1000 / (now - fpsT)) + ' FPS'; fpsFrames = 0; fpsT = now; }
}

function beginGame() {
  $('menu').style.display = 'none'; $('hud').style.display = 'block';
  state.playing = true; sky.frozen = false; sky.t = 0.27;
  camera.fov = 66; camera.updateProjectionMatrix(); setViewShift(0, 0);
  sizeMinimap(); resetCar(); lastT = performance.now(); renderDirty = true; requestWakeLock();
  setMuted(audio.muted);
}
$('btnKey').addEventListener('click', function () { initAudio(); $('bottomLeft').style.display = 'none'; beginGame(); });
$('btnCam').addEventListener('click', async function () {
  initAudio();
  if (gesture.on) { $('bottomLeft').style.display = prefs.showCam ? '' : 'none'; beginGame(); return; }
  const msg = $('menuMsg');
  $('btnCam').disabled = true; $('btnKey').disabled = true;
  try { await startHandTracking(function (t) { msg.textContent = t; }); $('bottomLeft').style.display = prefs.showCam ? '' : 'none'; beginGame(); }
  catch (err) {
    console.error(err);
    let why = (err && err.message) ? err.message : String(err);
    if (err && err.name === 'NotAllowedError') why = 'camera permission was blocked';
    if (err && err.name === 'NotFoundError') why = 'no camera was found';
    msg.textContent = 'Could not start the camera (' + why + '). You can play with the keyboard instead.';
    $('btnCam').disabled = false; $('btnKey').disabled = false;
  }
});

/* ==================================================================== init */
applySteerSensitivity(prefs.steerSensitivity); applyGestureSensitivity(prefs.gestureSensitivity);
$('auto').checked = prefs.autoAccel; $('autoToggleSettings').checked = prefs.autoAccel;
applyQuality(prefs.quality, true);
if (!isOwned(save.selected)) save.selected = 'comet';
setVehicle(save.selected); syncTrafficCount();
setMuted(audio.muted); updateWallet(); refreshRideCard();
$('fpsBadge').style.display = prefs.showFps ? 'block' : 'none';
sky.frozen = true; sky.t = 0.47;
updateChunks(true); camPos.set(0, 4.3, -9); resize(); sizeMinimap();
updateSky(0.01);
requestAnimationFrame(frame);

/* ======================================================= collision self-test */
// Fires the car at every currently-loaded building from many angles, speeds and
// heights, and asserts it never ends up embedded in one. Runs the REAL production
// moveCar()/collide() path (not a re-implementation), so it actually exercises the
// fix. Pure logic - no rendering involved - so it's safe to call from the console
// at any time; it snapshots and restores the car's state when done.
function collisionSelfTest(opts) {
  opts = opts || {};
  const angles = opts.angles || 16;
  const speeds = opts.speeds || [15, 40, 80, 130];
  const heights = opts.heights || [0, 3, 10, 40];
  const maxBuildings = opts.maxBuildings || 40;
  const steps = opts.steps || 60, simDt = opts.simDt || 0.05;
  const saved = { x: car.x, z: car.z, y: car.y, vy: car.vy, heading: car.heading, speed: car.speed, steer: car.steer, airborne: car.airborne, air: car.air, trickSpin: car.trickSpin };
  const savedParticles = Q.particles; Q.particles = 0;
  const buildings = colliders.filter(function (c) { return c.hw !== undefined && !c.ramp; }).slice(0, maxBuildings);
  let tested = 0; const failures = [];
  buildings.forEach(function (b) {
    for (let ai = 0; ai < angles; ai++) {
      const ang = ai / angles * Math.PI * 2, startDist = Math.max(b.hw, b.hd) + cur.phys.R + 4;
      heights.forEach(function (h0) {
        speeds.forEach(function (sp) {
          car.x = b.x + Math.sin(ang) * startDist; car.z = b.z + Math.cos(ang) * startDist;
          car.heading = ang + Math.PI; car.y = h0; car.vy = 0; car.airborne = h0 > 0; car.air = 0; car.speed = sp; car.steer = 0; car.trickSpin = 0;
          tested++;
          for (let s = 0; s < steps; s++) {
            if (car.airborne) { car.vy -= SETTINGS.gravity * simDt; car.y += car.vy * simDt; if (car.y <= 0) { car.y = 0; car.airborne = false; car.vy = 0; } }
            moveCar(simDt);
          }
          for (let i = 0; i < colliders.length; i++) {
            const c2 = colliders[i]; if (c2.hw === undefined || car.y >= c2.h) continue;
            if (c2.ramp && inRampEnvelope(c2.ramp, car.x, car.z)) continue;
            const px = clamp(car.x, c2.x - c2.hw, c2.x + c2.hw), pz = clamp(car.z, c2.z - c2.hd, c2.z + c2.hd);
            if (Math.hypot(car.x - px, car.z - pz) < cur.phys.R - 0.01) failures.push({ x: car.x, z: car.z, y: car.y, angle: Math.round(ang * 180 / Math.PI), speed: sp, height: h0, building: c2 });
          }
        });
      });
    }
  });
  Object.assign(car, saved); Q.particles = savedParticles;
  const result = { tested: tested, buildingsTested: buildings.length, passed: failures.length === 0, failures: failures };
  console.log('[GestureDrive] collision self-test:', result.passed ? 'PASS' : 'FAIL', '(' + tested + ' scenarios across ' + buildings.length + ' buildings, ' + failures.length + ' failures)');
  if (failures.length) console.log(failures.slice(0, 10));
  return result;
}

window.__gd = {
  scene: scene, renderer: renderer, camera: camera, car: car, state: state, boost: boost, stats: stats, sky: sky, traffic: traffic, chunks: chunks, gesture: gesture, audio: audio, keys: keys,
  analyzeHands: analyzeHands, SETTINGS: SETTINGS, Q: Q, prefs: prefs, applyQuality: applyQuality, save: save, defs: defs,
  addCoins: function (n) { save.coins += n; updateWallet(); savePrefs(); return save.coins; },
  unlockAll: function () { defs.forEach(function (d) { if (!isOwned(d.id)) save.owned.push(d.id); }); savePrefs(); },
  setVehicle: function (id) { save.selected = id; setVehicle(id); savePrefs(); },
  pads: function () { return activePads; }, colliders: function () { return colliders; }, coins: function () { return activeCoins; }, ramps: function () { return activeRamps; },
  // Deterministic, synchronous simulation used by tooling/tests: runs the same per-tick
  // sequence as the real frame loop without depending on real-time requestAnimationFrame.
  simulate: function (steps, dt, input) {
    const inp = Object.assign({ steer: 0, gas: 0, brake: 0 }, input || {});
    const log = [];
    for (let i = 0; i < steps; i++) {
      stepCar(dt, inp);
      const impact = Math.max(moveCar(dt), collideTraffic());
      checkRamps(dt); updateTraffic(dt); handleImpact(impact, dt); updatePads(dt);
      log.push({ x: car.x, z: car.z, y: car.y, speed: car.speed, airborne: car.airborne, onRamp: !!car.onRamp });
    }
    return log;
  },
  selfTest: collisionSelfTest
};
})();
