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

// evil olms — long pale salamanders with burning red eyes, haunting the far
// realms. They slink instead of hopping, hit harder, and drop more tokens.
const OLM_BODY = new THREE.MeshStandardMaterial({ color: 0xd9cbce, roughness: 0.55 });
const OLM_HURT = new THREE.MeshStandardMaterial({ color: 0xe4695a, roughness: 0.55 });
const OLM_GILL = new THREE.MeshStandardMaterial({ color: 0xb43a4a, roughness: 0.6 });
const OLM_EYE = new THREE.MeshStandardMaterial({
  color: 0xff2a2a, emissive: 0xd40f1e, emissiveIntensity: 2.4, roughness: 0.4,
});
const OLM_AGGRO = 12, OLM_SPEED = 3.3, OLM_LEASH = 26, OLM_HP = 5, OLM_REWARD = 4;

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

function buildOlmMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.85, 6, 10), OLM_BODY);
  body.rotation.x = Math.PI / 2; body.position.y = 0.3; body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 9), OLM_BODY);
  head.scale.set(1, 0.8, 1.3); head.position.set(0, 0.32, 0.66); head.castShadow = true;
  g.add(head);
  // the long whip tail: three tapering segments on a pivot so it can lash
  const tail = new THREE.Group();
  let tz = -0.05;
  for (const [r, len] of [[0.15, 0.5], [0.1, 0.45], [0.055, 0.44]]) {
    const seg = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), OLM_BODY);
    seg.rotation.x = Math.PI / 2;
    seg.position.set(0, 0, tz - len / 2);
    seg.castShadow = true;
    tail.add(seg);
    tz -= len + r * 0.4;
  }
  tail.position.set(0, 0.3, -0.45);
  g.add(tail);
  for (const [lx, lz] of [[0.2, 0.32], [-0.2, 0.32], [0.2, -0.3], [-0.2, -0.3]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 6), OLM_BODY);
    leg.position.set(lx, 0.11, lz);
    g.add(leg);
  }
  for (const side of [-1, 1]) { // frilled gills + burning eyes
    for (let k = 0; k < 3; k++) {
      const fr = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.26, 5), OLM_GILL);
      fr.position.set(side * 0.15, 0.44, 0.56 - k * 0.09);
      fr.rotation.z = side * (0.9 + k * 0.35);
      g.add(fr);
    }
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), OLM_EYE);
    eye.position.set(side * 0.1, 0.42, 0.86);
    g.add(eye);
  }
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2; blob.position.y = 0.03;
  g.add(blob);
  return { g, body, blob, tail };
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
      mesh: g, body, blob, home: { x, z }, hp: MAX_HP, maxHp: MAX_HP, alive: true,
      vy: 0, grounded: true, hopCd: rng() * 1.4, hurtT: 0, contactCd: 0,
      respawnT: 0, wanderA: rng() * Math.PI * 2, squash: 1,
    });
  }

  // olms haunt the four realms (they share the slimes list, so combat, the
  // minimap and respawns all treat them like any other monster)
  for (const [key, count] of [['forest', 5], ['desert', 4], ['ice', 4], ['crystal', 3]]) {
    const realm = WORLD.realms?.[key];
    if (!realm) continue;
    let placed = 0;
    for (let i = 0; i < 300 && placed < count; i++) {
      const a = rng() * Math.PI * 2, rr = 3 + Math.sqrt(rng()) * realm.r * 0.8;
      const x = realm.x + Math.sin(a) * rr, z = realm.z + Math.cos(a) * rr;
      const h = ground(x, z);
      if (h < WORLD.seaLevel + 1.0) continue;
      const { g, body, blob, tail } = buildOlmMesh();
      g.position.set(x, h, z);
      g.rotation.y = rng() * Math.PI * 2;
      scene.add(g);
      slimes.push({
        kind: 'olm', mesh: g, body, blob, tail, home: { x, z },
        hp: OLM_HP, maxHp: OLM_HP, reward: OLM_REWARD, alive: true,
        vy: 0, grounded: true, hopCd: rng() * 2, hurtT: 0, contactCd: 0,
        respawnT: 0, wanderA: rng() * Math.PI * 2, squash: 1, animT: rng() * 9,
        kbx: 0, kbz: 0,
      });
      placed++;
    }
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

  function updateOlm(s, dt, player, events) {
    const p = s.mesh.position;
    s.contactCd -= dt;
    s.hurtT = Math.max(0, s.hurtT - dt);
    s.body.material = s.hurtT > 0 ? OLM_HURT : OLM_BODY;
    if (s.kbx || s.kbz) { // knockback slide from a hit
      p.x += s.kbx * dt; p.z += s.kbz * dt;
      const decay = Math.exp(-6 * dt);
      s.kbx *= decay; s.kbz *= decay;
      if (Math.hypot(s.kbx, s.kbz) < 0.2) { s.kbx = 0; s.kbz = 0; }
    }
    const g0 = ground(p.x, p.z);
    const dPlayer = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
    const dHome = Math.hypot(s.home.x - p.x, s.home.z - p.z);
    let want, spd;
    if (dPlayer < OLM_AGGRO && Math.abs(player.pos.y - g0) < 3 && dHome < OLM_LEASH) {
      want = Math.atan2(player.pos.x - p.x, player.pos.z - p.z); spd = OLM_SPEED;
    } else if (dHome > OLM_LEASH * 0.8) {
      want = Math.atan2(s.home.x - p.x, s.home.z - p.z); spd = 1.8; // slink home
    } else {
      if ((s.hopCd -= dt) <= 0) { s.wanderA += (rng() - 0.5) * 2.4; s.hopCd = 1.5 + rng() * 2; }
      want = s.wanderA; spd = 0.8;
    }
    let dh = Math.atan2(Math.sin(want - s.mesh.rotation.y), Math.cos(want - s.mesh.rotation.y));
    s.mesh.rotation.y += Math.max(-3.5 * dt, Math.min(3.5 * dt, dh));
    const hd = s.mesh.rotation.y;
    const nx = p.x + Math.sin(hd) * spd * dt, nz = p.z + Math.cos(hd) * spd * dt;
    const t0 = ground(nx, nz);
    if (t0 > WORLD.seaLevel + 0.5 && Math.abs(t0 - g0) < 1.6) { p.x = nx; p.z = nz; }
    else s.wanderA += Math.PI * 0.6;
    p.y = ground(p.x, p.z);
    // tail lash + body wriggle sell the slither
    s.animT += dt * (1.5 + spd);
    s.tail.rotation.y = Math.sin(s.animT * 4.2) * 0.55;
    s.body.scale.x = 1 + Math.sin(s.animT * 8.4) * 0.06;
    if (dPlayer < 1.0 && s.contactCd <= 0 && Math.abs(player.pos.y - p.y) < 1.2) {
      s.contactCd = 1.0;
      events.contact(s);
    }
  }

  function update(dt, player, events) {
    for (const s of slimes) {
      if (!s.alive) {
        s.respawnT -= dt;
        if (s.respawnT <= 0) {
          s.alive = true; s.hp = s.maxHp ?? MAX_HP; s.mesh.visible = true;
          s.mesh.position.set(s.home.x, ground(s.home.x, s.home.z), s.home.z);
        }
        continue;
      }
      if (s.kind === 'olm') { updateOlm(s, dt, player, events); continue; }
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

      // touching Coal hurts — but only at his level: a platform is SAFE
      if (dPlayer < CONTACT_R && s.contactCd <= 0 && Math.abs(player.pos.y - p.y) < 1.2) {
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
