// Anthropomorphic axolotl builder — upright biped from primitives, matching
// the child's-drawing character sheet (big eyes, frilly external gills,
// standing on two legs). Coal is the default palette; NPCs pass their own
// colors, eye style ('line' | 'round' with an iris) and optional eyebrows.
// Model faces +Z, feet at y=0. animate() drives the walk from speed.

import * as THREE from 'three';

// one shared mottled-skin texture (procedural, neutral — multiplies colours)
let skinTexCache = null;
function skinTexture() {
  if (skinTexCache) return skinTexCache;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#d6d6d6';
  ctx.fillRect(0, 0, 128, 128);
  let a = 0x51f7;
  const rnd = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 260; i++) { // soft mottle + tiny freckles
    const x = rnd() * 128, y = rnd() * 128, r = 1 + rnd() * 4;
    ctx.fillStyle = rnd() > 0.4 ? 'rgba(90,90,100,0.10)' : 'rgba(255,255,255,0.09)';
    for (const [ox, oy] of [[0, 0], [128, 0], [-128, 0], [0, 128], [0, -128]]) {
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  skinTexCache = new THREE.CanvasTexture(cv);
  skinTexCache.wrapS = skinTexCache.wrapT = THREE.RepeatWrapping;
  skinTexCache.repeat.set(2, 2);
  skinTexCache.colorSpace = THREE.SRGBColorSpace;
  return skinTexCache;
}

export function buildAxolotl(opts = {}) {
  const C = {
    name: 'coal',
    body: 0x93949c,        // Coal's updated look: light gray body…
    belly: 0x7b7c84,       // ridge/fin accent
    stomach: 0xe9eaee,     // front patch (see art)
    gill: 0x141418,        // …with black gills
    eyeStyle: 'line',      // 'line' (determined slits) | 'round' (with iris)
    iris: 0x3fa8b8,        // used by 'round'
    brows: null,           // color → draws heavy eyebrows (Matcha)
    lids: false,           // serene half-closed lids over round eyes (Hope)
    circlet: null,         // {band, gem} → golden circlet with a crystal (Hope)
    rings: null,           // color → rings on arms, legs and tail (Hope)
    sclera: 0xf2f4f6,      // eye whites — dark for black-on-black eyes (Storm)
    limbs: null,           // color → arms/legs differ from the body (Storm)
    headband: null,        // color → cloth band around the head (Storm)
    spines: null,          // color → row of spikes down the back (Storm)
    tailStyle: 'fin',      // 'fin' | 'curl' (Storm's long curled tail)
    tailColor: null,       // color → tail differs from the body (Coal's black tail)
    trident: null,         // color → holds a trident staff (Matcha)
    gillStyle: 'spiky',    // 'spiky' | 'round' | 'frilly'
    ...opts,
  };
  const skin = skinTexture();
  const MAT = {
    body: new THREE.MeshStandardMaterial({ color: C.body, roughness: 0.55, map: skin }),
    belly: new THREE.MeshStandardMaterial({ color: C.belly, roughness: 0.7, map: skin }),
    stomach: new THREE.MeshStandardMaterial({ color: C.stomach, roughness: 0.6, map: skin }),
    white: new THREE.MeshStandardMaterial({ color: C.sclera, roughness: 0.25 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2 }),
    gill: new THREE.MeshStandardMaterial({ color: C.gill, roughness: 0.55 }),
    limb: null, // set below when limbs differ
  };
  MAT.limb = C.limbs
    ? new THREE.MeshStandardMaterial({ color: C.limbs, roughness: 0.55 })
    : MAT.body;
  MAT.tail = C.tailColor
    ? new THREE.MeshStandardMaterial({ color: C.tailColor, roughness: 0.55 })
    : MAT.body;

  const root = new THREE.Group(); root.name = C.name;
  const model = new THREE.Group(); model.name = C.name + 'Model';
  root.add(model);

  const add = (geo, mat, parent = model) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // legs — short, pivot at hip; feet point forward
  const legGeo = new THREE.CapsuleGeometry(0.06, 0.12, 4, 8);
  legGeo.translate(0, -0.09, 0);
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(0.10 * side, 0.26, 0); model.add(hip);
    add(legGeo, MAT.limb, hip);
    const foot = add(new THREE.SphereGeometry(0.07, 10, 8), MAT.limb, hip);
    foot.position.set(0, -0.21, 0.04); foot.scale.set(1.1, 0.5, 1.6);
    legs.push(hip);
  }

  // torso — egg-shaped, rounder at the hips
  const torso = add(new THREE.SphereGeometry(0.24, 20, 16), MAT.body);
  torso.position.y = 0.52; torso.scale.set(1.05, 1.15, 0.95);
  const belly = add(new THREE.SphereGeometry(0.185, 16, 12), MAT.stomach);
  belly.position.set(0, 0.46, 0.10); belly.scale.set(0.92, 1.02, 0.68); // white oval, like the art

  // arms — little, hang at the sides, swing when walking
  const armGeo = new THREE.CapsuleGeometry(0.048, 0.11, 4, 8);
  armGeo.translate(0, -0.085, 0);
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.235 * side, 0.645, 0.02); model.add(shoulder);
    shoulder.rotation.z = side * 0.22; // relaxed, slightly out from the body
    add(armGeo, MAT.limb, shoulder);
    const hand = add(new THREE.SphereGeometry(0.055, 10, 8), MAT.limb, shoulder);
    hand.position.y = -0.17; hand.scale.set(1, 0.8, 1.1);
    shoulder.userData.baseZ = shoulder.rotation.z;
    arms.push(shoulder);
  }

  // head — big, wide and flat, sits right on the shoulders
  const head = new THREE.Group(); head.position.set(0, 0.97, 0.02); model.add(head);
  const skull = add(new THREE.SphereGeometry(0.28, 20, 16), MAT.body, head);
  skull.scale.set(1.28, 0.82, 1.0);
  const snout = add(new THREE.SphereGeometry(0.20, 16, 12), MAT.body, head);
  snout.position.set(0, -0.075, 0.135); snout.scale.set(1.32, 0.52, 0.95);

  // eyes — white and slightly almond. 'line': heavy slit pupils slanting
  // toward the nose (Coal, Bubble). 'round': circular pupils with a colored
  // iris (Spark's bright look in the art).
  for (const side of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.10, 16, 12), MAT.white, head);
    eye.position.set(0.215 * side, 0.06, 0.165);
    eye.scale.set(1.15, 0.9, 0.8);
    if (C.eyeStyle === 'round') {
      const irisMat = new THREE.MeshStandardMaterial({ color: C.iris, roughness: 0.35 });
      const iris = add(new THREE.SphereGeometry(0.052, 12, 10), irisMat, head);
      iris.position.set(0.218 * side, 0.062, 0.245);
      const pupil = add(new THREE.SphereGeometry(0.028, 10, 8), MAT.pupil, head);
      pupil.position.set(0.222 * side, 0.063, 0.288);
    } else {
      const pupil = add(new THREE.SphereGeometry(0.05, 12, 10), MAT.pupil, head);
      pupil.position.set(0.215 * side, 0.062, 0.238);
      pupil.scale.set(1.7, 0.28, 0.55);      // horizontal line across the eye
      pupil.rotation.z = side * 0.30;         // outer end up → V-shaped, determined
    }
    if (C.brows) {
      const browMat = new THREE.MeshStandardMaterial({ color: C.brows, roughness: 0.7 });
      const brow = add(new THREE.BoxGeometry(0.17, 0.045, 0.05), browMat, head);
      brow.position.set(0.16 * side, 0.17, 0.20);
      brow.rotation.z = side * 0.32;          // inner ends down — stern
    }
    if (C.lids) { // skin-colored lids drooping over the eye tops — serene
      const lid = add(new THREE.BoxGeometry(0.17, 0.055, 0.07), MAT.body, head);
      lid.position.set(0.215 * side, 0.115, 0.19);
      lid.rotation.z = -side * 0.14;          // outer ends down — sleepy calm
    }
  }

  if (C.circlet) {
    const bandMat = new THREE.MeshStandardMaterial({ color: C.circlet.band, roughness: 0.35, metalness: 0.7 });
    const band = add(new THREE.TorusGeometry(0.295, 0.028, 8, 22), bandMat, head);
    band.position.y = 0.15;
    band.rotation.x = Math.PI / 2;
    band.scale.set(1.22, 1.0, 0.98);          // hugs the wide skull
    const gemMat = new THREE.MeshStandardMaterial({
      color: C.circlet.gem, roughness: 0.25, emissive: C.circlet.gem, emissiveIntensity: 0.5,
    });
    const gem = add(new THREE.OctahedronGeometry(0.07), gemMat, head);
    gem.position.set(0, 0.185, 0.29);
    gem.scale.set(0.8, 1.25, 0.6);
  }

  if (C.headband) { // cloth band low across the brow, snug to the skull
    const bandMat = new THREE.MeshStandardMaterial({ color: C.headband, roughness: 0.85 });
    const band = add(new THREE.TorusGeometry(0.265, 0.042, 8, 22), bandMat, head);
    band.position.y = 0.09;
    band.rotation.x = Math.PI / 2;
    band.scale.set(1.22, 1.0, 0.92);
  }

  // external gills — 3 stalks per side, flared up and out. Three styles:
  // 'spiky' cones (Coal, Storm), 'round' lobes, 'frilly' fans.
  const gills = [];
  const spikeGeo = new THREE.ConeGeometry(0.05, 0.36, 6);
  spikeGeo.translate(0, 0.18, 0);
  const makeGill = () => {
    const grp = new THREE.Group();
    if (C.gillStyle === 'round') {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.038, 0.18, 5), MAT.gill);
      stalk.position.y = 0.09;
      const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), MAT.gill);
      lobe.position.y = 0.24; lobe.scale.set(1, 0.85, 0.55);
      grp.add(stalk, lobe);
    } else if (C.gillStyle === 'frilly') {
      for (const [lean, len] of [[0, 0.36], [0.55, 0.25], [-0.55, 0.25]]) {
        const geo = new THREE.ConeGeometry(0.042, len, 5);
        geo.translate(0, len / 2, 0);
        const frond = new THREE.Mesh(geo, MAT.gill);
        frond.rotation.z = lean;
        frond.scale.set(1, 1, 0.4);
        grp.add(frond);
      }
    } else {
      const spike = new THREE.Mesh(spikeGeo, MAT.gill);
      spike.scale.set(1, 1, 0.5);
      grp.add(spike);
    }
    grp.traverse((o) => { o.castShadow = true; });
    return grp;
  };
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const g = makeGill();
      head.add(g);
      g.position.set(0.24 * side, 0.09 - i * 0.055, -0.06 - i * 0.05);
      g.rotation.set(-0.28 - i * 0.30, 0, -side * (0.88 + i * 0.20));
      g.userData.baseZ = g.rotation.z;
      gills.push(g);
    }
  }

  // tail — sways as he walks. 'fin': short fin angled down. 'curl': a long
  // tail curling into a spiral behind (Storm).
  const tail = new THREE.Group(); tail.position.set(0, 0.32, -0.17); model.add(tail);
  if (C.tailStyle === 'curl') {
    // a true tapering spiral: a tube swept from the lower back, down and
    // behind, winding inward — reads as a curled tail, never a closed ring
    const cy = -0.04, cz = -0.27; // spiral centre in tail space
    const pts = [new THREE.Vector3(0, 0.14, -0.02)]; // root at the lower back
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const th = -0.65 + t * 6.6;          // just over one turn
      const r = 0.23 * (1 - 0.72 * t);     // winds inward as it goes
      // negative sin: winds DOWNWARD from the root so the tip curls under
      pts.push(new THREE.Vector3(0, cy - Math.sin(th) * r, cz + Math.cos(th) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    add(new THREE.TubeGeometry(curve, 40, 0.05, 7, false), MAT.tail, tail);
    const tip = add(new THREE.SphereGeometry(0.05, 8, 6), MAT.tail, tail);
    tip.position.copy(pts[pts.length - 1]);
  } else {
    tail.rotation.x = 0.5; // droops toward the ground
    const tailGeo = new THREE.ConeGeometry(0.12, 0.5, 10);
    tailGeo.rotateX(-Math.PI / 2); tailGeo.translate(0, 0, -0.25);
    const tailMesh = add(tailGeo, MAT.tail, tail);
    tailMesh.scale.set(0.30, 0.85, 1.0); // thin vertical fin
  }

  // dorsal ridge down the back of the torso (axolotl fin)
  const ridge = add(new THREE.SphereGeometry(0.14, 10, 8), MAT.belly);
  ridge.position.set(0, 0.62, -0.185); ridge.scale.set(0.10, 0.85, 0.4);

  if (C.spines) { // row of spikes down the back (see the art)
    const spineMat = new THREE.MeshStandardMaterial({ color: C.spines, roughness: 0.6 });
    const spots = [[0.76, -0.14, 0.11], [0.64, -0.19, 0.13], [0.5, -0.22, 0.12], [0.36, -0.22, 0.1]];
    for (const [sy, sz, sr] of spots) {
      const sp = add(new THREE.ConeGeometry(sr * 0.55, sr * 2.4, 5), spineMat);
      sp.position.set(0, sy, sz);
      sp.rotation.x = -0.85; // sweep back
    }
  }

  if (C.rings) { // golden bands on wrists, ankles and tail (see the art)
    const ringMat = new THREE.MeshStandardMaterial({ color: C.rings, roughness: 0.35, metalness: 0.7 });
    for (const arm of arms) {
      const r = add(new THREE.TorusGeometry(0.062, 0.017, 6, 14), ringMat, arm);
      r.position.y = -0.13;
      r.rotation.x = Math.PI / 2;
    }
    for (const hip of legs) {
      const r = add(new THREE.TorusGeometry(0.078, 0.018, 6, 14), ringMat, hip);
      r.position.y = -0.17;
      r.rotation.x = Math.PI / 2;
    }
    for (const tz of [-0.12, -0.26]) { // tapering with the tail
      const r = add(new THREE.TorusGeometry(0.11 + tz * 0.12, 0.018, 6, 14), ringMat, tail);
      r.position.z = tz;
      r.scale.set(0.6, 1.05, 1);
    }
  }

  if (C.trident) { // a golden trident staff held in the right hand (Matcha)
    const tMat = new THREE.MeshStandardMaterial({ color: C.trident, roughness: 0.45, metalness: 0.35 });
    const staff = new THREE.Group();
    const parts = [
      [new THREE.CylinderGeometry(0.022, 0.028, 1.16, 7), 0, 0.05, 0],
      [new THREE.BoxGeometry(0.18, 0.034, 0.034), 0, 0.63, 0],
      [new THREE.ConeGeometry(0.028, 0.2, 6), 0, 0.74, 0],
      [new THREE.ConeGeometry(0.024, 0.15, 6), -0.078, 0.71, 0],
      [new THREE.ConeGeometry(0.024, 0.15, 6), 0.078, 0.71, 0],
    ];
    for (const [geo, px, py, pz] of parts) {
      const m = new THREE.Mesh(geo, tMat);
      m.position.set(px, py, pz);
      m.castShadow = true;
      m.userData.noRecolor = true; // statues keep the trident golden
      staff.add(m);
    }
    // held diagonally across the body — leaning outward so the prongs rise
    // clear beside the head instead of clipping through it
    staff.position.set(-0.04, 0.02, 0.09);
    staff.rotation.set(0.12, 0, 0.42);
    arms[0].add(staff);
  }

  // blob contact shadow — grounds him visually even where the sun shadow falls away
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  blob.name = 'blobShadow';
  root.add(blob); // on root, not model — ignores the walk bob

  // ---- gear (bought at the armory) ----
  const gearMats = {
    wood: new THREE.MeshStandardMaterial({ color: 0x9a7648, roughness: 0.8 }),
    iron: new THREE.MeshStandardMaterial({ color: 0xb9bec7, roughness: 0.35, metalness: 0.6 }),
    grip: new THREE.MeshStandardMaterial({ color: 0x54432f, roughness: 0.9 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x6fa053, roughness: 0.7 }),
  };
  let swordGroup = null, shellMesh = null;
  function setSword(tier) { // 0 none, 1 wooden, 2 iron
    if (swordGroup) { arms[1].remove(swordGroup); swordGroup = null; }
    if (!tier) return;
    swordGroup = new THREE.Group();
    const bladeMat = tier === 2 ? gearMats.iron : gearMats.wood;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.09), bladeMat);
    blade.position.y = 0.36; blade.castShadow = true;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 4), bladeMat);
    tip.position.y = 0.66; tip.rotation.y = Math.PI / 4; tip.castShadow = true;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.12), gearMats.grip);
    guard.position.y = 0.1;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.16, 6), gearMats.grip);
    swordGroup.add(blade, tip, guard, grip);
    swordGroup.position.set(0, -0.17, 0.04);
    swordGroup.rotation.x = Math.PI / 2.6; // held forward
    arms[1].add(swordGroup);
  }
  let bowGroup = null;
  function setBow(tier) { // shown in the left hand while the bow is active
    if (bowGroup) { arms[0].remove(bowGroup); bowGroup = null; }
    if (!tier) return;
    bowGroup = new THREE.Group();
    const arc = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.022, 6, 14, Math.PI * 1.1), gearMats.wood);
    arc.rotation.z = -Math.PI * 0.55;
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.55, 0.008), gearMats.grip);
    string.position.x = -0.03;
    bowGroup.add(arc, string);
    bowGroup.position.set(0, -0.17, 0.05);
    bowGroup.rotation.set(0, Math.PI / 2, 0); // arc faces forward
    bowGroup.traverse((o) => { o.castShadow = true; });
    arms[0].add(bowGroup);
  }
  function setShell(tier) { // 0 none, 1 leaf, 2 iron
    if (shellMesh) { model.remove(shellMesh); shellMesh = null; }
    if (!tier) return;
    shellMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.265, 16, 12, 0, Math.PI), // back half-shell
      tier === 2 ? gearMats.iron : gearMats.leaf);
    shellMesh.position.set(0, 0.53, -0.03);
    shellMesh.rotation.y = Math.PI; // opening faces forward → covers the back
    shellMesh.scale.set(1.06, 1.12, 1.0);
    shellMesh.castShadow = true;
    model.add(shellMesh);
  }

  let t = 0, atkT = 0;
  const ATK_DUR = 0.3;
  function playAttack() { atkT = ATK_DUR; }
  // airGap: metres between the feet and the ground below — keeps the blob
  // contact shadow ON the ground while the body jumps
  function animate(dt, speed, grounded, airGap = 0) {
    blob.position.y = 0.03 - airGap;
    blob.scale.setScalar(Math.max(0.55, 1 - airGap * 0.3));
    const walk = Math.min(speed / 3.2, 1.6);
    t += dt * (2.0 + speed * 3.0);

    // upright waddle: leg swings with counter-swinging arms, roll + bob
    model.rotation.z = Math.sin(t) * 0.06 * walk;
    model.rotation.x = 0.06 * walk;               // slight eager lean into travel
    model.position.y = Math.abs(Math.sin(t)) * 0.045 * walk + (grounded ? 0 : 0.06);
    const breathe = 1 + Math.sin(t * 0.35) * 0.012;
    torso.scale.set(1.05 * breathe, 1.15, 0.95 * breathe);

    head.rotation.z = -Math.sin(t) * 0.045 * walk;
    head.rotation.x = grounded ? 0 : -0.2;        // looks up a little mid-jump

    legs[0].rotation.x = Math.sin(t) * 0.75 * walk;
    legs[1].rotation.x = -Math.sin(t) * 0.75 * walk;
    arms[0].rotation.x = -Math.sin(t) * 0.55 * walk;
    arms[1].rotation.x = Math.sin(t) * 0.55 * walk;
    if (!grounded) {
      legs[0].rotation.x = legs[1].rotation.x = 0.55;   // tucked hop
      arms[0].rotation.x = arms[1].rotation.x = -0.9;   // arms up, wheee
    }

    tail.rotation.y = Math.sin(t * 0.5) * (0.12 + 0.28 * walk);
    for (let i = 0; i < gills.length; i++) {
      gills[i].rotation.z = gills[i].userData.baseZ + Math.sin(t * 0.8 + i) * 0.06;
    }

    // attack overrides the right arm: quick overhead chomp-swing + lunge
    if (atkT > 0) {
      atkT = Math.max(0, atkT - dt);
      const k = atkT / ATK_DUR;               // 1 → 0
      arms[1].rotation.x = -2.6 * Math.sin(k * Math.PI); // wind up and slash
      model.rotation.x += 0.22 * Math.sin(k * Math.PI);
      head.rotation.x += 0.3 * Math.sin(k * Math.PI);
    }
  }

  return {
    root, model, animate, playAttack, setSword, setBow, setShell,
    parts: { head, torso, arms, legs, tail },
  };
}

// Coal — the player character. Light gray body, black gills, black tail,
// determined lined eyes (default palette + the black tail override).
export function buildCoal() {
  return buildAxolotl({ tailColor: 0x141418 });
}
