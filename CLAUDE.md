# CLAUDE.md — Building a 3D game with Claude

This file tells Claude how to work on this game. **Section 1 is yours:** paste your creative direction there and keep it current. Everything below it is the working rules Claude follows on every change. Edit freely; delete the engine sections you don't use.

---

## 1. Creative direction — 

- **One-line pitch:** First person open world game where the main character is an anthropomorphic axolotl that goes on an adventure.

- **Genre + core loop:** Players explore an open world where they can find coins, do battles, and trade with a town. They explore and interact with the environment and other characters.
- **Feel + references:** The world should feel realistic, but the characters can be more whimsical and fantastical. Zelda games would be a good analog or Pokemon. There is a screenshot of a child's drawing of Axolotl characters that can be motivation.
- **Camera:** This person chase
- **Art direction:** Realistic terrain and world. Characters can be in a 3d rendered cute style.
- **Palette:** Characters can be bright colored.
- **Audio direction:** TBD
- **Must-haves for v1:** Be able to walk around as a character even if you can't interact with anything.
- **Multiplayer stance:** Solo only
- **Target platform + perf budget:** Target platform is a playable web game that can be copied as static files to a repo. 
- **Engine:** web/three.js …
- **IP line:** Free assets are okay to use

When this section and a rule below conflict, this section wins. When it is silent, Claude decides, states the decision in one line, and moves on.

---

## 2. How Claude works on this project

### 2.1 Everything is text; close the loop yourself
- Prefer code, scene files, configs and scripts you can read and diff over editor clicks. If a change can be made by editing a file, do that instead of driving an inspector.
- Never act blind for more than one step. After every change that affects what the player sees, capture a frame (or a short frame sequence for motion) from a named camera and look at it before the next change. After every change that affects behaviour, read numbers from game state, not pixels.
- Post the picture, not a description of it. Every meaningful pass ends with an in-engine capture attached to the update, shot through the real player path (not a dev harness dressed differently), captioned with what changed.
- Always say what is verified and what isn't ("two local clients verified; real-network multiplayer not tested with humans").

### 2.2 Build the debug hooks first (day 1, before content)
Expose these behind a dev flag / URL param / editor menu, and keep them working for the life of the project:
- `teleport(x,y,z | namedSpot)`, `freeze() / step(n) / resume()`, `setTimeOfDay(h)`, `setSeed(n)`, `spawn(kind, at)`, `clearAll()`, `win() / lose()`.
- Named fixed cameras — `cam("overview")`, `cam("hero-close")`, `cam("hud-check")` — so before/after shots are comparable.
- `getState()` → a JSON snapshot of everything gameplay-relevant: positions, velocities, health, score, round phase, entity counts, current level id, frame ms, draw calls, shader-program count, GPU/renderer string, context-lost flag.
- A deterministic mode: fixed timestep, seeded RNG, optional `simdt` override so scripted runs replay identically.
- An on-screen diagnostics overlay (GPU string, frame ms, draw calls, last shader error) that also works on a phone.

### 2.3 Check behaviour with numbers, check looks with pictures
- Write assertions against `getState()`: "after holding W for 2 s, speed > 8"; "a novice bot finishes lap 1 with 0 respawns"; "every quest objective resolves to a placed world position"; "shader-program count is constant from the first title frame".
- Sweep input *combinations* (W+A at full steer), not single axes. Exercise the real input→intent path at least once per feature, not only injected intents — dead input paths pass sim-level tests.
- Run a stills sweep over *every* level/biome/stage enumerated from the game's own registry (never a hand-picked subset); fail on any blank frame (mean luma ≈ 0 or < 2 % pixel variance) or console error.
- Take at least one composited full-window screenshot through the true cold-boot path (cleared storage, no dev flags). Canvas read-backs don't see a DOM/UI overlay left covering the screen; players do.
- Content probes beat playthroughs for coverage: check data (spawn tables, objectives, nav links) resolves before checking it plays.

### 2.4 Iteration cadence
- Small diffs, one concern each. Before calling anything done — including a one-line hotfix — boot the game headless for ~10 s and assert sim time advances with no console errors.
- Playtest the first five minutes before building breadth: ship the intro + one level, get a human read, then widen.
- Environment before hero asset; art pass before netcode polish; textures last.
- Make low-stakes design calls yourself and report them in one line ("went with X — say if you'd rather Y"). Stop and ask only for irreversible or direction-setting choices.
- Commit early and often with explicit paths; keep `notes/progress.md` current enough that a cold reader could resume.

### 2.5 Definition of done (every iteration)
- [ ] Boots cold with no console errors; sim time advances.
- [ ] The change is visible in an attached capture from a named camera (before/after if visual).
- [ ] A `getState()` assertion covers the behaviour touched, and it passes.
- [ ] Frame ms and draw calls within the Section 1 budget on the reference tier; program/light count unchanged unless intended.
- [ ] Real input path exercised (real mouse/touch coordinates, not synthetic events).
- [ ] Notes updated: what changed, verified vs not, what's next.

### 2.6 When stuck
- Two failed attempts at the same fix → stop patching and instrument: add the state field, counter or overlay that would have made the cause obvious, then look again.
- Symptom lookup: "black screen" → check UI/DOM overlays before the GPU. "White 3D view, HUD still works" on Android → lost graphics context. "Freezes the first time only" → shader recompiles (see 3.3). "Flickering textures" → coplanar geometry z-fighting. "Shadows vanished" → diff one frozen frame shadows on/off, then check boot-time quality config. "Player teleports after a stall" → uncapped fixed-step catch-up.
- If a reference or asset source is unreachable, ask for pasted screenshots; don't guess the look.
- If the ask is "photoreal / AAA", state the honest ceiling in the first reply (procedural + scripted-DCC assets top out around clean, slightly stylised realism, convincing at walking pace — not scan quality) and pitch two bold stylised directions alongside. Stylised-and-confident beats almost-realistic every time.

---

## 3. Craft defaults (apply unless Section 1 overrides)

### 3.1 Look-dev floor
- Decide the look before building: sun direction + time of day (never noon), the palette, one material rule (toon + hull outline / cel + ink / gradient atlas / matte clay / textured PBR), three refusals. Styles that replace light transport with graphic design (ink, paper, clay, toy, vector, clean low-poly) succeed with procedural assets; styles that merely filter a realistic render inherit its sameness.
- Lighting floor: hemisphere/sky ambient (not flat ambient) + one directional sun with its shadow frustum *fitted to the play area* (cascades beyond ~60 m), small normal bias (~0.03), every mesh casts and receives, analytic sky with fog matched to the horizon colour, filmic/ACES tonemapping at one fixed exposure, ambient occlusion at a world-space radius (~2 m) or baked AO. With physically based units: sun ≈ 3–4, sky ≈ 0.6–1.
- The "looks cheap" tells, in order of payoff to fix: no contact shadow/AO; single-colour ground (give it two frequencies — macro tint + ruts/decals/scatter); flat horizon into a gradient sky (add haze and distant silhouettes); primitive secondary assets (no cone pines, sphere trees, capsule crowds); uniform specular; a hero-vs-environment quality gap. Fitted shadows and real silhouettes buy more than any texture or post effect.
- Never grainy: no film grain, sharpen or chromatic aberration; denoised AO; MSAA or temporal AA; soft shadows; gentle bloom; true blacks and no blown whites. Never show frames with stand-in noise textures on large surfaces — clean flat materials until real ones land.
- Textures last and never 1:1 from a catalogue: tint × subtle albedo with real normal/roughness, world-metre tiling with a large-scale two-set blend to kill repetition, metallic off on dielectrics. Naively applied photo textures look worse than none.
- Render at `min(devicePixelRatio, 2)` with AA; capping pixel ratio at 1.25–1.5 under a 2× layout makes everything soft. Deliberate low-res looks need an exact integer upscale.
- Flair is event-driven and in-world (hit-stop, impact pops, damage numbers, rim glow on the aimed target), never a constant full-screen filter or always-on speed lines.

### 3.2 Game feel + UX
- Arcade-forgiving by default: assists on, soft wall collisions, generous checkpoints/gates, bots near novice pace; sim handling is opt-in. Gate: a novice proxy (250 ms reaction, no braking) completes the first lap/level without a respawn.
- Third-person action/party games: close chase cam (≈ 8 back, 4 up, FOV ~45) that swings behind travel with frame-rate-independent smoothing; active verbs on dedicated keys (jump, dive/dodge, shove/grab); telegraphed hazards that force those verbs; short auto-starting rounds (45–60 s). Large position jumps *cut* the camera, never pan. A distant diorama camera with passive attrition reads as boring regardless of asset quality.
- First-person: pointer-lock mouse-look with raw deltas and a centre reticle, brisk sensitivity, never cursor-at-edge turning; retry in ≤ 3 s, skippable intros.
- Ship the trimmings from v1 on simple systems: title → one-click **Play now**; **Play with friends** (short room code + copyable link, visible player list marking humans, host-owned Bots on/off); Esc pause/settings; a scoreboard titled LEADERBOARD or HIGH SCORES; round flow; death/finish screen; audio; animation states.
- `?` (plus a pause-menu/touch entry) opens a help sheet — controls, goals, tips — generated from the game's own content/constant tables so it never drifts from the build.
- HUD type: a clean sans-serif, no text shadows or glows; solve legibility with contrast (dark ink, or thin frosted strips over bright worlds), light weights for big numerals, small tracked caps for labels.
- Touch: full-height control zones, short throw, dead-zone ≤ 0.06, no input smoothing in UI code.

### 3.3 Performance + weak GPUs
- Budgets live in Section 1; log against them every run: frame ms (p50/p99), draw calls, triangles, shader programs, texture memory, load time, download size. Ship lightweight telemetry/diagnostics so real devices tell you what broke.
- Shader warm-up: many engines key lit-material programs on the active light count, so toggling lights or spawning the first explosion recompiles everything mid-game (the classic "1 s freeze the first time, fine after"). Never change light count at runtime — pooled lights stay enabled at intensity 0. Behind the loading screen, instantiate one of every effect/material, compile, draw a real frame including the shadow pass, then return everything to pools. Assert program count stays constant after the title frame.
- Mobile: no MSAA on phones by default (on some mobile GPUs an MSAA target makes a lost context unrecoverable), basic PCF shadows, async shader compile before the first frame, a real context-lost/restored handler that rebuilds renderer + scene, and a persisted step-down ladder (shadows off → fewer lights / lower res → all low) with a "graphics reset — tap to reload" card. Some recent mobile GPUs reset on the shadow-map depth pass itself: detect them by renderer string and start with cast shadows off plus a blob/contact shadow. Desktop phone emulation reproduces none of this — test on a device.
- Per-draw CPU overhead is the mobile bottleneck: merge/instance draws; never update vertex buffers that in-flight frames still read (double-buffer or orphan); never synchronous GPU read-backs per frame or per icon (bake UI portraits/thumbnails once at boot).
- Fixed-step sim: clamp `dt ≥ 0`, cap catch-up ticks after a stall, and make watchdogs require N consecutive slow ticks rather than one long warm-up frame. Resize render targets whenever the drawing buffer changes.

### 3.4 Assets
- Default DCC is headless Blender as a Python module (`pip install bpy`, pinned to the release matching your Python version; it can segfault on interpreter *exit* after a successful export — check the output file, not the exit code). Script the model → export GLB → load in engine. Use it for bevelled hard-surface props, vehicles, set pieces, AO/lightmap bakes and beauty renders; keep stylised characters code-built unless a side-by-side says Blender wins.
- Per hero asset plan pass 1 / pass 2 / final; check the read at close-up *and* thumbnail scale; post before/after. Raise triangle budgets rather than ship box placeholders: characters get rounded forms, tapered limbs, hands, faces, layered clothing, personality in idle; props get chunky readable forms with rivets/decals.
- Try CC0 libraries (Poly Haven, ambientCG, Kenney, KayKit, Khronos sample models) before hand-authoring; verify the licence; version every asset URL (`?v=<build>`) because CDNs cache binaries as immutable. Off-the-shelf kits rarely fit a themed brief exactly — budget for adaptation.
- Hero/thumbnail shots: hide HUD, camera low and close on the subject (40–70 % of frame height), a moment with motion, one calm side for type, sim paused via debug hooks, staged through legal player placement.

---

## 4. Engine notes

### 4.1 Web (three.js / Babylon / PlayCanvas) — the most proven path
- Code-first suits Claude best: the whole game is text, boots in a headless browser, and screenshots + state come back in seconds. Single-file or small-bundle builds keep the loop fast.
- Drive tests with Playwright using real input — `page.mouse.click(x,y)`, `page.mouse.wheel`, `page.touchscreen.tap` at viewport coordinates — and assert `document.elementFromPoint(cx,cy) === canvas` at centre and corners. Synthetic `dispatchEvent` clicks bypass hit-testing and hide input-blocking overlays; a `pointer-events:none` container silently kills its child menus.
- Headless WebGL is a software rasteriser: absolute timings are meaningless and flap run-to-run, and NaN pixels / driver overhead never show. Gate on hardware-independent numbers (`renderer.info.programs.length`, a draw-call census, light count); poll for state instead of sleeping (a frame can take 300–1200 ms); treat "ready" as three presented frames; keep a `?nancheck` float-target probe for real devices.
- `recordVideo` of a WebGL canvas can come out blank headless; capture a screenshot sequence (~100 ms apart) and encode with ffmpeg, verifying non-blank by pixel variance.
- Two-client netcode gate without humans: two tabs on a local transport (e.g. `BroadcastChannel`) sharing the host-authoritative sim path; assert input→state round-trips both ways before every deploy.
- GLSL edits: land declaration + use together, then load the page and grep the console for compile errors — unit tests can't see shader failures.
- After deploy, fetch the live page and check a build-marker string and a changed asset's byte size before saying it's live.

---

## 5. Update template (use for every progress post)

**Changed:** one or two sentences.
**See:** attached capture(s) from `cam("…")`, before/after if visual.
**Verified:** assertions that passed, tiers/devices tested. **Not verified:** …
**Numbers:** frame ms p50/p99 · draw calls · programs · load time · size.
**Decisions I made:** … (say if you'd rather Y).
**Next:** …


