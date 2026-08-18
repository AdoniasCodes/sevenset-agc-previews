/* ============================================================
   AGC 3D centrepiece: procedural tower, Three.js.
   Homepage only. Desktop and no-reduced-motion only.
   ============================================================ */
"use strict";

/* Only the homepage carries the scene. Bail out cheaply everywhere else. */
if (!document.getElementById('scene') || !document.getElementById('hero')) {
  /* nothing to do on interior pages */
} else {

const wideMQ = window.matchMedia('(min-width: 768px)');
const motionMQ = window.matchMedia('(prefers-reduced-motion: no-preference)');
let scene3d = null;

async function init(){
  if (scene3d) return;
  const canvas = document.getElementById('scene');
  let THREE;
  try { THREE = await import('three'); } catch (e) { canvas.style.display = 'none'; return; }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (e) { canvas.style.display = 'none'; return; }

  const state = {
    raf: 0, visible: true, dispP: 0, lastApplied: -1,
    px: 0, py: 0, cpx: 0, cpy: 0,
    disposed: false
  };

  renderer.setClearColor(0x0E0E0E, 1);
  const setSize = () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  };

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0E0E0E, 26, 52);   /* pushed back so the tower is not washed out */
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 1.0, 16.4);

  /* tower dimensions: 5 bays wide, 2 deep, 8 floors, slender high-rise massing */
  const BAY = 0.92, FLOOR = 1.06, BAYS_X = 5, BAYS_Z = 2, FLOORS = 8;
  const W = BAY * BAYS_X, D = BAY * BAYS_Z, H = FLOOR * FLOORS;
  const baseY = -3.9;

  const tower = new THREE.Group();
  tower.position.set(4.30, 0.05, 0);   /* base on the lower edge, mass bleeding off the right */
  tower.scale.setScalar(1.04);        /* the crown stays in frame so it reads as a tower */
  scene.add(tower);

  /* lighting: one cool key, one faint red rim from below */
  scene.add(new THREE.AmbientLight(0x484F57, 1.5));
  const key = new THREE.DirectionalLight(0xBFD3E6, 4.6);
  key.position.set(-6, 9, 7);
  scene.add(key);
  const rim = new THREE.PointLight(0xE12500, 46, 30, 2);
  rim.position.set(4.30, baseY - 2.2, 3.4);
  scene.add(rim);
  const sweep = new THREE.PointLight(0xFFE2D8, 0, 16, 2);
  sweep.position.set(4.30 - W / 2, baseY, 3.2);
  scene.add(sweep);

  /* ---- wireframe lattice: line segments sorted bottom-up for draw-in ---- */
  const segs = [];
  const colX = [], colZ = [];
  for (let i = 0; i <= BAYS_X; i++) colX.push(-W/2 + i*BAY);
  for (let i = 0; i <= BAYS_Z; i++) colZ.push(-D/2 + i*BAY);
  /* perimeter columns, split per floor so they draw upward */
  const colPts = [];
  colX.forEach(x => { colPts.push([x, -D/2], [x, D/2]); });
  colZ.slice(1, -1).forEach(z => { colPts.push([-W/2, z], [W/2, z]); });
  colPts.forEach(([x, z]) => {
    for (let f = 0; f < FLOORS; f++) {
      const y0 = baseY + f*FLOOR;
      segs.push({ a: [x, y0, z], b: [x, y0 + FLOOR, z], key: y0 + FLOOR/2 });
    }
  });
  /* perimeter ring beams at each level */
  for (let f = 0; f <= FLOORS; f++) {
    const y = baseY + f*FLOOR;
    segs.push({ a: [-W/2, y, -D/2], b: [W/2, y, -D/2], key: y + 0.01 });
    segs.push({ a: [-W/2, y,  D/2], b: [W/2, y,  D/2], key: y + 0.01 });
    segs.push({ a: [-W/2, y, -D/2], b: [-W/2, y, D/2], key: y + 0.01 });
    segs.push({ a: [ W/2, y, -D/2], b: [ W/2, y, D/2], key: y + 0.01 });
  }
  segs.sort((s1, s2) => s1.key - s2.key);
  const linePos = new Float32Array(segs.length * 6);
  segs.forEach((s, i) => { linePos.set([...s.a, ...s.b], i * 6); });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  lineGeo.setDrawRange(0, 0);
  const lineMat = new THREE.LineBasicMaterial({ color: 0xCED3D8, transparent: true, opacity: 1 });
  const wire = new THREE.LineSegments(lineGeo, lineMat);
  tower.add(wire);

  /* ---- solid beams: one instanced mesh ---- */
  /* A high metalness with no environment map renders almost black, which is
     what made the middle of the build sequence look like an empty frame. Keep
     the steel mostly dielectric and give it a little self lighting. */
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x9AA1A8, metalness: 0.18, roughness: 0.55,
    emissive: 0x2B3238, emissiveIntensity: 0.55, transparent: true, opacity: 0
  });
  const beamDefs = [];
  colPts.forEach(([x, z]) => beamDefs.push({ p: [x, baseY + H/2, z], s: [0.07, H, 0.07] }));
  for (let f = 0; f <= FLOORS; f++) {
    const y = baseY + f*FLOOR;
    beamDefs.push({ p: [0, y, -D/2], s: [W + 0.07, 0.07, 0.07] });
    beamDefs.push({ p: [0, y,  D/2], s: [W + 0.07, 0.07, 0.07] });
    beamDefs.push({ p: [-W/2, y, 0], s: [0.07, 0.07, D] });
    beamDefs.push({ p: [ W/2, y, 0], s: [0.07, 0.07, D] });
  }
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), beamMat, beamDefs.length);
  const m4 = new THREE.Matrix4();
  beamDefs.forEach((b, i) => {
    m4.compose(
      new THREE.Vector3(...b.p),
      new THREE.Quaternion(),
      new THREE.Vector3(...b.s)
    );
    beams.setMatrixAt(i, m4);
  });
  beams.visible = false;
  tower.add(beams);

  /* ---- curtain wall panels: front face + left face, attach bay by bay ---- */
  const panelGeo = new THREE.PlaneGeometry(BAY - 0.08, FLOOR - 0.08);
  const panels = [];
  let k = 0;
  for (let f = 0; f < FLOORS; f++) {
    const y = baseY + FLOOR/2 + f*FLOOR;
    for (let i = 0; i < BAYS_X; i++) {                    /* front face */
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1B242C, metalness: 0.8, roughness: 0.22,
        emissive: 0x1A3441, emissiveIntensity: 1.05, transparent: true, opacity: 0
      });
      const p = new THREE.Mesh(panelGeo, mat);
      p.position.set(-W/2 + BAY/2 + i*BAY, y, D/2 + 0.02);
      panels.push({ mesh: p, base: p.position.clone(), dir: new THREE.Vector3(0, 0, 1), k: k++ });
      p.visible = false; tower.add(p);
    }
    for (let i = 0; i < BAYS_Z; i++) {                    /* left face, toward camera side */
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1B242C, metalness: 0.8, roughness: 0.22,
        emissive: 0x1A3441, emissiveIntensity: 1.05, transparent: true, opacity: 0
      });
      const p = new THREE.Mesh(panelGeo, mat);
      p.position.set(-W/2 - 0.02, y, -D/2 + BAY/2 + i*BAY);
      p.rotation.y = -Math.PI / 2;
      panels.push({ mesh: p, base: p.position.clone(), dir: new THREE.Vector3(-1, 0, 0), k: k++ });
      p.visible = false; tower.add(p);
    }
  }
  const PANEL_COUNT = panels.length;

  /* ---- red fin, grows from the base on the tower's left edge ---- */
  const finGeo = new THREE.BoxGeometry(0.14, 1, 0.62);
  finGeo.translate(0, 0.5, 0);
  const finMat = new THREE.MeshStandardMaterial({
    color: 0xE12500, metalness: 0.3, roughness: 0.5,
    emissive: 0xE12500, emissiveIntensity: 0.25, transparent: true, opacity: 0
  });
  const fin = new THREE.Mesh(finGeo, finMat);
  fin.position.set(-W/2 - 0.16, baseY, D/2 - 0.5);
  fin.visible = false;
  tower.add(fin);

  const clamp01 = v => Math.max(0, Math.min(1, v));
  const outBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

  function applyP(p){
    /* phase 1: wireframe draws in, bottom to top; a base frame is always present */
    const wf = Math.max(clamp01(p / 0.3), 0.44);   /* header starts on a standing frame */
    lineGeo.setDrawRange(0, Math.floor(segs.length * wf) * 2);
    lineMat.opacity = 1 - 0.5 * clamp01((p - 0.52) / 0.3);
    wire.visible = lineMat.opacity > 0.05 && wf > 0;

    /* phase 2a: beams solidify */
    const bo = clamp01((p - 0.3) / 0.16);
    beamMat.opacity = bo;
    beams.visible = bo > 0.01;

    /* phase 2b: panels fly in and attach with overshoot */
    for (let i = 0; i < PANEL_COUNT; i++) {
      const pl = panels[i];
      const start = 0.34 + (pl.k / PANEL_COUNT) * 0.34;
      const t = clamp01((p - start) / 0.07);
      if (t <= 0) { pl.mesh.visible = false; continue; }
      pl.mesh.visible = true;
      const e = outBack(t);
      pl.mesh.position.copy(pl.base).addScaledVector(pl.dir, (1 - e) * 2.4);
      pl.mesh.position.y = pl.base.y + (1 - e) * 0.5;
      pl.mesh.material.opacity = t;
    }

    /* phase 3: red fin + one light sweep */
    const ft = clamp01((p - 0.7) / 0.12);
    fin.visible = ft > 0;
    fin.scale.y = Math.max(ft, 0.001) * H * 1.03;
    finMat.opacity = ft;
    const st = clamp01((p - 0.8) / 0.2);
    sweep.intensity = Math.sin(st * Math.PI) * 46;
    sweep.position.y = baseY - 0.5 + st * (H + 2);
  }

  /* pointer parallax, lerped */
  const onPointer = (e) => {
    state.px = (e.clientX / window.innerWidth - 0.5);
    state.py = (e.clientY / window.innerHeight - 0.5);
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  /* render only while the hero or the movements section is on screen */
  const io = new IntersectionObserver((entries) => {
    state.visible = entries.some(en => en.isIntersecting) ||
      !!document.querySelector('#hero, #movements') && isAnyVisible();
  });
  function isAnyVisible(){
    return ['hero', 'movements'].some(id => {
      const el = document.getElementById(id);
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.bottom > 0 && r.top < window.innerHeight;
    });
  }
  ['hero', 'movements'].forEach(function(id){
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });

  const look = new THREE.Vector3(2.4, 0.35, 0);
  function tick(t){
    state.raf = requestAnimationFrame(tick);
    if (state.disposed || document.hidden) return;
    if (!isAnyVisible()) return;                    /* pause loop off-screen */

    const target = (window.__AGC && window.__AGC.P) || 0;
    state.dispP += (target - state.dispP) * 0.14;
    if (Math.abs(state.dispP - state.lastApplied) > 0.0004) {
      applyP(state.dispP);
      state.lastApplied = state.dispP;
    }

    /* idle orbit drift, 4 degrees amplitude, plus lerped mouse parallax */
    state.cpx += (state.px - state.cpx) * 0.05;
    state.cpy += (state.py - state.cpy) * 0.05;
    const a = Math.sin(t * 0.00022) * (4 * Math.PI / 180);
    camera.position.x = Math.sin(a) * 16.4 * 0.35 + state.cpx * 0.9;
    camera.position.y = 1.0 - state.cpy * 0.5;
    camera.lookAt(look);
    renderer.render(scene, camera);
  }

  window.addEventListener('resize', setSize);
  setSize();
  applyP(0);
  state.raf = requestAnimationFrame(tick);

  scene3d = {
    dispose(){
      state.disposed = true;
      cancelAnimationFrame(state.raf);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('resize', setSize);
      io.disconnect();
      scene.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) { Array.isArray(o.material) ? o.material.forEach(m => m.dispose()) : o.material.dispose(); }
      });
      renderer.dispose();
      canvas.remove();
      scene3d = null;
    }
  };
}

function evaluate(){
  if (wideMQ.matches && motionMQ.matches) { init(); }
  else if (scene3d) { scene3d.dispose(); }
}
wideMQ.addEventListener('change', evaluate);
motionMQ.addEventListener('change', evaluate);
evaluate();
}
