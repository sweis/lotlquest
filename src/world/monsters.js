// Bog slimes: squashy hopping blobs that guard the wilds. Pop them for
// tokens. Deterministic spawn spots away from the village and spawn beach;
// each spot respawns its slime after a delay.

import * as THREE from 'three';
import { mulberry32 } from '../util/rng.js';
import { WORLD } from './terrain.js';

const BODY = new THREE.MeshStandardMaterial({ color: 0x69b06a, roughness: 0.35 });
const BODY_HURT = new THREE.MeshStandardMaterial({ color: 0xd0705a, roughness: 0.35 });
const EYE = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.3 });
const PUPIL = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2 });

const AGGRO_R = 9, DEAGGRO_R = 17, HOP_SPEED = 2.7, CONTACT_R = 0.85;
const RESPAWN_S = 22, MAX_HP = 3;

function buildSlimeMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12), BODY);
  body.position.y = 0.32; body.scale.set(1.1, 0.85, 1.05); body.castShadow = true;
  g.add(body);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), EYE);
    eye.position.set(0.15 * side, 0.42, 0.27);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), PUPIL);
    pupil.position.set(0.155 * side, 0.42, 0.335);
    g.add(eye, pupil);
  }
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03;
  g.add(blob);
  return { g, body, blob };
}

export function buildMonsters(field, seed, scene) {
  const ground = field.groundAt;
  const rng = mulberry32(seed ^ 0xbee5);
  const slimes = [];

  const V = WORLD.village, S = WORLD.spawn, H = WORLD.hunt;
  for (let i = 0; i < 4000 && slimes.length < 20; i++) {
    // bias a chunk of them toward the hunting point
    const nearHunt = slimes.length >= 15;
    const cx = nearHunt ? H.x : (rng() - 0.5) * WORLD.size * 0.85;
    const cz = nearHunt ? H.z : (rng() - 0.5) * WORLD.size * 0.85;
    const x = cx + (rng() - 0.5) * (nearHunt ? 26 : 1);
    const z = cz + (rng() - 0.5) * (nearHunt ? 26 : 1);
    const h = ground(x, z);
    if (h < WORLD.seaLevel + 1.2 || h > 20) continue;
    if (Math.hypot(x - V.x, z - V.z) < 48) continue;   // village is safe
    if (Math.hypot(x - S.x, z - S.z) < 30) continue;   // so is the spawn beach
    if (Math.hypot(x - WORLD.hill.x, z - WORLD.hill.z) < 14) continue;
    if (WORLD.cave && Math.hypot(x - WORLD.cave.x, z - WORLD.cave.z) < 16) continue;
    const { g, body, blob } = buildSlimeMesh();
    g.position.set(x, h, z);
    scene.add(g);
    slimes.push({
      mesh: g, body, blob, home: { x, z }, hp: MAX_HP, alive: true,
      vy: 0, grounded: true, hopCd: rng() * 1.4, hurtT: 0, contactCd: 0,
      respawnT: 0, wanderA: rng() * Math.PI * 2, squash: 1,
    });
  }

  function hurt(s, dmg, fromX, fromZ) {
    if (!s.alive) return false;
    s.hp -= dmg;
    s.hurtT = 0.22;
    // knockback hop away from the blow
    const d = Math.hypot(s.mesh.position.x - fromX, s.mesh.position.z - fromZ) || 1;
    s.kbx = ((s.mesh.position.x - fromX) / d) * 5;
    s.kbz = ((s.mesh.position.z - fromZ) / d) * 5;
    s.vy = 3.2; s.grounded = false;
    if (s.hp <= 0) {
      s.alive = false;
      s.respawnT = RESPAWN_S;
      s.mesh.visible = false;
      return 'died';
    }
    return true;
  }

  function update(dt, player, events) {
    for (const s of slimes) {
      if (!s.alive) {
        s.respawnT -= dt;
        if (s.respawnT <= 0) {
          s.alive = true; s.hp = MAX_HP; s.mesh.visible = true;
          s.mesh.position.set(s.home.x, ground(s.home.x, s.home.z), s.home.z);
        }
        continue;
      }
      const p = s.mesh.position;
      const dPlayer = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
      s.hopCd -= dt; s.contactCd -= dt; s.hurtT = Math.max(0, s.hurtT - dt);
      s.body.material = s.hurtT > 0 ? BODY_HURT : BODY;

      // physics: hops with gravity, grounded on the mesh
      const g0 = ground(p.x, p.z);
      if (!s.grounded) {
        s.vy -= 14 * dt;
        p.y += s.vy * dt;
        p.x += (s.kbx ?? 0) * dt * 0.9;
        p.z += (s.kbz ?? 0) * dt * 0.9;
        if (p.y <= g0) { p.y = g0; s.grounded = true; s.kbx = s.kbz = 0; s.squash = 0.55; }
      } else {
        p.y = g0;
        s.squash += (1 - s.squash) * (1 - Math.exp(-10 * dt));
        if (s.hopCd <= 0) {
          // chase if close (and the player is on huntable ground), else wander
          let dir;
          if (dPlayer < AGGRO_R) dir = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
          else if (dPlayer > DEAGGRO_R || true) { s.wanderA += (rng() - 0.5) * 1.6; dir = s.wanderA; }
          const hop = dPlayer < AGGRO_R ? HOP_SPEED : 1.2;
          s.kbx = Math.sin(dir) * hop; s.kbz = Math.cos(dir) * hop;
          const t0 = ground(p.x + s.kbx * 0.5, p.z + s.kbz * 0.5);
          if (t0 > WORLD.seaLevel + 0.6 && Math.abs(t0 - g0) < 1.4) { // stay on land
            s.vy = 4.0; s.grounded = false;
          } else { s.kbx = s.kbz = 0; s.wanderA += Math.PI * 0.7; }
          s.hopCd = dPlayer < AGGRO_R ? 0.55 : 1.3 + rng() * 1.4;
          s.mesh.rotation.y = dir;
        }
      }
      s.body.scale.set(1.1 / Math.sqrt(s.squash), 0.85 * s.squash, 1.05 / Math.sqrt(s.squash));

      // the contact-shadow blob stays on the ground while the slime hops
      const air = Math.max(0, p.y - g0);
      s.blob.position.y = 0.03 - air;
      s.blob.scale.setScalar(Math.max(0.55, 1 - air * 0.3));

      // touching Coal hurts
      if (dPlayer < CONTACT_R && s.contactCd <= 0) {
        s.contactCd = 1.0;
        events.contact(s);
      }
    }
  }

  return {
    slimes, update, hurt,
    aliveCount: () => slimes.filter((s) => s.alive).length,
    dispose(sc) { for (const s of slimes) sc.remove(s.mesh); },
  };
}
