// Corner minimap: island silhouette prerendered from the height field, with
// landmark dots and a live player arrow. Toggle with M.

import { WORLD } from '../world/terrain.js';

const SIZE = 176;        // css px
const RES = 132;         // island image resolution (world sampled every ~4m)

const COLORS = {
  water: '#3a7796', sand: '#d8c093', grassLo: '#6f9c4b', grassHi: '#93b158',
  rock: '#87837b', snow: '#e8ecee',
};

export function createMinimap(field) {
  const canvas = document.getElementById('minimap');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = SIZE * dpr; canvas.height = SIZE * dpr;
  ctx.scale(dpr, dpr);

  let island = null;   // prerendered ImageBitmap-ish canvas
  let landmarks = [];
  let visible = true;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      visible = !visible;
      canvas.style.display = visible ? 'block' : 'none';
    }
  });

  function worldToMap(x, z) {
    // north (+z) up
    return [((x + WORLD.size / 2) / WORLD.size) * SIZE, ((WORLD.size / 2 - z) / WORLD.size) * SIZE];
  }

  function prerender() {
    island = document.createElement('canvas');
    island.width = RES; island.height = RES;
    const ic = island.getContext('2d');
    const img = ic.createImageData(RES, RES);
    const put = (i, hex) => {
      const n = parseInt(hex.slice(1), 16);
      img.data[i] = n >> 16; img.data[i + 1] = (n >> 8) & 255; img.data[i + 2] = n & 255; img.data[i + 3] = 255;
    };
    for (let py = 0; py < RES; py++) {
      for (let px = 0; px < RES; px++) {
        const x = (px / (RES - 1)) * WORLD.size - WORLD.size / 2;
        const z = WORLD.size / 2 - (py / (RES - 1)) * WORLD.size;
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

  function setLandmarks(lms) { landmarks = lms; }
  function rebuild() { prerender(); }

  function draw(playerState) {
    if (!visible || !island) return;
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.save();
    // circular frame
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(island, 0, 0, SIZE, SIZE);

    // landmark dots (skip the big village ring)
    ctx.fillStyle = '#f4c95d';
    for (const lm of landmarks) {
      if (lm.name === 'Axolotl Village') continue;
      const [mx, my] = worldToMap(lm.x, lm.z);
      ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(20,26,34,.65)'; ctx.lineWidth = 1; ctx.stroke();
    }

    // player arrow
    const [px, py] = worldToMap(playerState.pos.x, playerState.pos.z);
    ctx.translate(px, py);
    ctx.rotate(playerState.heading + Math.PI); // arrow drawn tip-down; heading 0 (+z) → up
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(20,26,34,.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 6.5); ctx.lineTo(4.2, -4.5); ctx.lineTo(0, -1.8); ctx.lineTo(-4.2, -4.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();

    // ring border
    ctx.beginPath();
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(248,250,252,.85)'; ctx.lineWidth = 3; ctx.stroke();
  }

  prerender();
  return { draw, setLandmarks, rebuild };
}
