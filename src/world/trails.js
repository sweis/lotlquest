// Worn dirt trails between the landmarks, routed with A* over PASSABLE
// terrain (gentle grades, no deep water) and painted into the terrain's
// vertex colors. WORLD.trails holds the polylines for the minimap and for
// keeping trees off the paths.

import * as THREE from 'three';
import { WORLD } from './terrain.js';

const CELL = 4;
const MAX_TRAIL_GRADE = 0.55; // gentler than the 0.9 walk gate — trails feel easy
const TRAIL_COL = new THREE.Color(0xa8906c);

function astar(ground, ax, az, bx, bz) {
  const half = WORLD.size / 2;
  const N = Math.floor(WORLD.size / CELL);
  const toIx = (x) => Math.round((x + half) / CELL);
  const key = (ix, iz) => iz * N + ix;
  const hAt = (ix, iz) => ground(ix * CELL - half, iz * CELL - half);
  const sx = toIx(ax), sz = toIx(az), tx = toIx(bx), tz = toIx(bz);

  const open = [];   // tiny binary heap of [f, ix, iz]
  const push = (f, ix, iz) => {
    open.push([f, ix, iz]);
    let i = open.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (open[p][0] <= open[i][0]) break;
      [open[p], open[i]] = [open[i], open[p]]; i = p;
    }
  };
  const pop = () => {
    const top = open[0], last = open.pop();
    if (open.length) {
      open[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < open.length && open[l][0] < open[m][0]) m = l;
        if (r < open.length && open[r][0] < open[m][0]) m = r;
        if (m === i) break;
        [open[m], open[i]] = [open[i], open[m]]; i = m;
      }
    }
    return top;
  };

  const gScore = new Float32Array(N * N).fill(Infinity);
  const from = new Int32Array(N * N).fill(-1);
  gScore[key(sx, sz)] = 0;
  push(Math.hypot(tx - sx, tz - sz), sx, sz);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let iter = 0;

  while (open.length && iter++ < 60000) {
    const [, ix, iz] = pop();
    if (ix === tx && iz === tz) {
      const path = [];
      let k = key(tx, tz);
      while (k !== -1) {
        path.push({ x: (k % N) * CELL - half, z: Math.floor(k / N) * CELL - half });
        k = from[k];
      }
      return path.reverse();
    }
    const g0 = gScore[key(ix, iz)];
    const h0 = hAt(ix, iz);
    for (const [dx, dz] of DIRS) {
      const nx = ix + dx, nz = iz + dz;
      if (nx < 1 || nz < 1 || nx >= N - 1 || nz >= N - 1) continue;
      const h1 = hAt(nx, nz);
      if (h1 < WORLD.seaLevel - 0.2) continue;                    // stay out of the sea
      const run = Math.hypot(dx, dz) * CELL;
      const grade = Math.abs(h1 - h0) / run;
      if (grade > MAX_TRAIL_GRADE) continue;                      // trails avoid steep faces
      const cost = run * (1 + 9 * grade * grade);                 // prefer flat routes
      const k1 = key(nx, nz);
      if (g0 + cost < gScore[k1]) {
        gScore[k1] = g0 + cost;
        from[k1] = key(ix, iz);
        push(g0 + cost + Math.hypot(tx - nx, tz - nz) * 1.01, nx, nz);
      }
    }
  }
  return null;
}

function smooth(path) { // one Chaikin pass — keeps grid paths from zigzagging
  if (path.length < 3) return path;
  const out = [path[0]];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i + 1];
    out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 });
    out.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
  }
  out.push(path[path.length - 1]);
  return out;
}

export function buildTrails(field, terrainMesh) {
  const ground = field.groundAt;
  const V = WORLD.village;
  const S = WORLD.landing ?? WORLD.spawn; // beach trail runs village ↔ coast

  // the kelp trail ends at the shoreline, not in the water
  let shore = { x: S.x, z: S.z };
  for (let t = 0; t < 1; t += 0.02) {
    const x = V.x + (WORLD.kelp.x - V.x) * t, z = V.z + (WORLD.kelp.z - V.z) * t;
    if (ground(x, z) < WORLD.seaLevel + 0.7) break;
    shore = { x, z };
  }

  const pairs = [
    [S, V],
    [V, WORLD.hill],
    [V, WORLD.hunt],
    [V, shore],
  ];
  const paths = [];
  for (const [a, b] of pairs) {
    const p = astar(ground, a.x, a.z, b.x, b.z);
    if (p && p.length > 2) paths.push(smooth(p));
  }
  WORLD.trails = paths;

  // rasterize the trails into a mask (1px = 1m), then tint terrain vertices
  const size = WORLD.size, half = size / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const [w, alpha] of [[3.6, 0.45], [1.9, 1]]) { // soft edge + solid core
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = w;
    for (const path of paths) {
      ctx.beginPath();
      ctx.moveTo(path[0].x + half, path[0].z + half);
      for (const p of path) ctx.lineTo(p.x + half, p.z + half);
      ctx.stroke();
    }
  }
  const mask = ctx.getImageData(0, 0, size, size).data;

  const geo = terrainMesh.geometry;
  const pos = geo.attributes.position, col = geo.attributes.color;
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const px = Math.round(pos.getX(i) + half), pz = Math.round(pos.getZ(i) + half);
    if (px < 0 || pz < 0 || px >= size || pz >= size) continue;
    const a = mask[(pz * size + px) * 4 + 3] / 255;
    if (a <= 0.02) continue;
    c.setRGB(col.getX(i), col.getY(i), col.getZ(i)).lerp(TRAIL_COL, a * 0.8);
    col.setXYZ(i, c.r, c.g, c.b);
  }
  col.needsUpdate = true;
  return paths;
}
