// On-screen diagnostics: GPU string, frame ms percentiles, draw calls,
// programs, last error. Toggled with ` or ?dev=1. Works on touch (tap 4x
// in the top-left corner).

export function createOverlay(renderer, getState) {
  const el = document.getElementById('diag');
  let visible = new URLSearchParams(location.search).has('dev');
  el.style.display = visible ? 'block' : 'none';

  let lastErr = '';
  window.addEventListener('error', (e) => { lastErr = String(e.message).slice(0, 80); });

  window.addEventListener('keydown', (e) => {
    if (e.key === '`') { visible = !visible; el.style.display = visible ? 'block' : 'none'; }
  });
  let taps = 0, tapTimer = 0;
  window.addEventListener('pointerdown', (e) => {
    if (e.clientX < 80 && e.clientY < 80) {
      clearTimeout(tapTimer);
      if (++taps >= 4) { taps = 0; visible = !visible; el.style.display = visible ? 'block' : 'none'; }
      tapTimer = setTimeout(() => { taps = 0; }, 900);
    }
  });

  let acc = 0;
  function tick(dt) {
    if (!visible) return;
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    const s = getState();
    el.textContent =
      `${s.gpu}\n` +
      `frame ${s.frameMsP50.toFixed(1)}ms p50 / ${s.frameMsP99.toFixed(1)}ms p99\n` +
      `calls ${s.drawCalls}  tris ${(s.triangles / 1000).toFixed(0)}k  progs ${s.programs}\n` +
      `pos ${s.player.x.toFixed(1)}, ${s.player.y.toFixed(1)}, ${s.player.z.toFixed(1)}  ` +
      `spd ${s.player.speed.toFixed(1)}  hdg ${s.player.heading.toFixed(2)}\n` +
      `sim ${s.simTime.toFixed(1)}s  seed ${s.seed}  cam ${s.camera}  phase ${s.phase}` +
      (s.contextLost ? '\nCONTEXT LOST' : '') +
      (lastErr ? `\nerr: ${lastErr}` : '');
  }
  return { tick };
}
