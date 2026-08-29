// Village NPCs — axolotls from the character sheet who hang out around town.
// They idle-wander near their home spot, turn to face Coal when he's close,
// and talk when clicked (dialog handled by game/dialog.js).

import * as THREE from 'three';
import { buildAxolotl } from '../player/coal.js';
import { WORLD } from './terrain.js';

const ROSTER = [
  {
    name: 'Matcha',
    build: {
      name: 'matcha', body: 0x5d8f4e, belly: 0x476f3a, stomach: 0xaecb92,
      gill: 0x3f7439, eyeStyle: 'line', brows: 0x2c4a26,
    },
    scale: 1.05,
    home: (V) => ({ x: V.x + 3.4, z: V.z + 2.6 }), // by the well
    lines: [
      'Hmph. Slimes in the groves again. Keep that sword sharp, Coal.',
      'I train by the standing stones every dawn. Discipline!',
      'Eyebrows? These are FOCUS lines.',
      'The Magma Axolotl... no. Forget I said anything.',
    ],
  },
  {
    name: 'Spark',
    build: {
      name: 'spark', body: 0xe3d15c, belly: 0xcbb648, stomach: 0xf4eebb,
      gill: 0xc98a52, eyeStyle: 'round', iris: 0x3fa8b8,
    },
    scale: 0.95,
    home: (V, lm) => {
      const m = lm.find((l) => l.name === 'Food Market');
      const d = Math.hypot(V.x - m.x, V.z - m.z) || 1;
      // market-side of the square, outside the shop's open radius
      return { x: m.x + ((V.x - m.x) / d) * 6.5, z: m.z + ((V.z - m.z) / d) * 6.5 };
    },
    lines: [
      'Zap! Did I scare you? Hehe.',
      'The berry bowls here? Best in the whole ocean. Land. Whatever!',
      'I saw a slime bounce ALL the way down the hill once. Ten out of ten.',
      'Race you to the Hunting Point! ...right after snacks.',
    ],
  },
  {
    name: 'Bubble',
    build: {
      name: 'bubble', body: 0x8a6b4f, belly: 0x6d5138, stomach: 0xc9ab89,
      gill: 0x54402e, eyeStyle: 'line',
    },
    scale: 1.0,
    home: (V) => {
      const a = (205 / 180) * Math.PI; // porch-side of a house ring spot
      return { x: V.x + Math.sin(a) * 11.5, z: V.z + Math.cos(a) * 11.5 };
    },
    lines: [
      'blub... oh. Hi, Coal.',
      'I like watching the kelp sway. It knows things.',
      'One shiny token is lucky. Ten shiny tokens is shopping.',
      'The tide sounds like a lullaby tonight.',
    ],
  },
];

ROSTER.push({
  name: 'Hope',
  build: {
    name: 'hope', body: 0xd9c98e, belly: 0xbfa96a, stomach: 0xf1e9cf,
    gill: 0xc9a55c, eyeStyle: 'round', iris: 0x7d9fc0, lids: true,
    circlet: { band: 0xd4af37, gem: 0x4a7fd4 },
    rings: 0xd4af37,
  },
  scale: 1.08,
  roam: 2.2, // stays close to her statue
  home: (V, lm) => {
    const h = lm.find((l) => l.name === 'Hope of the Axolotls Hill');
    return { x: h.x + 3.1, z: h.z - 2.6 };
  },
  lines: [
    'You found me. Most travellers only ever see the statue.',
    'I keep watch over the axolotls from this hill. Someone must hope loudly.',
    'The circlet? A gift from the old ones. Its crystal remembers the sea.',
    'Storms are coming, little Coal. Keep your friends close and your gills flared.',
  ],
});

function turnToward(heading, want, maxStep) {
  let d = want - heading;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return heading + Math.max(-maxStep, Math.min(maxStep, d));
}

export function createNPCs(field, scene, landmarks) {
  const ground = field.groundAt;
  const V = WORLD.village;
  const list = [];

  ROSTER.forEach((def, i) => {
    const home = def.home(V, landmarks);
    const ax = buildAxolotl(def.build);
    ax.root.scale.setScalar(def.scale);
    ax.root.position.set(home.x, ground(home.x, home.z), home.z);
    ax.root.traverse((o) => { o.userData.npcIndex = i; });
    scene.add(ax.root);
    list.push({
      name: def.name, lines: def.lines, lineIndex: 0, roam: def.roam ?? 4,
      ax, home, heading: Math.random() * Math.PI * 2,
      target: null, wait: 2 + Math.random() * 6,
      obstacle: { x: home.x, z: home.z, r: 0.55 },
    });
  });

  function update(dt, player) {
    for (const n of list) {
      const p = n.ax.root.position;
      const dPlayer = Math.hypot(player.pos.x - p.x, player.pos.z - p.z);
      let speed = 0;

      if (dPlayer < 3.6) {
        // greet: stop and face Coal
        const want = Math.atan2(player.pos.x - p.x, player.pos.z - p.z);
        n.heading = turnToward(n.heading, want, 4 * dt);
        n.target = null;
      } else if (n.target) {
        const d = Math.hypot(n.target.x - p.x, n.target.z - p.z);
        if (d < 0.35) {
          n.target = null;
          n.wait = 4 + Math.random() * 9;
        } else {
          const want = Math.atan2(n.target.x - p.x, n.target.z - p.z);
          n.heading = turnToward(n.heading, want, 2.5 * dt);
          speed = 1.1;
          p.x += Math.sin(n.heading) * speed * dt;
          p.z += Math.cos(n.heading) * speed * dt;
        }
      } else if ((n.wait -= dt) <= 0) {
        // pick a new stroll spot near home, on open walkable ground
        for (let tries = 0; tries < 6 && !n.target; tries++) {
          const a = Math.random() * Math.PI * 2, r = 1.2 + Math.random() * n.roam;
          const tx = n.home.x + Math.sin(a) * r, tz = n.home.z + Math.cos(a) * r;
          if (ground(tx, tz) > WORLD.seaLevel + 0.5) n.target = { x: tx, z: tz };
        }
        if (!n.target) n.wait = 5;
      }

      p.y = ground(p.x, p.z);
      n.ax.root.rotation.y = n.heading;
      n.ax.animate(dt, speed, true);
      n.obstacle.x = p.x; n.obstacle.z = p.z;
    }
  }

  function raycast(raycaster) {
    const hits = raycaster.intersectObjects(list.map((n) => n.ax.root), true);
    if (!hits.length) return null;
    return list[hits[0].object.userData.npcIndex] ?? null;
  }

  return {
    list, update, raycast,
    obstacles: list.map((n) => n.obstacle),
    dispose(sc) { for (const n of list) sc.remove(n.ax.root); },
  };
}
