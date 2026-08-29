// Combat + progression: hearts, tokens, weapons (melee swords and the bow),
// armor shells, arrow projectiles, token drops, and the localStorage save.

import * as THREE from 'three';
import { WORLD } from '../world/terrain.js';

const SAVE_KEY = 'lotlquest-save-v1';

export const FOOD = [
  { id: 'food1', name: 'Kelp Wrap', desc: 'Crunchy and green. Restores 1 heart.', price: 2, heal: 2 },
  { id: 'food2', name: 'Berry Bowl', desc: 'Foraged from the groves. Restores 2 hearts.', price: 4, heal: 4 },
  { id: 'food3', name: 'Honey Cake', desc: 'The baker’s pride. Fully restores your hearts.', price: 8, heal: 99 },
];

export const CATALOG = [
  { id: 'sword1', kind: 'melee', tier: 1, name: 'Wooden Sword', desc: 'A sturdy branch, axolotl-sharpened. Damage 2.', price: 5 },
  { id: 'sword2', kind: 'melee', tier: 2, name: 'Iron Sword', desc: 'Forged in the armory. Damage 3.', price: 25 },
  { id: 'bow1', kind: 'bow', tier: 1, name: 'Kelp Bow', desc: 'Shoots arrows (press F, weapon 2). Damage 2 at range.', price: 15 },
  { id: 'shell1', kind: 'shell', tier: 1, name: 'Leaf Shell', desc: 'A springy back-shell. +1 heart.', price: 8 },
  { id: 'shell2', kind: 'shell', tier: 2, name: 'Iron Shell', desc: 'Serious protection. +2 hearts.', price: 30 },
];

const TOKEN_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12);
const TOKEN_MAT = new THREE.MeshStandardMaterial({ color: 0xf4c95d, roughness: 0.3, metalness: 0.7 });
const ARROW_MAT = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.8 });

export function createCombat({ scene, coal, controller, field, onChange }) {
  const state = {
    hp: 10, baseMaxHp: 10,
    tokens: 0,
    melee: 0, bow: 0, shell: 0,     // owned tiers
    weapon: 'melee',                 // active: 'melee' | 'bow'
    attackCd: 0, invulnT: 0,
    kills: 0,
  };
  const maxHp = () => state.baseMaxHp + state.shell * 2;

  // ---- save / load (progress only, never position) ----
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s) { state.tokens = s.tokens | 0; state.melee = s.melee | 0; state.bow = s.bow | 0; state.shell = s.shell | 0; }
  } catch { /* fresh start */ }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(
        { tokens: state.tokens, melee: state.melee, bow: state.bow, shell: state.shell }));
    } catch { /* private mode etc. */ }
  }

  function applyGear() {
    coal.setSword(state.weapon === 'melee' ? state.melee : 0);
    coal.setShell(state.shell);
    state.hp = Math.min(state.hp, maxHp());
    onChange();
  }
  applyGear();

  function meleeDamage() { return [1, 2, 3][state.melee]; } // bare bite = 1

  // ---- floating tokens ----
  const drops = [];
  function dropTokens(x, z, n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(TOKEN_GEO, TOKEN_MAT);
      m.castShadow = true;
      const a = Math.random() * Math.PI * 2;
      m.position.set(x, field.groundAt(x, z) + 0.8, z);
      scene.add(m);
      drops.push({ m, vx: Math.sin(a) * 2, vz: Math.cos(a) * 2, vy: 3.5 + Math.random() * 1.5, t: 30 });
    }
  }

  // ---- arrows ----
  const arrows = [];
  function shootArrow() {
    const p = controller.state.pos, h = controller.state.heading;
    const m = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5), ARROW_MAT);
    shaft.rotation.x = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 5), ARROW_MAT);
    tip.rotation.x = Math.PI / 2; tip.position.z = 0.32;
    m.add(shaft, tip);
    m.position.set(p.x + Math.sin(h) * 0.5, p.y + 0.62, p.z + Math.cos(h) * 0.5);
    m.rotation.y = h;
    scene.add(m);
    arrows.push({ m, vx: Math.sin(h) * 16, vz: Math.cos(h) * 16, vy: 1.1, t: 2.2 });
  }

  let monstersRef = null;
  function setMonsters(mo) { monstersRef = mo; }

  function tryAttack() {
    if (state.attackCd > 0) return;
    if (state.weapon === 'bow' && state.bow > 0) {
      state.attackCd = 0.85;
      coal.playAttack();
      shootArrow();
      return;
    }
    state.attackCd = 0.45;
    coal.playAttack();
    if (!monstersRef) return;
    const p = controller.state.pos, hdg = controller.state.heading;
    for (const s of monstersRef.slimes) {
      if (!s.alive) continue;
      const dx = s.mesh.position.x - p.x, dz = s.mesh.position.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.9) continue;
      let ang = Math.atan2(dx, dz) - hdg;
      ang = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(ang) > 1.25) continue; // in front only
      const res = monstersRef.hurt(s, meleeDamage(), p.x, p.z);
      if (res === 'died') onKill(s);
    }
  }

  function onKill(s) {
    state.kills++;
    dropTokens(s.mesh.position.x, s.mesh.position.z, 1 + ((Math.random() * 3) | 0));
    onChange();
  }

  function damagePlayer(amount, fromX, fromZ) {
    if (state.invulnT > 0 || state.hp <= 0) return;
    state.hp -= amount * (state.shell >= 2 ? 1 : 1); // shells add hearts instead of resist
    state.invulnT = 1.1;
    // shove Coal away from the hit
    const p = controller.state.pos;
    const d = Math.hypot(p.x - fromX, p.z - fromZ) || 1;
    controller.state.vel.x += ((p.x - fromX) / d) * 7;
    controller.state.vel.z += ((p.z - fromZ) / d) * 7;
    document.getElementById('hurtflash').classList.add('show');
    setTimeout(() => document.getElementById('hurtflash').classList.remove('show'), 180);
    onChange();
    if (state.hp <= 0) return 'died';
  }

  function update(dt) {
    state.attackCd = Math.max(0, state.attackCd - dt);
    state.invulnT = Math.max(0, state.invulnT - dt);
    coal.model.visible = state.invulnT <= 0 || Math.sin(state.invulnT * 40) > -0.2; // hurt blink

    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      const g = field.groundAt(d.m.position.x, d.m.position.z);
      d.vy -= 12 * dt;
      d.m.position.x += d.vx * dt; d.m.position.z += d.vz * dt;
      d.m.position.y += d.vy * dt;
      if (d.m.position.y < g + 0.15) { d.m.position.y = g + 0.15; d.vy = 0; d.vx *= 0.8; d.vz *= 0.8; }
      d.m.rotation.y += 4 * dt;
      d.t -= dt;
      // magnet pickup
      const p = controller.state.pos;
      const dist = Math.hypot(p.x - d.m.position.x, p.z - d.m.position.z);
      if (dist < 1.25) {
        scene.remove(d.m); drops.splice(i, 1);
        state.tokens++; save(); onChange();
      } else if (d.t <= 0) { scene.remove(d.m); drops.splice(i, 1); }
    }

    for (let i = arrows.length - 1; i >= 0; i--) {
      const a = arrows[i];
      a.vy -= 3.5 * dt;
      a.m.position.x += a.vx * dt; a.m.position.y += a.vy * dt; a.m.position.z += a.vz * dt;
      a.t -= dt;
      let dead = a.t <= 0 || a.m.position.y < field.groundAt(a.m.position.x, a.m.position.z);
      if (!dead && monstersRef) {
        for (const s of monstersRef.slimes) {
          if (!s.alive) continue;
          const hDist = Math.hypot(a.m.position.x - s.mesh.position.x, a.m.position.z - s.mesh.position.z);
          const vDist = Math.abs(a.m.position.y - (s.mesh.position.y + 0.38));
          if (hDist < 0.8 && vDist < 1.1) {
            const res = monstersRef.hurt(s, 2, a.m.position.x - a.vx * 0.1, a.m.position.z - a.vz * 0.1);
            if (res === 'died') onKill(s);
            dead = true;
            break;
          }
        }
      }
      if (dead) { scene.remove(a.m); arrows.splice(i, 1); }
    }
  }

  function buy(id) {
    const item = CATALOG.find((c) => c.id === id);
    if (!item) return 'unknown item';
    if (state[item.kind] >= item.tier) return 'owned';
    if (state.tokens < item.price) return 'not enough tokens';
    state.tokens -= item.price;
    state[item.kind] = item.tier;
    if (item.kind === 'bow') state.weapon = 'bow';
    if (item.kind === 'melee') state.weapon = 'melee';
    save(); applyGear();
    return 'ok';
  }

  function buyFood(id) {
    const item = FOOD.find((f) => f.id === id);
    if (!item) return 'unknown item';
    if (state.hp >= maxHp()) return 'full health';
    if (state.tokens < item.price) return 'not enough tokens';
    state.tokens -= item.price;
    state.hp = Math.min(maxHp(), state.hp + item.heal);
    save(); onChange();
    return 'ok';
  }

  function setWeapon(w) {
    if (w === 'bow' && !state.bow) return;
    state.weapon = w;
    applyGear();
  }

  function respawn() {
    state.hp = maxHp();
    state.invulnT = 2;
    onChange();
  }

  function resetSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
  }

  return { state, maxHp, update, tryAttack, damagePlayer, buy, buyFood, setWeapon, setMonsters, respawn, dropTokens, save, resetSave };
}
