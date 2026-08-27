// Chase camera: drag orbits and HOLDS while idle; movement recenters the view
// behind travel (same feel as the Unity build's FreeLookCamera). Plus named
// fixed cameras so before/after captures are comparable.

import * as THREE from 'three';
import { WORLD } from '../world/terrain.js';

export function createCamera(renderer, field) {
  const cam = new THREE.PerspectiveCamera(45, 2, 0.1, 2600);

  const orbit = {
    yawOffset: 0,        // relative to player heading
    pitch: 0.30,
    dist: 7.0,
    dragging: false,
  };
  let mode = 'chase';
  const lookTarget = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const RECENTER = 3.5;

  const el = renderer.domElement;
  let lastX = 0, lastY = 0;
  el.addEventListener('pointerdown', (e) => {
    orbit.dragging = true; lastX = e.clientX; lastY = e.clientY;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!orbit.dragging) return;
    orbit.yawOffset -= (e.clientX - lastX) * 0.005;
    orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + (e.clientY - lastY) * 0.004, 0.02, 1.1);
    lastX = e.clientX; lastY = e.clientY;
  });
  el.addEventListener('pointerup', () => { orbit.dragging = false; });
  el.addEventListener('wheel', (e) => {
    orbit.dist = THREE.MathUtils.clamp(orbit.dist + e.deltaY * 0.01, 3.5, 14);
  }, { passive: true });

  const FIXED = {
    overview: { pos: new THREE.Vector3(0, 330, -330), look: new THREE.Vector3(0, 0, 20) },
    'hud-check': { pos: new THREE.Vector3(40, 26, -190), look: new THREE.Vector3(0, 8, -60) },
  };

  function update(dt, playerState) {
    const p = playerState.pos;
    if (mode === 'overview' || mode === 'hud-check') {
      cam.position.copy(FIXED[mode].pos);
      cam.lookAt(FIXED[mode].look);
      return;
    }
    if (mode === 'hero-close') {
      // low front three-quarter close-up on Coal, framed off his heading
      const a = playerState.heading + 0.55;
      cam.position.set(p.x + Math.sin(a) * 2.1, p.y + 0.72, p.z + Math.cos(a) * 2.1);
      cam.lookAt(p.x, p.y + 0.38, p.z);
      return;
    }

    // chase: recenter yaw offset behind travel while moving, hold while idle
    if (!orbit.dragging && playerState.speed > 0.4) {
      orbit.yawOffset *= Math.exp(-RECENTER * dt);
    }
    const yaw = playerState.heading + Math.PI + orbit.yawOffset; // behind player
    const cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
    desired.set(
      p.x + Math.sin(yaw) * cp * orbit.dist,
      p.y + sp * orbit.dist + 0.6,
      p.z + Math.cos(yaw) * cp * orbit.dist,
    );
    // keep above terrain and sea
    const minY = Math.max(field.heightAt(desired.x, desired.z) + 0.5, WORLD.seaLevel + 0.4);
    if (desired.y < minY) desired.y = minY;

    const k = 1 - Math.exp(-8 * dt);
    cam.position.lerp(desired, k);
    lookTarget.lerp(new THREE.Vector3(p.x, p.y + 0.75, p.z), 1 - Math.exp(-12 * dt));
    cam.lookAt(lookTarget);
  }

  function setMode(name) {
    if (!['chase', 'overview', 'hero-close', 'hud-check'].includes(name)) {
      throw new Error(`unknown camera "${name}"`);
    }
    mode = name;
  }

  function snapBehind(playerState) { // used at spawn so frame 1 is composed
    orbit.yawOffset = 0;
    const yaw = playerState.heading + Math.PI;
    const cp = Math.cos(orbit.pitch), sp = Math.sin(orbit.pitch);
    cam.position.set(
      playerState.pos.x + Math.sin(yaw) * cp * orbit.dist,
      playerState.pos.y + sp * orbit.dist + 0.6,
      playerState.pos.z + Math.cos(yaw) * cp * orbit.dist,
    );
    lookTarget.set(playerState.pos.x, playerState.pos.y + 0.75, playerState.pos.z);
    cam.lookAt(lookTarget);
  }

  // camera yaw used for movement input (direction camera faces, horizontal)
  function moveYaw() {
    const d = new THREE.Vector3();
    cam.getWorldDirection(d);
    return Math.atan2(d.x, d.z);
  }

  return { cam, orbit, update, setMode, snapBehind, moveYaw, get mode() { return mode; } };
}
