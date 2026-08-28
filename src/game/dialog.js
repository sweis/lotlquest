// NPC dialog card. Click the card to hear the next line; click anywhere
// else (or Esc) to close.

export function createDialog() {
  const el = document.getElementById('dialog');
  const nameEl = document.getElementById('dialogName');
  const textEl = document.getElementById('dialogText');
  let current = null;

  function show() {
    nameEl.textContent = current.name;
    textEl.textContent = current.lines[current.lineIndex % current.lines.length];
    el.style.display = 'block';
  }

  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (!current) return;
    current.lineIndex++;
    show();
  });

  return {
    open(npc) { current = npc; show(); },
    close() { current = null; el.style.display = 'none'; },
    isOpen: () => current !== null,
    speaker: () => current,
  };
}
