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
      gill: 0x2c5527, eyeStyle: 'line', brows: 0x2c4a26, // darker green gills
      trident: 0xd4af37, // his golden trident (see the new art)
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
    name: 'Bubbles',
    build: {
      name: 'bubbles', body: 0x39a8a0, belly: 0x2b827c, stomach: 0xc4ece6,
      gill: 0x1f6f6a, eyeStyle: 'round', iris: 0x2a6e78,
    },
    scale: 0.98,
    roam: 0.9, // tends the weapon stall
    home: (V, lm, ground, stalls) => {
      const s = stalls.find((st) => st.mode === 'weapons') ?? stalls[0];
      const d = Math.hypot(s.x - V.x, s.z - V.z) || 1;
      return { x: s.x + ((s.x - V.x) / d) * 1.5, z: s.z + ((s.z - V.z) / d) * 1.5 };
    },
    lines: [
      'Sharp things! Pointy things! Welcome!',
      'A wooden sword floats. An iron sword does not. Choose wisely.',
      'I test every blade on slime jelly. Quality guaranteed!',
      'Storm buys arrows and never says thank you. Typical.',
    ],
  },
  {
    name: 'Coral',
    build: {
      name: 'coral', body: 0xe58bb0, belly: 0xc76e96, stomach: 0xf7d7e4,
      gill: 0xd45f92, eyeStyle: 'round', iris: 0x8a5fb8,
    },
    scale: 0.96,
    roam: 0.9, // tends the potion stall
    home: (V, lm, ground, stalls) => {
      const s = stalls.find((st) => st.mode === 'potions') ?? stalls[stalls.length - 1];
      const d = Math.hypot(s.x - V.x, s.z - V.z) || 1;
      return { x: s.x + ((s.x - V.x) / d) * 1.5, z: s.z + ((s.z - V.z) / d) * 1.5 };
    },
    lines: [
      'Fresh-brewed fizz! Careful — it tickles.',
      'Zoom Juice is just kelp, bubbles and belief.',
      'One sip of Lucky Fizz and the tokens practically chase you.',
      'Hope taught me the recipes. The crystal remembers them all.',
    ],
  },
  {
    name: 'Spark',
    build: {
      name: 'spark', body: 0xe3d15c, belly: 0xcbb648, stomach: 0xf4eebb,
      gill: 0xc98a52, eyeStyle: 'round', iris: 0x3fa8b8,
    },
    scale: 0.95,
    roam: 0.9, // tends the food stall
    home: (V, lm, ground, stalls) => {
      const s = stalls.find((st) => st.mode === 'market') ?? stalls[1];
      const d = Math.hypot(s.x - V.x, s.z - V.z) || 1;
      return { x: s.x + ((s.x - V.x) / d) * 1.5, z: s.z + ((s.z - V.z) / d) * 1.5 };
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

ROSTER.push({
  name: 'Storm',
  build: {
    name: 'storm', body: 0x232329, belly: 0x1c1c21, stomach: 0x232329, // solid black, black belly
    gill: 0x6a4f9e, sclera: 0x17171b,                                  // black-on-black eyes
    limbs: 0x6a4f9e, headband: 0xd4af37, spines: 0x7a5cb5, // gold headband now
    tailStyle: 'curl',
  },
  scale: 1.02,
  roam: 3,
  home: (V, lm, ground) => { // the shore of the kelp grounds
    const k = lm.find((l) => l.name === 'The Kelp Grounds');
    for (let t = 0; t <= 1; t += 0.02) {
      const x = k.x + (V.x - k.x) * t, z = k.z + (V.z - k.z) * t;
      if (ground(x, z) > 2.7) return { x, z };
    }
    return { x: V.x, z: V.z - 8 };
  },
  lines: [
    '...You are dripping on my spot.',
    'The kelp listens. That is more than most do.',
    'Storms chase no one. Everyone simply stands where the lightning goes.',
    'Hmph. Tell Hope the clouds say hello.',
  ],
});

// The rest of the paper's cast — everyone lives around the village.
// Simple palettes, short lines; villageHome scatters them on the ring.
const villageHome = (deg, r) => (V) => ({
  x: V.x + Math.sin((deg / 180) * Math.PI) * r,
  z: V.z + Math.cos((deg / 180) * Math.PI) * r,
});
ROSTER.push(
  {
    name: 'Splash',
    build: { name: 'splash', body: 0x3f8fd4, belly: 0x2f6fa8, stomach: 0xcfe6f7, gill: 0x2a5f9e, eyeStyle: 'round', iris: 0x1f4f8a },
    scale: 1.0, roam: 4, home: villageHome(105, 10),
    lines: ['Did someone say swimming?!', 'The fountain is NOT for cannonballs. I checked.', 'Race you around the island! Loser is a land snail.'],
  },
  {
    name: 'Flame',
    build: { name: 'flame', body: 0xd4703f, belly: 0xa8542c, stomach: 0xf2c9a8, gill: 0xc2452a, eyeStyle: 'line' },
    scale: 1.0, roam: 3, home: villageHome(160, 12),
    lines: ['I am not hot-headed. I am warm-spirited.', 'One day I will see the mountain breathe fire. One day.', 'Cold water is a personal insult.'],
  },
  {
    name: 'Iris',
    build: { name: 'iris', body: 0xc9a8e8, belly: 0xa886c9, stomach: 0xf2e6fa, gill: 0xd45f92, limbs: 0x4ec2b8, eyeStyle: 'round', iris: 0x8a5fb8 },
    scale: 0.97, roam: 4, home: villageHome(230, 11),
    lines: ['I could not pick a favourite colour, so I kept them all.', 'Rain plus sun equals ME.', 'Storm says I am too bright. I take that as a compliment.'],
  },
  {
    name: 'Gold',
    build: { name: 'gold', body: 0xd9a441, belly: 0xb5842e, stomach: 0xf4e3b8, gill: 0xc28a2a, eyeStyle: 'line' },
    scale: 1.02, roam: 3, home: villageHome(285, 13),
    lines: ['No, I am not made of tokens. Stop biting me, Spark.', 'Shiny on the outside, shinier on the inside.', 'The Gold lotl always pays his debts.'],
  },
  {
    name: 'Memo',
    build: { name: 'memo', body: 0x7fb8ad, belly: 0x5f968c, stomach: 0xd9efe9, gill: 0x4a7f76, eyeStyle: 'round', iris: 0x35635c },
    scale: 0.94, roam: 3, home: villageHome(95, 12),
    lines: ['I remember everything. You blinked twice since we met.', 'Note to self: kelp for dinner. Again.', 'Hope asked me to remember something important. ...It will come back to me.'],
  },
  {
    name: 'Pebble',
    build: { name: 'pebble', body: 0x8a93a3, belly: 0x6d7684, stomach: 0xd3d9e0, gill: 0x5a6473, eyeStyle: 'line' },
    scale: 0.92, roam: 2.5, home: villageHome(210, 12.5),
    lines: ['Rocks are just very patient friends.', 'I have named every stone on this beach. That one is Gerald.', 'Slow and steady. Mostly slow.'],
  },
  {
    name: 'Cosmo',
    build: { name: 'cosmo', body: 0x35315e, belly: 0x272348, stomach: 0x8d86c4, gill: 0x6a4f9e, eyeStyle: 'round', iris: 0x9fd4ff },
    scale: 1.0, roam: 4, home: villageHome(320, 12),
    lines: ['The stars visit the island when everyone sleeps.', 'I counted the sky once. I lost my place at forever.', 'The Moxolotl Cave hums at night. Listen.'],
  },
  {
    name: 'Spot',
    build: { name: 'spot', body: 0xded7c9, belly: 0xbfb6a4, stomach: 0xf7f3ea, gill: 0x2b2b33, eyeStyle: 'line', brows: 0x2b2b33 },
    scale: 1.0, roam: 4, home: villageHome(10, 13),
    lines: ['They call me Spot. Long story. Mad Bao knows.', 'You should see my OTHER spots.', 'I spotted you first. That is how it works.'],
  },
  {
    name: 'Wave',
    build: { name: 'wave', body: 0x3f9fa8, belly: 0x2f7f86, stomach: 0xc9ecef, gill: 0x2a6f76, eyeStyle: 'round', iris: 0xe8f4f6 },
    scale: 0.98, roam: 4, home: villageHome(133, 12),
    lines: ['The tide goes out. The tide comes back. I respect that.', 'Splash is faster, but I am smoother.', 'Some day I will surf the big storm swell. Do not tell Storm.'],
  },
  {
    name: 'Light',
    build: { name: 'light', body: 0xf2ecd4, belly: 0xd9d0ae, stomach: 0xfdfbf2, gill: 0xe0b33a, eyeStyle: 'round', iris: 0xd9a441 },
    scale: 0.96, roam: 3, home: villageHome(258, 10),
    lines: ['Good morning! It is always morning somewhere.', 'Hope taught me to glow on the inside.', 'Dark caves are just rooms that have not met me yet.'],
  },
);

function turnToward(heading, want, maxStep) {
  let d = want - heading;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return heading + Math.max(-maxStep, Math.min(maxStep, d));
}

export function createNPCs(field, scene, landmarks, stalls = [], obstacles = []) {
  const ground = field.groundAt;
  const V = WORLD.village;
  const list = [];

  ROSTER.forEach((def, i) => {
    const home = def.home(V, landmarks, ground, stalls);
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
          const nx = p.x + Math.sin(n.heading) * speed * dt;
          const nz = p.z + Math.cos(n.heading) * speed * dt;
          // never step through a wall/rock/building — give up on that stroll
          let hit = false;
          for (let oi = 0; oi < obstacles.length; oi++) {
            const o = obstacles[oi];
            if (o === n.obstacle) continue;
            const dx = nx - o.x, dz = nz - o.z;
            if (dx * dx + dz * dz < (o.r + 0.05) * (o.r + 0.05)) { hit = true; break; }
          }
          if (hit) { n.target = null; n.wait = 2 + Math.random() * 5; speed = 0; }
          else { p.x = nx; p.z = nz; }
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
