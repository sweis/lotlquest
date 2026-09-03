// Village shops in one sheet: the armory (armor), the weapon stall, the food
// stall (meals that heal) and the potion stall (timed brews). Opens when Coal
// walks up; closes on Leave / Esc / walking away.

import { WEAPONS, ARMOR, FOOD, POTIONS } from './combat.js';

const MODES = {
  armory: { title: 'The Armory', items: ARMOR, kind: 'gear' },
  weapons: { title: 'Weapon Stall', items: WEAPONS, kind: 'gear' },
  market: { title: 'Food Stall', items: FOOD, kind: 'food' },
  potions: { title: 'Potion Stall', items: POTIONS, kind: 'potion' },
};

export function createShop(combat, onClose) {
  const el = document.getElementById('shop');
  const itemsEl = document.getElementById('shopItems');
  const tokEl = document.getElementById('shopTok');
  const titleEl = document.getElementById('shopTitle');
  let mode = null; // null closed, else a MODES key

  function render() {
    const M = MODES[mode];
    if (!M) return;
    titleEl.textContent = M.title;
    tokEl.innerHTML = `You have <span class="coin"></span> <b>${combat.state.tokens}</b> tokens` +
      (M.kind === 'food' ? ` · ${combat.state.hp / 2}/${combat.maxHp() / 2} hearts` : '');
    itemsEl.innerHTML = '';
    for (const item of M.items) {
      const owned = M.kind === 'gear' && combat.state[item.kind] >= item.tier;
      const full = M.kind === 'food' && combat.state.hp >= combat.maxHp();
      const active = M.kind === 'potion' && combat.state.buffs[item.buff] > 0;
      const afford = combat.state.tokens >= item.price;
      const enabled = !owned && !full && !active && afford;
      const row = document.createElement('div');
      row.className = 'shopItem';
      row.innerHTML =
        `<div class="info"><b>${item.name}</b><span>${item.desc}</span></div>` +
        `<button class="buy" ${enabled ? '' : 'disabled'}>` +
        (owned ? 'Owned' : full ? 'Full' : active ? 'Active' : `${item.price} ⬤`) + '</button>';
      if (enabled) {
        row.querySelector('button').addEventListener('click', () => {
          if (M.kind === 'food') combat.buyFood(item.id);
          else if (M.kind === 'potion') combat.buyPotion(item.id);
          else combat.buy(item.id);
          render();
        });
      }
      itemsEl.appendChild(row);
    }
  }

  return {
    open(m = 'armory') { mode = m; render(); el.style.display = 'block'; },
    close() {
      if (!mode) return;
      const closed = mode;
      mode = null; el.style.display = 'none';
      if (onClose) onClose(closed);
    },
    isOpen: () => mode !== null,
    mode: () => mode,
    render,
  };
}
