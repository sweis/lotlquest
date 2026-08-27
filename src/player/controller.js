// Movement: camera-relative WASD, character turns toward travel, small jump.
// Real input path only — window key events; debug injection goes through the
// same `keys` set so both paths exercise identical code.

import * as THREE from 'three';
import { WORLD } from '../world/terrain.js';

const WALK = 3.4, RUN = 6.2, ACCEL = 18, TURN = 9;
const GRAVITY = 16, JUMP_V = 5.4;
const MAX_R = 246;          // ocean ring — soft world bound
const MAX_DEPTH = 0.85;     // how deep Coal may wade

export function createController(initialField, playerRoot) {
  let field = initialField;
  const keys = new Set();
  const state = {
    pos: new THREE.Vector3(WORLD.spawn.x, 0, WORLD.spawn.z),
    vel: new THREE.Vector3(),
    heading: 0,          // radians, 0 = +Z
    vy: 0,
    grounded: true,
    speed: 0,
    swimming: false,
  };
  state.pos.y = field.heightAt(state.pos.x, state.pos.z);

  const KEYMAP = {
    KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
    KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump',
  };
  // fallback on e.key — some injected/driver events arrive with an empty code
  const KEYMAP_BY_KEY = {
    w: 'f', s: 'b', a: 'l', d: 'r',
    ArrowUp: 'f', ArrowDown: 'b', ArrowLeft: 'l', ArrowRight: 'r',
    Shift: 'run', ' ': 'jump', space: 'jump', spacebar: 'jump',
  };
  state.inputCount = 0; // mapped keydowns seen — lets tests prove events arrive
  function onKey(e, down) {
    const k = KEYMAP[e.code] ?? KEYMAP_BY_KEY[e.key] ?? KEYMAP_BY_KEY[(e.key || '').toLowerCase()];
    if (!k) return;
    if (down) { keys.add(k); state.inputCount++; } else keys.delete(k);
    if (k === 'jump') e.preventDefault();
  }
  window.addEventListener('keydown', (e) => onKey(e, true));
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => keys.clear());

  function update(dt, camYaw) {
    // input → desired planar velocity (camera relative)
    let ix = 0, iz = 0;
    if (keys.has('f')) iz += 1;
    if (keys.has('b')) iz -= 1;
    if (keys.has('l')) ix += 1;
    if (keys.has('r')) ix -= 1;
    const moving = ix !== 0 || iz !== 0;
    const target = new THREE.Vector3();
    if (moving) {
      const ang = Math.atan2(ix, iz) + camYaw;
      const spd = (keys.has('run') ? RUN : WALK) * (state.swimming ? 0.55 : 1);
      target.set(Math.sin(ang) * spd, 0, Math.cos(ang) * spd);
      // turn toward travel, frame-rate independent
      let d = ang - state.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      state.heading += d * (1 - Math.exp(-TURN * dt));
    }
    const k = 1 - Math.exp(-ACCEL * dt);
    state.vel.x += (target.x - state.vel.x) * k;
    state.vel.z += (target.z - state.vel.z) * k;

    // integrate + collide with terrain height field
    let nx = state.pos.x + state.vel.x * dt;
    let nz = state.pos.z + state.vel.z * dt;
    const groundNew = field.heightAt(nx, nz);
    const tooDeep = groundNew < WORLD.seaLevel - MAX_DEPTH;
    const outOfWorld = Math.hypot(nx, nz) > MAX_R;
    if (tooDeep || outOfWorld) { // slide: keep axis components that stay legal
      if (!(field.heightAt(nx, state.pos.z) < WORLD.seaLevel - MAX_DEPTH || Math.hypot(nx, state.pos.z) > MAX_R)) {
        nz = state.pos.z;
      } else if (!(field.heightAt(state.pos.x, nz) < WORLD.seaLevel - MAX_DEPTH || Math.hypot(state.pos.x, nz) > MAX_R)) {
        nx = state.pos.x;
      } else { nx = state.pos.x; nz = state.pos.z; }
    }
    state.pos.x = nx; state.pos.z = nz;

    const ground = field.heightAt(state.pos.x, state.pos.z);
    state.swimming = ground < WORLD.seaLevel - 0.35;
    const surfaceY = state.swimming ? WORLD.seaLevel - 0.18 : ground;

    if (keys.has('jump') && state.grounded) { state.vy = JUMP_V; state.grounded = false; }
    if (!state.grounded) {
      state.vy -= GRAVITY * dt;
      state.pos.y += state.vy * dt;
      if (state.pos.y <= surfaceY) { state.pos.y = surfaceY; state.vy = 0; state.grounded = true; }
    } else {
      state.pos.y = surfaceY;
    }

    state.speed = Math.hypot(state.vel.x, state.vel.z);
    playerRoot.position.copy(state.pos);
    playerRoot.rotation.y = state.heading;
    return state;
  }

  function teleport(x, z, heading) {
    state.pos.set(x, field.heightAt(x, z), z);
    state.vel.set(0, 0, 0); state.vy = 0; state.grounded = true;
    if (heading !== undefined) state.heading = heading;
    playerRoot.position.copy(state.pos);
    playerRoot.rotation.y = state.heading;
  }

  return { state, keys, update, teleport, setField(f) { field = f; } };
}
