// LotlQuest — boot, fixed-step sim loop, UI shell, debug hooks (window.lotl).

import * as THREE from 'three';
import { WORLD, makeHeightField, buildTerrainMesh } from './world/terrain.js';
import { buildSky } from './world/sky.js';
import { buildWater } from './world/water.js';
import { buildVegetation } from './world/vegetation.js';
import { buildCoal } from './player/coal.js';
import { createController } from './player/controller.js';
import { createCamera } from './game/camera.js';
import { createOverlay } from './debug/overlay.js';

const params = new URLSearchParams(location.search);
const FIXED_DT = params.has('simdt') ? parseFloat(params.get('simdt')) : 1 / 60;
let seed = params.has('seed') ? (parseInt(params.get('seed'), 10) >>> 0) : 4242;

// ---------------------------------------------------------------- renderer
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);

let contextLost = false;
renderer.domElement.addEventListener('webglcontextlost', (e) => {
  e.preventDefault(); contextLost = true;
  document.getElementById('ctxlost').style.display = 'flex';
});
document.getElementById('ctxlost').addEventListener('pointerdown', () => location.reload());

const scene = new THREE.Scene();

// ---------------------------------------------------------------- world
let field, terrain, vegetation, peakSpot;
const water = buildWater();
scene.add(water);
const sky = buildSky(scene);

function findPeak() {
  let best = { x: 0, z: 0, h: -Infinity };
  for (let gx = -240; gx <= 240; gx += 8) {
    for (let gz = -240; gz <= 240; gz += 8) {
      const h = field.heightAt(gx, gz);
      if (h > best.h) best = { x: gx, z: gz, h };
    }
  }
  return best;
}

function buildWorld(newSeed) {
  seed = newSeed >>> 0;
  if (terrain) { scene.remove(terrain); terrain.geometry.dispose(); }
  if (vegetation) {
    scene.remove(vegetation);
    vegetation.traverse((o) => o.geometry && o.geometry.dispose());
  }
  field = makeHeightField(seed);
  terrain = buildTerrainMesh(field);
  vegetation = buildVegetation(field, seed);
  scene.add(terrain, vegetation);
  peakSpot = findPeak();
}
buildWorld(seed);
// live reference so setSeed() swaps terrain under everyone at once
const fieldRef = { heightAt: (x, z) => field.heightAt(x, z) };

// ---------------------------------------------------------------- player + camera
const coal = buildCoal();
scene.add(coal.root);
const controller = createController(fieldRef, coal.root);
const camera = createCamera(renderer, fieldRef);
controller.state.heading = 0; // face island centre (+Z)
camera.snapBehind(controller.state);

// ---------------------------------------------------------------- spawned extras
const spawned = new THREE.Group(); spawned.name = 'spawned';
scene.add(spawned);
function spawnThing(kind, at) {
  const p = at ?? { x: controller.state.pos.x + 2, z: controller.state.pos.z + 2 };
  const y = field.heightAt(p.x, p.z);
  let mesh;
  if (kind === 'rock') {
    mesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.7, 0),
      new THREE.MeshStandardMaterial({ color: 0x8b8578, roughness: 0.95 }));
  } else if (kind === 'coin') {
    mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.08, 20),
      new THREE.MeshStandardMaterial({ color: 0xf4c95d, roughness: 0.3, metalness: 0.7 }));
    mesh.rotation.x = Math.PI / 2;
  } else {
    throw new Error(`unknown spawn kind "${kind}" (rock | coin)`);
  }
  mesh.position.set(p.x, y + 0.5, p.z);
  mesh.castShadow = true;
  spawned.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------- game phase + UI
let phase = 'title'; // title | playing | paused | won | lost
const CONTROLS = [
  ['W A S D / arrows', 'walk (hold Shift to run)'],
  ['Space', 'jump'],
  ['drag mouse', 'look around (recenters as you walk)'],
  ['scroll', 'zoom camera'],
  ['Esc', 'pause'],
  ['?', 'this help'],
  ['`', 'diagnostics overlay'],
];
const GOALS = ['Explore the island as Coal the axolotl.', 'Coins, battles and the town market are coming in later builds.'];

function fillSheet(id) {
  const rows = CONTROLS.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  document.getElementById(id).innerHTML =
    `<table>${rows}</table><div class="foot">${GOALS.join('<br>')}</div>`;
}
fillSheet('helpBody'); fillSheet('pauseBody');

const titleEl = document.getElementById('title');
const pauseEl = document.getElementById('pause');
const helpEl = document.getElementById('help');
const bannerEl = document.getElementById('banner');

function setPhase(p) {
  phase = p;
  titleEl.style.display = phase === 'title' ? 'flex' : 'none';
  pauseEl.style.display = phase === 'paused' ? 'block' : 'none';
  bannerEl.style.display = (phase === 'won' || phase === 'lost') ? 'block' : 'none';
  if (phase === 'won') bannerEl.textContent = 'YOU WIN';
  if (phase === 'lost') bannerEl.textContent = 'TRY AGAIN';
}
document.getElementById('playBtn').addEventListener('click', () => setPhase('playing'));
document.getElementById('resumeBtn').addEventListener('click', () => setPhase('playing'));
document.getElementById('helpClose').addEventListener('click', () => { helpEl.style.display = 'none'; });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && phase === 'playing') setPhase('paused');
  else if (e.key === 'Escape' && phase === 'paused') setPhase('playing');
  if (e.key === '?') helpEl.style.display = helpEl.style.display === 'block' ? 'none' : 'block';
});
if (params.has('play')) setPhase('playing');

// ---------------------------------------------------------------- sim loop
let simTime = 0, frozen = false;
const frameMs = new Float32Array(120); let frameIdx = 0, frameCount = 0;
let drawCalls = 0, triangles = 0;

function simTick(dt) {
  const paused = phase !== 'playing';
  // moveYaw = the direction the camera faces, so W walks away from camera
  controller.update(paused ? 0 : dt, camera.moveYaw());
  coal.animate(dt, paused ? 0 : controller.state.speed, controller.state.grounded);
  simTime += dt;
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (contextLost) return;
  const dt = Math.max(0, Math.min((now - last) / 1000, 0.25)); // clamp dt ≥ 0, cap stalls
  last = now;

  if (!frozen) {
    acc += dt;
    let ticks = 0;
    while (acc >= FIXED_DT && ticks < 5) { simTick(FIXED_DT); acc -= FIXED_DT; ticks++; }
    if (ticks === 5) acc = 0; // drop backlog after a stall — no teleport catch-up
  }

  camera.update(dt, controller.state);
  sky.updateShadowTarget(controller.state.pos);
  overlay.tick(dt);

  renderer.render(scene, camera.cam);
  frameMs[frameIdx] = dt * 1000; // wall frame time
  frameIdx = (frameIdx + 1) % frameMs.length; frameCount++;
  drawCalls = renderer.info.render.calls;
  triangles = renderer.info.render.triangles;
}

function resize() {
  const w = app.clientWidth, h = app.clientHeight;
  renderer.setSize(w, h, false);
  camera.cam.aspect = w / h;
  camera.cam.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
requestAnimationFrame(frame);

// ---------------------------------------------------------------- state + hooks
function percentile(p) {
  const n = Math.min(frameCount, frameMs.length);
  if (!n) return 0;
  const a = Array.from(frameMs.slice(0, n)).sort((x, y) => x - y);
  return a[Math.min(n - 1, Math.floor(p * n))];
}

function getState() {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const s = controller.state;
  return {
    phase,
    simTime,
    seed,
    frozen,
    player: {
      x: s.pos.x, y: s.pos.y, z: s.pos.z,
      vx: s.vel.x, vz: s.vel.z, vy: s.vy,
      speed: s.speed, heading: s.heading,
      grounded: s.grounded, swimming: s.swimming,
      inputCount: s.inputCount,
    },
    camera: camera.mode,
    camPos: { x: camera.cam.position.x, y: camera.cam.position.y, z: camera.cam.position.z },
    orbit: { yawOffset: camera.orbit.yawOffset, pitch: camera.orbit.pitch, dist: camera.orbit.dist },
    timeOfDay: sky.timeOfDay,
    entities: { ...(vegetation.userData.counts), spawned: spawned.children.length },
    world: { size: WORLD.size, seaLevel: WORLD.seaLevel, peak: peakSpot },
    frameMsP50: percentile(0.5), frameMsP99: percentile(0.99),
    drawCalls, triangles,
    programs: renderer.info.programs.length,
    gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    contextLost,
  };
}

const NAMED_SPOTS = {
  spawn: () => ({ x: WORLD.spawn.x, z: WORLD.spawn.z }),
  peak: () => ({ x: peakSpot.x, z: peakSpot.z }),
  beach: () => ({ x: WORLD.spawn.x + 30, z: WORLD.spawn.z - 10 }),
};

window.lotl = {
  getState,
  teleport(x, z, heading) {
    if (typeof x === 'string') {
      const spot = NAMED_SPOTS[x];
      if (!spot) throw new Error(`unknown spot "${x}" (${Object.keys(NAMED_SPOTS).join(', ')})`);
      const p = spot(); controller.teleport(p.x, p.z, z /* heading in arg 2 */);
    } else {
      controller.teleport(x, z, heading);
    }
    camera.snapBehind(controller.state);
    return getState().player;
  },
  freeze() { frozen = true; },
  resume() { frozen = false; last = performance.now(); },
  step(n = 1) { for (let i = 0; i < n; i++) simTick(FIXED_DT); },
  setTimeOfDay(h) { sky.setTimeOfDay(h); },
  setSeed(n) {
    buildWorld(n);
    window.lotl.teleport('spawn');
  },
  spawn: spawnThing,
  clearAll() { spawned.clear(); },
  win() { setPhase('won'); },
  lose() { setPhase('lost'); },
  play() { setPhase('playing'); },
  cam(name) { camera.setMode(name); },
  heightAt: (x, z) => field.heightAt(x, z),
  press(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true })); },
  release(code) { window.dispatchEvent(new KeyboardEvent('keyup', { code, cancelable: true })); },
};

const overlay = createOverlay(renderer, getState);
if (params.has('cam')) camera.setMode(params.get('cam'));

console.log(`LotlQuest boot ok — seed ${seed}, build ${document.title}`);
