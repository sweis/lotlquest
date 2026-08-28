// The armory shop: DOM sheet listing the catalog; opens when Coal walks up
// to the armory door, closes on Leave / Esc / walking away.

import { CATALOG } from './combat.js';

export function createShop(combat) {
  const el = document.getElementById('shop');
  const itemsEl = document.getElementById('shopItems');
  const tokEl = document.getElementById('shopTok');
  let open = false;

  function render() {
    tokEl.innerHTML = `You have <span class="coin"></span> <b>${combat.state.tokens}</b> tokens`;
    itemsEl.innerHTML = '';
    for (const item of CATALOG) {
      const owned = combat.state[item.kind] >= item.tier;
      const afford = combat.state.tokens >= item.price;
      const row = document.createElement('div');
      row.className = 'shopItem';
      row.innerHTML =
        `<div class="info"><b>${item.name}</b><span>${item.desc}</span></div>` +
        `<button class="buy" ${owned || !afford ? 'disabled' : ''}>` +
        (owned ? 'Owned' : `${item.price} ⬤`) + '</button>';
      if (!owned && afford) {
        row.querySelector('button').addEventListener('click', () => {
          combat.buy(item.id);
          render();
        });
      }
      itemsEl.appendChild(row);
    }
  }

  return {
    open() { if (!open) { open = true; render(); el.style.display = 'block'; } },
    close() { open = false; el.style.display = 'none'; },
    isOpen: () => open,
    render,
  };
}
