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

export const WEAPONS = [
  { id: 'sword1', kind: 'melee', tier: 1, name: 'Wooden Sword', desc: 'A sturdy branch, axolotl-sharpened. Damage 2.', price: 5 },
  { id: 'sword2', kind: 'melee', tier: 2, name: 'Iron Sword', desc: 'Vendor-forged. Damage 3.', price: 25 },
  { id: 'bow1', kind: 'bow', tier: 1, name: 'Kelp Bow', desc: 'Shoots arrows (press F, weapon 2). Damage 2 at range.', price: 15 },
];
export const ARMOR = [
  { id: 'shell1', kind: 'shell', tier: 1, name: 'Leaf Shell', desc: 'A springy back-shell. +1 heart.', price: 8 },
  { id: 'shell2', kind: 'shell', tier: 2, name: 'Iron Shell', desc: 'Serious protection. +2 hearts.', price: 30 },
];
export const CATALOG = [...WEAPONS, ...ARMOR];
export const POTIONS = [
  { id: 'pot1', name: 'Zoom Juice', desc: 'Run like a river for 45 seconds.', price: 5, buff: 'speed', dur: 45 },
  { id: 'pot2', name: 'Stoneskin Tonic', desc: 'Slimes cannot hurt you for 45 seconds.', price: 10, buff: 'guard', dur: 45 },
  { id: 'pot3', name: 'Lucky Fizz', desc: 'Slimes drop extra tokens for 60 seconds.', price: 6, buff: 'luck', dur: 60 },
];
export const INGREDIENTS = ['kelp', 'berry', 'petal'];
export const FISH = [
  { id: 'minnow', name: 'Minnow', price: 2, odds: 0.6 },
  { id: 'trout', name: 'Kelp Trout', price: 5, odds: 0.3 },
  { id: 'sunfish', name: 'Sunfish', price: 12, odds: 0.1 },
];
export const RECIPES = [
  { id: 'brew1', name: 'Zoom Juice', desc: 'Brew it yourself: 2 kelp.', cost: { kelp: 2 }, buff: 'speed', dur: 45 },
  { id: 'brew2', name: 'Stoneskin Tonic', desc: '2 berries and a kelp frond.', cost: { berry: 2, kelp: 1 }, buff: 'guard', dur: 45 },
  { id: 'brew3', name: 'Lucky Fizz', desc: '2 petals and a berry.', cost: { petal: 2, berry: 1 }, buff: 'luck', dur: 60 },
];

const TOKEN_GEO = new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12);
const TOKEN_MAT = new THREE.MeshStandardMaterial({ color: 0xf4c95d, roughness: 0.3, metalness: 0.7 });
const ARROW_MAT = new THREE.MeshStandardMaterial({ color: 0x8a6f4d, roughness: 0.8 });

export function createCombat({ scene, coal, controller, field, onChange }) {
  const state = {
    hp: 10, baseMaxHp: 10,
    tokens: 0,
    melee: 0, bow: 0, shell: 0,     // owned tiers
    equippedMelee: 0,                // which melee is in hand (0 bite … ≤ melee)
    weapon: 'melee',                 // active: 'melee' | 'bow'
    attackCd: 0, invulnT: 0,
    kills: 0,
    buffs: { speed: 0, guard: 0, luck: 0 }, // seconds remaining (potions)
    ingredients: { kelp: 0, berry: 0, petal: 0 },
    fish: { minnow: 0, trout: 0, sunfish: 0 },
  };
  const maxHp = () => state.baseMaxHp + state.shell * 2;

  // ---- save / load: EVERYTHING persists between plays ----
  let savedPos = null;
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s) {
      state.tokens = s.tokens | 0; state.melee = s.melee | 0; state.bow = s.bow | 0; state.shell = s.shell | 0;
      if (s.ingredients) for (const k of INGREDIENTS) state.ingredients[k] = s.ingredients[k] | 0;
      if (s.fish) for (const f of FISH) state.fish[f.id] = s.fish[f.id] | 0;
      state.equippedMelee = Math.min(s.equippedMelee ?? state.melee, state.melee);
      if (s.weapon === 'bow' && state.bow) state.weapon = 'bow';
      if (typeof s.hp === 'number') state.hp = Math.max(2, Math.min(s.hp, state.baseMaxHp + state.shell * 2));
      if (s.pos && Number.isFinite(s.pos.x) && Number.isFinite(s.pos.z)) savedPos = s.pos;
    }
  } catch { /* fresh start */ }
  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        tokens: state.tokens, melee: state.melee, bow: state.bow, shell: state.shell,
        equippedMelee: state.equippedMelee,
        ingredients: state.ingredients, fish: state.fish, weapon: state.weapon, hp: state.hp,
        pos: {
          x: +controller.state.pos.x.toFixed(1),
          z: +controller.state.pos.z.toFixed(1),
          heading: +controller.state.heading.toFixed(2),
        },
      }));
    } catch { /* private mode etc. */ }
  }
  const getSavedPos = () => savedPos;

  function applyGear() {
    coal.setSword(state.weapon === 'melee' ? state.equippedMelee : 0);
    coal.setBow(state.weapon === 'bow' ? state.bow : 0);
    coal.setShell(state.shell);
    state.hp = Math.min(state.hp, maxHp());
    onChange();
  }
  applyGear();

  function meleeDamage() { return [1, 2, 3][state.equippedMelee]; } // bare bite = 1

  // equip from the inventory: 'bite', 'sword1', 'sword2', 'bow1'
  function equip(id) {
    if (id === 'bite') { state.weapon = 'melee'; state.equippedMelee = 0; }
    else if (id === 'sword1' && state.melee >= 1) { state.weapon = 'melee'; state.equippedMelee = 1; }
    else if (id === 'sword2' && state.melee >= 2) { state.weapon = 'melee'; state.equippedMelee = 2; }
    else if (id === 'bow1' && state.bow >= 1) { state.weapon = 'bow'; }
    else return 'not owned';
    save(); applyGear();
    return 'ok';
  }

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
    const bonus = state.buffs.luck > 0 ? 2 : 0; // Lucky Fizz
    dropTokens(s.mesh.position.x, s.mesh.position.z, 1 + ((Math.random() * 3) | 0) + bonus);
    onChange();
  }

  function damagePlayer(amount, fromX, fromZ) {
    if (state.invulnT > 0 || state.hp <= 0) return;
    if (state.buffs.guard > 0) { state.invulnT = 0.5; return; } // Stoneskin Tonic
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
    for (const k of Object.keys(state.buffs)) {
      if (state.buffs[k] > 0) {
        state.buffs[k] = Math.max(0, state.buffs[k] - dt);
        if (state.buffs[k] === 0) onChange(); // buff wore off — refresh the HUD
      }
    }
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
    if (item.kind === 'melee') { state.weapon = 'melee'; state.equippedMelee = item.tier; }
    save(); applyGear();
    return 'ok';
  }

  function rollCatch() { // weighted by FISH odds
    let r = Math.random();
    for (const f of FISH) { if (r < f.odds) return f; r -= f.odds; }
    return FISH[0];
  }

  function catchFish(id) {
    const f = FISH.find((x) => x.id === id) ?? rollCatch();
    state.fish[f.id]++;
    save(); onChange();
    return f;
  }

  function sellFish(id) { // sells the whole stack of one kind
    const f = FISH.find((x) => x.id === id);
    if (!f || state.fish[f.id] <= 0) return 'none to sell';
    state.tokens += state.fish[f.id] * f.price;
    state.fish[f.id] = 0;
    save(); onChange();
    return 'ok';
  }

  function collectIngredient(kind) {
    if (!(kind in state.ingredients)) return;
    state.ingredients[kind]++;
    save(); onChange();
  }

  function canBrew(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r || state.buffs[r.buff] > 0) return false;
    return Object.keys(r.cost).every((k) => state.ingredients[k] >= r.cost[k]);
  }

  function brew(id) {
    const r = RECIPES.find((x) => x.id === id);
    if (!r) return 'unknown recipe';
    if (state.buffs[r.buff] > 0) return 'already active';
    if (!canBrew(id)) return 'missing ingredients';
    for (const k of Object.keys(r.cost)) state.ingredients[k] -= r.cost[k];
    state.buffs[r.buff] = r.dur;
    save(); onChange();
    return 'ok';
  }

  function buyPotion(id) {
    const item = POTIONS.find((p) => p.id === id);
    if (!item) return 'unknown item';
    if (state.buffs[item.buff] > 0) return 'already active';
    if (state.tokens < item.price) return 'not enough tokens';
    state.tokens -= item.price;
    state.buffs[item.buff] = item.dur;
    save(); onChange();
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

  return {
    state, maxHp, update, tryAttack, damagePlayer, buy, buyFood, buyPotion,
    collectIngredient, canBrew, brew, getSavedPos, equip, catchFish, sellFish,
    setWeapon, setMonsters, respawn, dropTokens, save, resetSave,
  };
}
