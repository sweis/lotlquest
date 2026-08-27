# LotlQuest (three.js) — progress

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
