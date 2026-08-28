# LotlQuest (three.js) — progress

## 2026-08-27 (night) — v0.5: combat loop, shop, enterable houses, trails, minimap zoom (Steve)

- **Bog slimes** (`src/world/monsters.js`): 14 hopping blobs, deterministic spawns away
  from village/spawn/hill (a pack near the Hunting Point), wander + aggro at 9m, hop
  physics with squash, contact damage + knockback, hp 3, pop → 1–3 token drops,
  respawn 22s. Verified: 3 bites = kill; contact knocks Coal back and costs hearts.
- **Combat** (`src/game/combat.js`): F attacks with the active weapon. Melee = bite 1 /
  wooden sword 2 / iron sword 3 in a 1.9m front arc; **Kelp Bow** shoots arrows
  (16 m/s, slight drop, damage 2 — hit test is a cylinder on the slime BODY, not the
  ground-level root; that bug cost an arrow). 1/2 switches melee/bow. Tokens magnet-
  pick-up at 1.25m. Hearts HUD + token counter + weapon row; hurt flash + blink invuln;
  death → TRY AGAIN → respawn at spawn keeping tokens/gear.
- **Armory shop** (`src/game/shop.js`): walks-up-to-door proximity (<5.2m) opens the
  sheet; catalog: wooden/iron sword, kelp bow, leaf/iron shell (+1/+2 hearts). Gear is
  VISIBLE on Coal (sword in right hand, bow in left, back shell). localStorage save of
  tokens+gear (survives reload — verified).
- **Enterable houses**: hollow builds (floor, 3 walls, doorway front, bed/table/crate),
  wall colliders as circle-chains with a gap at the door; the house Coal is inside
  ghost-fades (per-house cloned materials) so the chase cam can see him.
- **Trails** (`src/world/trails.js`): A* over passable terrain (grade ≤ 0.55, no sea)
  spawn↔village↔hill/hunt/shore, Chaikin-smoothed, rasterized to a canvas mask and
  painted into terrain vertex colors; trees keep off them; minimap draws them.
- **Minimap v2**: zoomed 170m player-centred viewport (north up), trails + landmark
  dots + bigger heading arrow.
- Shaded building walls were near-black → hemisphere light 0.8→1.0 (still moody on
  north faces — proper fill/GI pass later).
- lotl additions: attack/giveTokens/buy/openShop/closeShop/monsters/houses; getState.combat.

## 2026-08-27 (evening) — v0.4: the village + landmarks, minimap, click-to-walk (Steve)

- **Village** (`src/world/village.js`), sites picked deterministically in terrain gen
  (`WORLD.village/hill/kelp/hunt` + terrain flattened under the village): town square
  (dirt plaza + roofed well), 6 houses (colored pyramid roofs, doors, windows), the
  armory (stone, shield sign, barrels), food market (3 awning stalls with produce).
- **Hope of the Axolotls Hill**: most-PROMINENT knoll near the village (not a mountain
  flank — prominence-scored), with a stone Coal statue on a pedestal, standing stones,
  flowers, pink banner.
- **The Kelp Grounds**: ~87 bent kelp strands instanced in the shallows south of spawn,
  scaled so tips break the surface. **The Hunting Point**: far coastal brow with lookout
  deck, 2 ring targets, campfire.
- **Discovery toasts** (#toast) on entering each named place; names come from
  `village.landmarks`. **Minimap** (`src/game/minimap.js`): corner canvas, island
  prerendered from the height field, landmark dots, player arrow; M toggles.
  (Gotcha: the `#app, canvas` CSS rule was grabbing the minimap canvas — scoped to
  `#app > canvas`.)
- **Click/tap-to-walk**: click raycasts terrain; controller steers to the target
  (cancel on manual input, stall watchdog); gold pulsing ring marker.
- **Solid obstacles**: 227 circle colliders — buildings, well, statue, standing stones,
  scatter rocks AND tree trunks (Steve: could ghost through rocks). Escape rule: a gate
  (deep water / world edge / obstacle) only blocks moves that don't improve the
  situation — being teleported inside one can never trap you (the old 'beach' spot
  proved this: it sat in deep water and froze all movement).
- Water roughness 0.18→0.38 (killed a harsh white sun pillar on the sea).
- Teleport spots added: village, square, market, armory, hill, kelp, hunt; 'beach' now
  scans for actual sand. Verified: toasts fire at all 7 landmarks; well blocks at
  1.46m (r 1.4); 10s beach walk = 45.8m; real click → walked to within 0.42m, cleared.

## 2026-08-27 (later still) — v0.3: mesh grounding, slope gate, Coal face pass (Steve's feedback)

- **Peak float fixed**: gameplay now grounds on `field.groundAt()` — a sampler that
  replicates the terrain mesh's vertex grid AND PlaneGeometry's per-quad triangle split —
  installed by `buildTerrainMesh`. Analytic `heightAt` floats above the coarser rendered
  mesh at sharp crests (was ~0.2m at the summit). Vegetation/coins/camera use it too.
  Verified: modelMinY − groundY = 0.015m (foot pad) at spawn AND at the 30m peak.
- **Steep faces unclimbable**: movement blocked when rise/run > 0.9 (~42°) along the
  movement direction (downhill always free). Verified: a 1.06-grade face allows 0.00m
  uphill in 2s, 5.24m straight back down. NOTE: gate is direction-based, so switchbacking
  up at a traverse angle still works — summit = route-finding, beeline = blocked. Say if
  faces should be hard walls instead (would switch to surface-normal basis).
- **Coal face/body pass** (Steve, with art reference): white stomach oval; line pupils —
  dark slits slanted outer-end-up (V toward the nose, the drawing's determined look).
- **Dev server**: `dev-server.py` (python, Cache-Control: no-store) replaces bare
  http.server — Chrome was serving MIXED stale ES modules (fresh main.js + cached old
  terrain.js → `field.groundAt is not a function`). If a page ever acts stale:
  `fetch(url, {cache:'reload'})` per module, then reload. launch.json updated (autoPort).

## 2026-08-27 (later) — v0.2: tank controls, camera hold, upright Coal (Steve's feedback)

- **Controls → tank** (Steve: camera-relative W veered/circled while the camera panned):
  W/S drive along the character's own heading (back at 0.6×), A/D turn (3.0 rad/s),
  Q/E strafe, Shift run. Movement is fully camera-independent.
- **Camera → rigid relative hold**: drag sets a yaw offset relative to heading and it
  HOLDS — rear stays rear, side stays side as he moves. Auto-recenter removed.
- **Coal → upright biped** (Steve): stands on two legs, little swinging arms, egg torso,
  big head, droopy tail fin; walk = leg swings + counter arm swings + waddle roll/bob;
  jump = tucked legs + arms up. Blob contact shadow under him (kills the float illusion —
  measured feet at ground +1.5cm via lotl.modelMinY()).
- **Faster** (Steve): walk 3.4→4.6, run 6.2→8.2.
- Verified via freeze/step: side-dragged camera (offset 1.04) + 3s W → heading unchanged,
  path exactly straight, offset still 1.04 after; speeds 4.60/8.20; turn 3.00 rad/s;
  cold boot clean, no console errors.

## 2026-08-27 — v0.1: walkable island + Coal + debug hooks

**State: v1 must-have met** — you can walk around the island as Coal.

### What exists
- **Static-file app**: `index.html` + ES modules + vendored three.js r185 (`vendor/three/`,
  importmap, no build step). Serve any static host. Dev: `python3 -m http.server 8341 --directory LotlQuest-ThreeJS`
  (also `.claude/launch.json` → `lotlquest-web`).
- **World** (`src/world/`): seeded island heightfield (domain-warped radial falloff + fBm hills
  + ridged core, default seed 4242), analytic `heightAt()` shared by mesh/grounding/placement;
  vertex-color splat (sand/grass two-frequency/rock-on-slope/snow); ocean plane at y=2; gradient
  sky dome + fog matched to horizon; sun with shadow frustum fitted to a 110m box that follows
  the player (texel-snapped); ACES tonemapping. ~150 instanced clump-canopy trees + 60 rocks
  (4 draw calls). Spawn auto-located on the south coast per-seed (walk-inland scan).
- **Coal** (`src/player/coal.js`): procedural primitive build — wide flat head, big white
  forward-gazing eyes, 6 outward-flared gill frills, stubby legs, fin tail; waddle/bob/tail-sway
  driven by speed; jump tuck. Walk 3.4, run 6.2 (Shift), jump, wading + float at sea surface,
  deep-water and world-radius movement gates.
- **Camera** (`src/game/camera.js`): chase cam (FOV 45, dist 7) — drag orbits and holds while
  idle, recenters behind travel when moving; wheel zoom; terrain/sea floor clamp. Named cams:
  `chase`, `overview`, `hero-close` (front ¾), `hud-check`.
- **UI**: title → Play now; Esc pause; `?` help sheet generated from the controls table;
  win/lose banner; context-lost "tap to reload" card.
- **Debug hooks** (`window.lotl`): getState(), teleport(x,z|'spawn'|'peak'|'beach'),
  freeze/step(n)/resume, setTimeOfDay(h), setSeed(n), spawn('rock'|'coin'), clearAll,
  win/lose/play, cam(name), heightAt, press/release(code). `?play=1&cam=X&seed=N&simdt=S&dev=1`
  URL params. Diagnostics overlay: backtick or ?dev=1 (4-tap top-left corner on touch).
- Fixed 60Hz sim with accumulator, 5-tick catch-up cap, dt clamps.

### Verified (in-browser, Apple M4 Pro)
- Cold boot: no console errors, title over live scene, Play works, canvas hit-tests pass at
  centre + 4 corners.
- getState assertions: held W → speed 3.40 (=walk) +6.64m/2s straight; Shift run = 6.20;
  jump → airborne then lands; deep-water gate holds (floats at y≈1.82, can't leave world);
  freeze+step(60) advances simTime exactly 1.000s; setSeed(777)≠4242 worlds, same-seed
  heights byte-identical; real trusted key events reach the controller (inputCount);
  real drag changes orbit yaw/pitch.
- Numbers: ~8.4ms p50 frame, 59 draw calls, ~200k tris, 12 shader programs, 740K vendor + tiny sources.

### Not verified
- Real 60fps feel/input latency (agent's pane throttles rAF in background — needs a human run).
- Mobile/touch (no on-screen stick yet), context-loss recovery path, non-US keyboard layouts.

### Known quirks for future agents
- Browser-pane tab backgrounded → rAF fires 0×/s; use `lotl.freeze()/step(n)` for any
  wall-clock-independent behaviour test. Screenshots force a frame render.
- CDP-injected keys arrive with `key` set but **empty `e.code`** — controller maps by code
  with key fallback; click the canvas first or events go nowhere (focus).
- `javascript_exec` calls share one eval scope — wrap tests in IIFEs or `const` collides.

### Decisions made (say if you'd rather otherwise)
- Third-person chase cam (pitch says "first person" but camera line + Unity build + child-friendly
  reads = chase; can add a first-person toggle later).
- Character scale ~1.1m long "big cute axolotl"; world 512m island echoing the Unity island build.
- Colors/look: soft-realism low-poly — no textures yet per craft rules (textures last).

### Next
- Playtest the first five minutes with a human (Steve) — tune camera distance/sensitivity, walk feel.
- Coins to collect (spawn hook exists), then the town/market stub.
- Touch controls; simple ambient audio; title-screen axolotl cameo.
- Water edge treatment (shoreline foam line), grass detail scatter near the player.
