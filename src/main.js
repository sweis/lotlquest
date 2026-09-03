// LotlQuest — boot, fixed-step sim loop, UI shell, debug hooks (window.lotl).

import * as THREE from 'three';
import { WORLD, makeHeightField, buildTerrainMesh } from './world/terrain.js';
import { buildSky } from './world/sky.js';
import { buildWater } from './world/water.js';
import { buildVegetation } from './world/vegetation.js';
import { buildVillage } from './world/village.js';
import { buildTrails } from './world/trails.js';
import { buildMonsters } from './world/monsters.js';
import { buildCave } from './world/cave.js';
import { buildPickups } from './world/pickups.js';
import { createNPCs } from './world/npcs.js';
import { createDialog } from './game/dialog.js';
import { createInventory } from './game/inventory.js';
import { createTouchControls } from './game/touch.js';
import { buildCoal } from './player/coal.js';
import { createController } from './player/controller.js';
import { createCamera } from './game/camera.js';
import { createMinimap } from './game/minimap.js';
import { createCombat } from './game/combat.js';
import { createShop } from './game/shop.js';
import { createOverlay } from './debug/overlay.js';

const params = new URLSearchParams(location.search);
const FIXED_DT = params.has('simdt') ? parseFloat(params.get('simdt')) : 1 / 60;
let seed = params.has('seed') ? (parseInt(params.get('seed'), 10) >>> 0) : 4242;

// ---------------------------------------------------------------- renderer
// graphics mode: 'high' (default) or 'low' — persisted, applied before the
// first frame (toggling reloads so shader programs stay constant)
let gfxLow = false;
try { gfxLow = localStorage.getItem('lotlquest-gfx') === 'low'; } catch { /* default high */ }

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: !gfxLow, powerPreference: 'high-performance' });
renderer.setPixelRatio(gfxLow ? 1 : Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !gfxLow;
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
let field, terrain, vegetation, village, monsters, npcs, cave, pickups, peakSpot;
let minimap = null, combat = null;
const OBSTACLES = []; // building colliders, refilled on world build
const water = buildWater();
scene.add(water);
const sky = buildSky(scene);

function findPeak() {
  const R = WORLD.size / 2 - 16;
  let best = { x: 0, z: 0, h: -Infinity };
  for (let gx = -R; gx <= R; gx += 8) {
    for (let gz = -R; gz <= R; gz += 8) {
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
  if (village) {
    scene.remove(village.group);
    village.group.traverse((o) => o.geometry && o.geometry.dispose());
  }
  if (monsters) monsters.dispose(scene);
  if (npcs) npcs.dispose(scene);
  if (cave) cave.dispose(scene);
  if (pickups) pickups.dispose(scene);
  field = makeHeightField(seed);
  terrain = buildTerrainMesh(field);
  buildTrails(field, terrain); // paints paths into the terrain colors, sets WORLD.trails
  vegetation = buildVegetation(field, seed);
  village = buildVillage(field, seed);
  cave = buildCave(field, scene, seed);
  village.landmarks.push(cave.landmark); // toast + map dot + teleport spot
  monsters = buildMonsters(field, seed, scene);
  pickups = buildPickups(field, seed, scene);
  npcs = createNPCs(field, scene, village.landmarks, village.stalls, OBSTACLES);
  scene.add(terrain, vegetation, village.group);
  OBSTACLES.length = 0;
  OBSTACLES.push(...village.obstacles, ...vegetation.userData.obstacles, ...cave.obstacles, ...npcs.obstacles);
  if (gfxLow) { // fewer fine details in low mode
    const bladesMesh = vegetation.getObjectByName('grassBlades');
    if (bladesMesh) bladesMesh.visible = false;
  }
  peakSpot = findPeak();
  if (minimap) {
    minimap.rebuild();
    minimap.setLandmarks(village.landmarks);
    minimap.setTrails(WORLD.trails);
  }
  if (combat) combat.setMonsters(monsters);
}
buildWorld(seed);
// live reference so setSeed() swaps terrain under everyone at once.
// groundAt = the rendered mesh surface (installed by buildTerrainMesh) — all
// gameplay stands on that, never on the analytic field (floats at crests).
// Ground resolution for GAMEPLAY: the terrain mesh, plus walkable built
// surfaces (upper floors, stair ramps — the highest one within step-up reach
// of the player), plus the cave floor (which wins when the player is closer
// to it than to the mountain above). groundAt stays the raw terrain.
let _controller = null;
function walkGround(x, z) {
  let g = field.groundAt(x, z);
  const py = _controller ? _controller.state.pos.y : null;
  if (py === null) return g;
  if (cave) {
    const cf = cave.floorAt(x, z);
    if (cf !== null && Math.abs(py - cf) < Math.abs(py - g)) return cf;
  }
  if (village) {
    for (const s of village.walkSurfaces) {
      const dx = x - s.cx, dz = z - s.cz;
      const cs = Math.cos(s.rot), sn = Math.sin(s.rot);
      const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
      const ga = s.dir === 'x' ? lx : lz, gb = s.dir === 'x' ? lz : lx; // gradient axis / breadth axis
      if (Math.abs(gb) > s.hw || Math.abs(ga) > s.hl) continue;
      const y = s.type === 'rect' ? s.y : s.y0 + (s.y1 - s.y0) * ((s.hl - ga) / (2 * s.hl));
      if (y <= py + 0.55 && y > g) g = y; // step-up reach only — never teleport onto a floor above
    }
  }
  return g;
}
const undergroundAt = (x, z) => {
  if (!cave) return false;
  const cf = cave.floorAt(x, z);
  if (cf === null) return false;
  const py = _controller ? _controller.state.pos.y : 1e9;
  return Math.abs(py - cf) < Math.abs(py - field.groundAt(x, z));
};
const fieldRef = {
  heightAt: walkGround,
  groundAt: (x, z) => field.groundAt(x, z),
  isDry: undergroundAt, // cave floors below sea level are NOT water
};

// ---------------------------------------------------------------- player + camera
const coal = buildCoal();
scene.add(coal.root);
const controller = createController(fieldRef, coal.root, OBSTACLES);
_controller = controller;
const camera = createCamera(renderer, fieldRef);
controller.state.heading = 0; // face island centre (+Z)
camera.snapBehind(controller.state);
minimap = createMinimap(fieldRef);
minimap.setLandmarks(village.landmarks);
minimap.setTrails(WORLD.trails);

// ---------------------------------------------------------------- combat + shop
function updateHUD() {
  if (!combat) return; // called once during combat's own construction
  const hpEl = document.getElementById('hearts');
  const slots = combat.maxHp() / 2;
  let html = '';
  for (let i = 0; i < slots; i++) {
    const left = combat.state.hp - i * 2;
    if (left >= 2) html += '<span class="full">♥</span>';
    else if (left === 1) html += '<span class="full" style="opacity:.55">♥</span>';
    else html += '<span class="empty">♥</span>';
  }
  hpEl.innerHTML = html;
  document.getElementById('tokenCount').textContent = combat.state.tokens;
  const wnames = { melee: ['Bite', 'Wooden Sword', 'Iron Sword'][combat.state.equippedMelee], bow: 'Kelp Bow' };
  const buffNames = { speed: 'Zoom!', guard: 'Stoneskin', luck: 'Lucky' };
  const active = Object.keys(combat.state.buffs)
    .filter((k) => combat.state.buffs[k] > 0)
    .map((k) => buffNames[k]);
  document.getElementById('weaponRow').textContent =
    wnames[combat.state.weapon] + (combat.state.bow ? '  ·  1/2 to switch' : '') + '  ·  F to attack' +
    (active.length ? '  ·  ' + active.join(' · ') : '');
  const ing = combat.state.ingredients;
  const fishTotal = combat.state.fish.minnow + combat.state.fish.trout + combat.state.fish.sunfish;
  document.getElementById('ingRow').innerHTML =
    ((ing.kelp + ing.berry + ing.petal + fishTotal) === 0 ? '' :
      `<span><span class="ing ing-kelp"></span>${ing.kelp}</span>` +
      `<span><span class="ing ing-berry"></span>${ing.berry}</span>` +
      `<span><span class="ing ing-petal"></span>${ing.petal}</span>` +
      (fishTotal ? `<span>🐟 ${fishTotal}</span>` : ''));
  // Coal's weapon rack at home mirrors what he owns
  if (village && village.rack) {
    village.rack.sword1.visible = combat.state.melee >= 1;
    village.rack.sword2.visible = combat.state.melee >= 2;
    village.rack.bow1.visible = combat.state.bow >= 1;
    village.rack.shell1.visible = combat.state.shell >= 1;
    village.rack.shell2.visible = combat.state.shell >= 2;
  }
}
combat = createCombat({ scene, coal, controller, field: fieldRef, onChange: updateHUD });
combat.setMonsters(monsters);
updateHUD();
let saveTimer = 0;
// resume exactly where the last session ended
{
  const sp = combat.getSavedPos();
  if (sp && field.groundAt(sp.x, sp.z) > WORLD.seaLevel - 0.6) {
    controller.teleport(sp.x, sp.z, sp.heading ?? 0);
    camera.snapBehind(controller.state);
  }
}
window.addEventListener('pagehide', () => combat.save());
const inventory = createInventory(combat);
document.getElementById('inventoryClose').addEventListener('click', () => inventory.close());
document.getElementById('bagBtn').addEventListener('click', () => inventory.toggle());
// shops open only when the player clicks a stall/building — never by proximity
const dialog = createDialog();
const touch = createTouchControls({ controller, combat, camera });
const shop = createShop(combat, () => {});
document.getElementById('shopClose').addEventListener('click', () => shop.close());
const SHOP_SPOTS = [
  { mode: 'armory', r: 5.2, at: () => village.landmarks.find((l) => l.name === 'The Armory') },
  { mode: 'weapons', r: 2.7, at: () => village.stalls.find((s) => s.mode === 'weapons') },
  { mode: 'market', r: 2.7, at: () => village.stalls.find((s) => s.mode === 'market') },
  { mode: 'potions', r: 2.7, at: () => village.stalls.find((s) => s.mode === 'potions') },
  { mode: 'brewing', r: 2.2, at: () => village.brewStand },
  { mode: 'fishsale', r: 2.6, at: () => village.fishStandPos },
];

// ------------------------------------------------------- fishing
let fishing = null; // { t, dur }
function startFishing() {
  if (fishing) return;
  fishing = { t: 0, dur: 1.8 + Math.random() * 2.8 };
  showToast('Fishing…');
}

function onPlayerDeath() {
  setPhase('lost');
  setTimeout(() => {
    controller.teleport(WORLD.spawn.x, WORLD.spawn.z, 0);
    camera.snapBehind(controller.state);
    combat.respawn();
    setPhase('playing');
  }, 2200);
}

window.addEventListener('keydown', (e) => {
  if (phase !== 'playing' || shop.isOpen()) return;
  if (e.code === 'KeyI' || e.key === 'i' || e.key === 'I') { if (!e.repeat) inventory.toggle(); }
  if (inventory.isOpen()) return;
  if (e.code === 'KeyF' || e.key === 'f' || e.key === 'F') { if (!e.repeat) combat.tryAttack(); }
  if (e.code === 'Digit1' || e.key === '1') combat.setWeapon('melee');
  if (e.code === 'Digit2' || e.key === '2') combat.setWeapon('bow');
});

// ---------------------------------------------------------------- click-to-walk
const walkMarker = new THREE.Mesh(
  new THREE.TorusGeometry(0.45, 0.06, 8, 24),
  new THREE.MeshBasicMaterial({ color: 0xf4c95d }));
walkMarker.rotation.x = -Math.PI / 2;
walkMarker.visible = false;
scene.add(walkMarker);
{
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let downX = 0, downY = 0, downT = 0;
  renderer.domElement.addEventListener('pointerdown', (e) => {
    downX = e.clientX; downY = e.clientY; downT = performance.now();
  });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (phase !== 'playing') return;
    const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
    if (moved > 6 || performance.now() - downT > 450) return; // that was a drag
    if (dialog.isOpen()) dialog.close(); // ground click dismisses chat, then acts
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera.cam);

    // an axolotl? talk if close, walk over if not
    const npc = npcs.raycast(ray);
    if (npc) {
      const p = npc.ax.root.position;
      const d = Math.hypot(controller.state.pos.x - p.x, controller.state.pos.z - p.z);
      if (d < 4.5) {
        dialog.open(npc);
      } else {
        controller.setWalkTarget(p.x, p.z);
        walkMarker.position.set(p.x, field.groundAt(p.x, p.z) + 0.08, p.z);
      }
      return;
    }

    const vHits = ray.intersectObjects(village.group.children, true);

    // the fishing pier? cast a line if close, walk over if not
    if (vHits.length && vHits[0].object.userData.fishSpot && village.fishSpot) {
      const fs = village.fishSpot;
      const d = Math.hypot(controller.state.pos.x - fs.x, controller.state.pos.z - fs.z);
      if (d < 3.6) {
        startFishing();
      } else {
        controller.setWalkTarget(fs.x, fs.z);
        walkMarker.position.set(fs.x, WORLD.seaLevel + 0.55, fs.z);
      }
      return;
    }

    // a shop? (stall, the armory, or the cauldron) — click to open, never auto
    if (vHits.length && vHits[0].object.userData.shopMode) {
      const mode = vHits[0].object.userData.shopMode;
      const hp = vHits[0].point;
      const d = Math.hypot(controller.state.pos.x - hp.x, controller.state.pos.z - hp.z);
      if (d < 5) {
        shop.open(mode);
        controller.keys.clear();
      } else {
        controller.setWalkTarget(hp.x, hp.z);
        walkMarker.position.set(hp.x, field.groundAt(hp.x, hp.z) + 0.08, hp.z);
      }
      return;
    }

    const hits = ray.intersectObjects([terrain, water], false);
    const hit = hits.find((h) => h.object === terrain) ?? hits[0];
    if (!hit) return;
    controller.setWalkTarget(hit.point.x, hit.point.z);
    walkMarker.position.set(hit.point.x, field.groundAt(hit.point.x, hit.point.z) + 0.08, hit.point.z);
  });
}

// ---------------------------------------------------------------- spawned extras
const spawned = new THREE.Group(); spawned.name = 'spawned';
scene.add(spawned);
function spawnThing(kind, at) {
  const p = at ?? { x: controller.state.pos.x + 2, z: controller.state.pos.z + 2 };
  const y = field.groundAt(p.x, p.z);
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
  ['W / S', 'walk forward / back (hold Shift to run)'],
  ['A / D', 'turn left / right'],
  ['Q / E', 'sidestep'],
  ['click / tap ground', 'walk there'],
  ['click an axolotl', 'talk (click again for more)'],
  ['click a stall / armory / cauldron', 'shop or brew'],
  ['click the pier at the Hunting Point', 'fish — sell your catch at the fish stand'],
  ['F', 'attack (bite, sword, or bow)'],
  ['I / 🎒', 'inventory — equip any weapon you own'],
  ['1 / 2', 'switch melee / bow'],
  ['Space', 'jump'],
  ['drag mouse', 'orbit camera — it holds that angle as you move'],
  ['scroll', 'zoom camera'],
  ['M', 'toggle map'],
  ['Esc', 'pause'],
  ['?', 'this help'],
  ['`', 'diagnostics overlay'],
];
const GOALS = [
  'Explore the island as Coal the axolotl — follow the trails.',
  'Pop bog slimes (F) for tokens; walk to the armory door to buy weapons and armor.',
  'Climb Hope of the Axolotls Hill, wade the Kelp Grounds, scout the Hunting Point.',
];

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
  if (phase === 'playing') {
    document.getElementById('minimap').style.display = 'block';
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('helpBtn').style.display = 'block';
    document.getElementById('bagBtn').style.display = 'block';
  }
}
document.getElementById('helpBtn').addEventListener('click', () => {
  helpEl.style.display = helpEl.style.display === 'block' ? 'none' : 'block';
});
document.getElementById('resetSave').addEventListener('click', () => {
  if (!confirm('Reset your save? Tokens and gear will be lost.')) return;
  combat.resetSave();
  location.reload();
});
{
  const gfxBtn = document.getElementById('gfxToggle');
  gfxBtn.textContent = gfxLow ? 'Graphics: Low' : 'Graphics: High';
  gfxBtn.addEventListener('click', () => {
    try { localStorage.setItem('lotlquest-gfx', gfxLow ? 'high' : 'low'); } catch { /* no storage */ }
    location.reload(); // shadows/AA/pixel ratio change cleanly on boot
  });
}

// ------------------------------------------------------- landmark discovery
const toastEl = document.getElementById('toast');
const insideLandmarks = new Set();
let toastTimer = 0;
function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}
function updateLandmarks() {
  const p = controller.state.pos;
  for (const lm of village.landmarks) {
    const d = Math.hypot(p.x - lm.x, p.z - lm.z);
    if (d < lm.r) {
      if (!insideLandmarks.has(lm.name)) { insideLandmarks.add(lm.name); showToast(lm.name); }
    } else {
      insideLandmarks.delete(lm.name);
    }
  }
}
document.getElementById('playBtn').addEventListener('click', () => setPhase('playing'));
document.getElementById('resumeBtn').addEventListener('click', () => setPhase('playing'));
document.getElementById('helpClose').addEventListener('click', () => { helpEl.style.display = 'none'; });
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && helpEl.style.display === 'block') { helpEl.style.display = 'none'; return; }
  if (e.key === 'Escape' && inventory.isOpen()) { inventory.close(); return; }
  if (e.key === 'Escape' && dialog.isOpen()) { dialog.close(); return; }
  if (e.key === 'Escape' && shop.isOpen()) { shop.close(); return; } // close() blocks reopen itself
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
  const paused = phase !== 'playing' || shop.isOpen();
  controller.state.speedMul = combat.state.buffs.speed > 0 ? 1.45 : 1; // Zoom Juice
  controller.update(paused ? 0 : dt); // tank controls — camera-independent
  const s = controller.state;
  const airGap = Math.max(0, s.pos.y - fieldRef.heightAt(s.pos.x, s.pos.z));
  coal.animate(dt, paused ? 0 : s.speed, s.grounded, airGap);
  if (!paused) {
    combat.update(dt);
    if (fishing) {
      if (controller.state.speed > 0.4) {
        fishing = null;
        showToast('The fish got away…');
      } else {
        fishing.t += dt;
        if (fishing.t >= fishing.dur) {
          const f = combat.catchFish();
          showToast(`Caught a ${f.name}!`);
          fishing = null;
        }
      }
    }
    pickups.update(dt, controller.state, (kind) => combat.collectIngredient(kind));
    npcs.update(dt, controller.state);
    // walking away ends a conversation
    if (dialog.isOpen()) {
      const sp = dialog.speaker().ax.root.position;
      if (Math.hypot(controller.state.pos.x - sp.x, controller.state.pos.z - sp.z) > 5.5) dialog.close();
    }
    monsters.update(dt, controller.state, {
      contact: (s) => {
        if (combat.damagePlayer(1, s.mesh.position.x, s.mesh.position.z) === 'died') onPlayerDeath();
      },
    });
  }
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
  if (phase === 'playing') updateLandmarks();
  minimap.draw(controller.state, { npcs: npcs.list, monsters: monsters.slimes });

  // shops are click-to-open; walking away from an open one closes it
  if (phase === 'playing' && shop.isOpen()) {
    const spot = SHOP_SPOTS.find((s) => s.mode === shop.mode());
    const lm = spot && spot.at();
    if (lm) {
      const d = Math.hypot(controller.state.pos.x - lm.x, controller.state.pos.z - lm.z);
      if (d > spot.r + 4) shop.close();
    }
  }

  // fade the house Coal is inside (or at the door of) so the camera can see
  // him, and pull the chase camera in close while indoors
  let insideAnyHouse = false;
  for (const h of village.fadeHouses) {
    const inside = Math.hypot(controller.state.pos.x - h.x, controller.state.pos.z - h.z) < h.r * 1.05;
    if (inside) insideAnyHouse = true;
    for (const m of h.mats) {
      const target = inside ? 0.28 : 1;
      m.opacity += (target - m.opacity) * (1 - Math.exp(-10 * dt));
      m.transparent = m.opacity < 0.995;
    }
  }
  const homeArrow = village.group.userData.homeArrow;
  if (homeArrow) {
    homeArrow.userData.baseY ??= homeArrow.position.y;
    homeArrow.rotation.y += dt * 1.3;
    homeArrow.position.y = homeArrow.userData.baseY + Math.sin(now * 0.0028) * 0.3;
  }
  const inCave = cave.inside(controller.state.pos.x, controller.state.pos.z);
  camera.setIndoor(insideAnyHouse || inCave);
  cave.update(dt); // torch flicker
  saveTimer += dt;
  if (saveTimer > 6 && phase === 'playing') { saveTimer = 0; combat.save(); } // keep everything

  // walk marker: visible while a click target is active, gentle pulse
  const wt = controller.state.walkTarget;
  walkMarker.visible = !!wt;
  if (wt) walkMarker.scale.setScalar(1 + Math.sin(now * 0.008) * 0.15);

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
    // effective shadow-light direction (must track sunDirection exactly and
    // never change with player position)
    sunDir: (() => {
      const d = sky.sun.position.clone().sub(sky.sun.target.position).normalize();
      return { x: +d.x.toFixed(5), y: +d.y.toFixed(5), z: +d.z.toFixed(5) };
    })(),
    walkTarget: s.walkTarget ? { ...s.walkTarget } : null,
    stick: s.stick ? { ...s.stick } : null,
    touchControls: touch.enabled,
    combat: {
      hp: combat.state.hp, maxHp: combat.maxHp(), tokens: combat.state.tokens,
      melee: combat.state.melee, bow: combat.state.bow, shell: combat.state.shell,
      equippedMelee: combat.state.equippedMelee,
      weapon: combat.state.weapon, kills: combat.state.kills,
      monstersAlive: monsters.aliveCount(), shopOpen: shop.isOpen(),
      buffs: { ...combat.state.buffs },
      ingredients: { ...combat.state.ingredients },
      fish: { ...combat.state.fish },
      fishing: !!fishing,
    },
    entities: {
      ...(vegetation.userData.counts), ...(village.group.userData.counts),
      obstacles: OBSTACLES.length, spawned: spawned.children.length,
    },
    landmarks: village.landmarks.map((lm) => ({
      name: lm.name, x: lm.x, z: lm.z,
      dist: Math.round(Math.hypot(s.pos.x - lm.x, s.pos.z - lm.z)),
    })),
    npcs: npcs.list.map((n) => ({
      name: n.name, x: +n.ax.root.position.x.toFixed(1), z: +n.ax.root.position.z.toFixed(1),
      dist: Math.round(Math.hypot(s.pos.x - n.ax.root.position.x, s.pos.z - n.ax.root.position.z)),
      talking: dialog.isOpen() && dialog.speaker() === n,
    })),
    world: { size: WORLD.size, seaLevel: WORLD.seaLevel, peak: peakSpot },
    frameMsP50: percentile(0.5), frameMsP99: percentile(0.99),
    drawCalls, triangles,
    programs: renderer.info.programs.length,
    gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    contextLost,
  };
}

const lmSpot = (name, dx = 0, dz = 0) => () => {
  const lm = village.landmarks.find((l) => l.name === name);
  return { x: lm.x + dx, z: lm.z + dz };
};
const NAMED_SPOTS = {
  spawn: () => ({ x: WORLD.spawn.x, z: WORLD.spawn.z }),
  peak: () => ({ x: peakSpot.x, z: peakSpot.z }),
  beach: () => { // first sand south of spawn, backed up onto dry land
    for (let z = WORLD.spawn.z; z > -WORLD.size / 2; z -= 2) {
      if (field.groundAt(WORLD.spawn.x, z) < WORLD.seaLevel + 0.5) {
        return { x: WORLD.spawn.x, z: z + 4 };
      }
    }
    return { x: WORLD.spawn.x, z: WORLD.spawn.z };
  },
  village: lmSpot('Axolotl Village', 0, -24),
  square: lmSpot('Town Square', 0, -5),
  market: lmSpot('Food Market', 0, -4),
  armory: lmSpot('The Armory', 0, -5),
  hill: lmSpot('Hope of the Axolotls Hill', 0, -6),
  kelp: lmSpot('The Kelp Grounds', 0, 14),
  hunt: lmSpot('The Hunting Point', -4, 4),
  cave: lmSpot('Moxolotl Cave', 0, 0),
  home: lmSpot("Coal's House", 0, -4),
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
  heightAt: (x, z) => field.groundAt(x, z),
  modelMinY() { // world-space lowest point of Coal vs the ground under him
    const b = new THREE.Box3().setFromObject(coal.root);
    return { minY: b.min.y, groundY: field.groundAt(controller.state.pos.x, controller.state.pos.z) };
  },
  press(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code, cancelable: true })); },
  release(code) { window.dispatchEvent(new KeyboardEvent('keyup', { code, cancelable: true })); },
  attack() { combat.tryAttack(); },
  giveTokens(n) { combat.state.tokens += n | 0; combat.save(); updateHUD(); },
  hurt(n) { combat.damagePlayer(n | 0, controller.state.pos.x + 1, controller.state.pos.z); },
  buy(id) { const r = combat.buy(id); shop.render(); return r; },
  buyFood(id) { const r = combat.buyFood(id); shop.render(); return r; },
  buyPotion(id) { const r = combat.buyPotion(id); shop.render(); return r; },
  brew(id) { const r = combat.brew(id); shop.render(); return r; },
  giveIngredients(n) { for (const k of ['kelp', 'berry', 'petal']) combat.state.ingredients[k] += n | 0; combat.save(); updateHUD(); },
  cave: () => ({ entrance: cave.entrance, chamber: cave.chamber }),
  surfaces: () => village.walkSurfaces,
  pickups: () => pickups.items.map((i) => ({ kind: i.kind, x: +i.home.x.toFixed(1), z: +i.home.z.toFixed(1), alive: i.alive })),
  equip(id) { const r = combat.equip(id); return r; },
  fish() { startFishing(); },
  catchFish(id) { const f = combat.catchFish(id); return f.name; },
  fishSpot: () => village.fishSpot,
  openShop(mode) { shop.open(mode); },
  closeShop() { shop.close(); },
  monsters: () => monsters,
  houses: () => village.fadeHouses.map((h) => ({ x: h.x, z: h.z, r: h.r })),
  fadeDebug: () => village.fadeHouses.map((h) => ({
    r: +h.r.toFixed(2),
    d: +Math.hypot(controller.state.pos.x - h.x, controller.state.pos.z - h.z).toFixed(2),
    op: +h.mats[0].opacity.toFixed(2),
    transparent: h.mats[0].transparent,
  })),
  talkTo(name) {
    const n = npcs.list.find((x) => x.name.toLowerCase() === String(name).toLowerCase());
    if (!n) throw new Error(`no NPC "${name}" (${npcs.list.map((x) => x.name).join(', ')})`);
    dialog.open(n);
    return n.lines[(n.lineIndex) % n.lines.length];
  },
  closeDialog() { dialog.close(); },
};

const overlay = createOverlay(renderer, getState);
if (params.has('cam')) camera.setMode(params.get('cam'));

console.log(`LotlQuest boot ok — seed ${seed}, build ${document.title}`);
