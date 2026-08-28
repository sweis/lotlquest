// Movement: tank controls (matches the Unity build) — W/S drive along the
// character's own heading, A/D turn, Q/E strafe. Fully camera-independent.
// Real input path only — window key events; debug injection goes through the
// same `keys` set so both paths exercise identical code.

import * as THREE from 'three';
import { WORLD } from '../world/terrain.js';

const WALK = 4.6, RUN = 8.2, ACCEL = 18;
const TURN_RATE = 3.0;      // rad/s with A/D
const BACK_FACTOR = 0.6, STRAFE_FACTOR = 0.8;
const GRAVITY = 16, JUMP_V = 5.4;
const MAX_R = 246;          // ocean ring — soft world bound
const MAX_DEPTH = 0.85;     // how deep Coal may wade
const MAX_GRADE = 0.9;      // rise/run — faces steeper than ~42° can't be climbed

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
    KeyQ: 'sl', KeyE: 'sr',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'jump',
  };
  // fallback on e.key — some injected/driver events arrive with an empty code
  const KEYMAP_BY_KEY = {
    w: 'f', s: 'b', a: 'l', d: 'r', q: 'sl', e: 'sr',
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

  function update(dt) {
    // tank input: A/D rotate the character, W/S drive, Q/E strafe
    const turn = (keys.has('l') ? 1 : 0) - (keys.has('r') ? 1 : 0);
    state.heading += turn * TURN_RATE * dt;

    const drive = (keys.has('f') ? 1 : 0) - (keys.has('b') ? BACK_FACTOR : 0);
    const strafe = (keys.has('sr') ? 1 : 0) - (keys.has('sl') ? 1 : 0);
    const target = new THREE.Vector3();
    if (drive !== 0 || strafe !== 0) {
      const spd = (keys.has('run') ? RUN : WALK) * (state.swimming ? 0.55 : 1);
      const fx = Math.sin(state.heading), fz = Math.cos(state.heading);   // forward
      const rx = -fz, rz = fx;                                            // screen-right
      target.set(fx * drive + rx * strafe * STRAFE_FACTOR, 0, fz * drive + rz * strafe * STRAFE_FACTOR);
      if (target.lengthSq() > 1) target.normalize();
      target.multiplyScalar(spd);
    }
    const k = 1 - Math.exp(-ACCEL * dt);
    state.vel.x += (target.x - state.vel.x) * k;
    state.vel.z += (target.z - state.vel.z) * k;

    // integrate + collide with the terrain: deep water, world edge, steep faces
    function blocked(tx, tz) {
      if (Math.hypot(tx, tz) > MAX_R) return true;
      const h1 = field.heightAt(tx, tz);
      if (h1 < WORLD.seaLevel - MAX_DEPTH) return true;
      const run = Math.hypot(tx - state.pos.x, tz - state.pos.z);
      if (run > 1e-6) {
        const rise = h1 - field.heightAt(state.pos.x, state.pos.z);
        if (rise / run > MAX_GRADE) return true; // downhill is always allowed
      }
      return false;
    }
    let nx = state.pos.x + state.vel.x * dt;
    let nz = state.pos.z + state.vel.z * dt;
    if (blocked(nx, nz)) { // slide: keep the axis component that stays legal
      if (!blocked(nx, state.pos.z)) nz = state.pos.z;
      else if (!blocked(state.pos.x, nz)) nx = state.pos.x;
      else { nx = state.pos.x; nz = state.pos.z; }
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
