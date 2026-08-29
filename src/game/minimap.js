// Corner minimap: zoomed, player-centred viewport of the island (north up)
// with trails, landmark dots and a heading arrow. Toggle with M.

import { WORLD } from '../world/terrain.js';

const SIZE = 176;        // css px
const RES = 288;         // island image resolution (world sampled every ~1.8m)
const VIEW = 170;        // metres of world shown across the map — the zoom

const COLORS = {
  water: '#3a7796', sand: '#d8c093', grassLo: '#6f9c4b', grassHi: '#93b158',
  rock: '#87837b', snow: '#e8ecee', trail: '#b59b76',
};

export function createMinimap(field) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
  ctx.scale(dpr, dpr);

  let island = null;
  let landmarks = [];
  let trails = [];
  let visible = true;
  let view = { cx: 0, cz: 0 }; // current viewport centre (world coords)

  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      visible = !visible;
      canvas.style.display = visible ? 'block' : 'none';
    }
  });

  function prerender() {
    island = document.createElement('canvas');
    island.width = RES; island.height = RES;
    const ic = island.getContext('2d');
    const img = ic.createImageData(RES, RES);
    const put = (i, hex) => {
      const n = parseInt(hex.slice(1), 16);
      img.data[i] = n >> 16; img.data[i + 1] = (n >> 8) & 255; img.data[i + 2] = n & 255; img.data[i + 3] = 255;
    };
    // Overhead view of a right-handed world: with +z (north) up on the map,
    // +x lies to the screen-LEFT — px must run east→west or the map mirrors.
    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const x = WORLD.size / 2 - (px / (RES - 1)) * WORLD.size;
        const z = WORLD.size / 2 - (py / (RES - 1)) * WORLD.size; // north up
        const h = field.groundAt ? field.groundAt(x, z) : field.heightAt(x, z);
        const i = (py * RES + px) * 4;
        if (h < WORLD.seaLevel) put(i, COLORS.water);
        else if (h < 3.2) put(i, COLORS.sand);
        else if (h > 27) put(i, COLORS.snow);
        else if (h > 17) put(i, COLORS.rock);
        else put(i, h > 9 ? COLORS.grassHi : COLORS.grassLo);
      }
    }
    ic.putImageData(img, 0, 0);
  }

  const setLandmarks = (lms) => { landmarks = lms; };
  const setTrails = (t) => { trails = t ?? []; };
  const rebuild = () => prerender();

  // world → map px for the current viewport (+x = screen-left, +z = up)
  function toMap(x, z) {
    return [
      SIZE / 2 - ((x - view.cx) / VIEW) * SIZE,
      SIZE / 2 - ((z - view.cz) / VIEW) * SIZE,
    ];
  }

  const ENEMY_VIS = 35; // metres — enemies only show when nearby

  function dot(x, z, fill) {
    const [mx, my] = toMap(x, z);
    if (mx < -8 || my < -8 || mx > SIZE + 8 || my > SIZE + 8) return;
    ctx.fillStyle = fill;
    ctx.beginPath(); ctx.arc(mx, my, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(20,26,34,.7)'; ctx.lineWidth = 1.2; ctx.stroke();
  }

  function draw(playerState, dynamic = {}) {
    if (!visible || !island) return;
    const clampR = WORLD.size / 2 - VIEW / 2;
    view.cx = Math.max(-clampR, Math.min(clampR, playerState.pos.x));
    view.cz = Math.max(-clampR, Math.min(clampR, playerState.pos.z));

    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    // zoomed source rect of the prerendered island (image px runs east→west)
    const px = (WORLD.size / 2 - (view.cx + VIEW / 2)) / WORLD.size * RES;
    const py = ((WORLD.size / 2 - (view.cz + VIEW / 2))) / WORLD.size * RES;
    const pw = (VIEW / WORLD.size) * RES;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(island, px, py, pw, pw, 0, 0, SIZE, SIZE);

    // trails
    ctx.strokeStyle = COLORS.trail;
    ctx.lineWidth = 2.5;
    ctx.lineCap = ctx.lineJoin = 'round';
    for (const path of trails) {
      ctx.beginPath();
      let first = true;
      for (const p of path) {
        const [mx, my] = toMap(p.x, p.z);
        if (first) { ctx.moveTo(mx, my); first = false; } else ctx.lineTo(mx, my);
      }
      ctx.stroke();
    }

    // landmark dots (gold), villagers (green), nearby enemies (red)
    for (const lm of landmarks) {
      if (lm.name === 'Axolotl Village') continue;
      dot(lm.x, lm.z, '#f4c95d');
    }
    for (const n of dynamic.npcs ?? []) {
      dot(n.ax.root.position.x, n.ax.root.position.z, '#5fbf6a');
    }
    for (const s of dynamic.monsters ?? []) {
      if (!s.alive) continue;
      const d = Math.hypot(s.mesh.position.x - playerState.pos.x, s.mesh.position.z - playerState.pos.z);
      if (d < ENEMY_VIS) dot(s.mesh.position.x, s.mesh.position.z, '#e5484d');
    }

    // player arrow — points the way Coal is facing (north up)
    const [ax, ay] = toMap(playerState.pos.x, playerState.pos.z);
    ctx.translate(ax, ay);
    // arrow drawn tip-down; heading 0 (+z) → up, heading +π/2 (+x) → screen-left
    ctx.rotate(-playerState.heading + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(20,26,34,.85)'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, 9); ctx.lineTo(6, -6.5); ctx.lineTo(0, -2.6); ctx.lineTo(-6, -6.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(248,250,252,.85)'; ctx.lineWidth = 3; ctx.stroke();
  }

  prerender();
  return { draw, setLandmarks, setTrails, rebuild };
}
