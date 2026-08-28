// Village shops in one sheet: the armory (weapons/armor) and the food market
// (meals that heal). Opens when Coal walks up; closes on Leave / Esc /
// walking away.

import { CATALOG, FOOD } from './combat.js';

const TITLES = { armory: 'The Armory', market: 'Food Market' };

export function createShop(combat, onClose) {
  const el = document.getElementById('shop');
  const itemsEl = document.getElementById('shopItems');
  const tokEl = document.getElementById('shopTok');
  const titleEl = document.getElementById('shopTitle');
  let mode = null; // null closed, else 'armory' | 'market'

  function render() {
    titleEl.textContent = TITLES[mode] ?? '';
    tokEl.innerHTML = `You have <span class="coin"></span> <b>${combat.state.tokens}</b> tokens` +
      (mode === 'market' ? ` · ${combat.state.hp / 2}/${combat.maxHp() / 2} hearts` : '');
    itemsEl.innerHTML = '';
    const items = mode === 'market' ? FOOD : CATALOG;
    for (const item of items) {
      const owned = mode === 'armory' && combat.state[item.kind] >= item.tier;
      const full = mode === 'market' && combat.state.hp >= combat.maxHp();
      const afford = combat.state.tokens >= item.price;
      const enabled = !owned && !full && afford;
      const row = document.createElement('div');
      row.className = 'shopItem';
      row.innerHTML =
        `<div class="info"><b>${item.name}</b><span>${item.desc}</span></div>` +
        `<button class="buy" ${enabled ? '' : 'disabled'}>` +
        (owned ? 'Owned' : full ? 'Full' : `${item.price} ⬤`) + '</button>';
      if (enabled) {
        row.querySelector('button').addEventListener('click', () => {
          if (mode === 'market') combat.buyFood(item.id);
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
