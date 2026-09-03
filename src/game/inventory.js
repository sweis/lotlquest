// The inventory sheet: equip any owned weapon, see armor and ingredients.
// Open with I or the bag button; Esc / Close closes.

export function createInventory(combat) {
  const el = document.getElementById('inventory');
  const bodyEl = document.getElementById('inventoryBody');
  let open = false;

  const WEAPON_ROWS = [
    { id: 'bite', name: 'Bite', desc: 'Trusty chompers. Damage 1.', owned: () => true, equipped: (s) => s.weapon === 'melee' && s.equippedMelee === 0 },
    { id: 'sword1', name: 'Wooden Sword', desc: 'Damage 2.', owned: (s) => s.melee >= 1, equipped: (s) => s.weapon === 'melee' && s.equippedMelee === 1 },
    { id: 'sword2', name: 'Iron Sword', desc: 'Damage 3.', owned: (s) => s.melee >= 2, equipped: (s) => s.weapon === 'melee' && s.equippedMelee === 2 },
    { id: 'bow1', name: 'Kelp Bow', desc: 'Arrows at range, damage 2.', owned: (s) => s.bow >= 1, equipped: (s) => s.weapon === 'bow' },
  ];

  function render() {
    const s = combat.state;
    bodyEl.innerHTML = '';
    for (const row of WEAPON_ROWS) {
      if (!row.owned(s)) continue;
      const eq = row.equipped(s);
      const div = document.createElement('div');
      div.className = 'shopItem';
      div.innerHTML =
        `<div class="info"><b>${row.name}</b><span>${row.desc}</span></div>` +
        `<button class="buy" ${eq ? 'disabled' : ''}>${eq ? 'Equipped' : 'Equip'}</button>`;
      if (!eq) {
        div.querySelector('button').addEventListener('click', () => { combat.equip(row.id); render(); });
      }
      bodyEl.appendChild(div);
    }
    const shellName = ['None yet', 'Leaf Shell (+1 heart)', 'Iron Shell (+2 hearts)'][s.shell];
    const ing = s.ingredients;
    const foot = document.createElement('div');
    foot.className = 'foot';
    foot.innerHTML = `Armor: ${shellName}<br>` +
      `Ingredients: ${ing.kelp} kelp · ${ing.berry} berries · ${ing.petal} petals<br>` +
      `Tokens: ${s.tokens}`;
    bodyEl.appendChild(foot);
  }

  return {
    open() { open = true; render(); el.style.display = 'block'; },
    close() { open = false; el.style.display = 'none'; },
    toggle() { if (open) this.close(); else this.open(); },
    isOpen: () => open,
  };
}
