// Coal, the black axolotl — upright anthropomorphic biped, built from
// primitives (matches the child's-drawing character sheet: black body, big
// white eyes, frilly external gills, standing on two legs).
// Model faces +Z, feet at y=0. animate() drives the walk from speed.

import * as THREE from 'three';

const MAT = {
  body: new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.55 }),
  belly: new THREE.MeshStandardMaterial({ color: 0x44444f, roughness: 0.7 }),      // dark — ridge/fin
  stomach: new THREE.MeshStandardMaterial({ color: 0xe9eaee, roughness: 0.6 }),   // white patch (see art)
  white: new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.3 }),
  pupil: new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2 }),
  gill: new THREE.MeshStandardMaterial({ color: 0x565f7d, roughness: 0.55 }),
};

export function buildCoal() {
  const root = new THREE.Group(); root.name = 'coal';
  const model = new THREE.Group(); model.name = 'coalModel';
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
    add(legGeo, MAT.body, hip);
    const foot = add(new THREE.SphereGeometry(0.07, 10, 8), MAT.body, hip);
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
    add(armGeo, MAT.body, shoulder);
    const hand = add(new THREE.SphereGeometry(0.055, 10, 8), MAT.body, shoulder);
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

  // eyes — white, slightly almond, with a heavy LINE pupil slanting toward the
  // nose (the art's determined look), not circles
  for (const side of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.10, 16, 12), MAT.white, head);
    eye.position.set(0.215 * side, 0.06, 0.165);
    eye.scale.set(1.15, 0.9, 0.8);
    const pupil = add(new THREE.SphereGeometry(0.05, 12, 10), MAT.pupil, head);
    pupil.position.set(0.215 * side, 0.062, 0.238);
    pupil.scale.set(1.7, 0.28, 0.55);        // horizontal line across the eye
    pupil.rotation.z = side * 0.30;           // outer end up → V-shaped, determined
  }

  // external gills — 3 long frilly stalks per side, flared up and out so they
  // read in silhouette from any angle (negative z-sign = outward)
  const gills = [];
  const gillGeo = new THREE.ConeGeometry(0.05, 0.36, 6);
  gillGeo.translate(0, 0.18, 0);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const g = add(gillGeo, MAT.gill, head);
      g.position.set(0.24 * side, 0.09 - i * 0.055, -0.06 - i * 0.05);
      g.rotation.set(-0.28 - i * 0.30, 0, -side * (0.88 + i * 0.20));
      g.scale.set(1, 1, 0.5); // flattened frill
      g.userData.baseZ = g.rotation.z;
      gills.push(g);
    }
  }

  // tail — fin angled down behind, sways as he walks
  const tail = new THREE.Group(); tail.position.set(0, 0.32, -0.17); model.add(tail);
  tail.rotation.x = 0.5; // droops toward the ground
  const tailGeo = new THREE.ConeGeometry(0.12, 0.5, 10);
  tailGeo.rotateX(-Math.PI / 2); tailGeo.translate(0, 0, -0.25);
  const tailMesh = add(tailGeo, MAT.body, tail);
  tailMesh.scale.set(0.30, 0.85, 1.0); // thin vertical fin

  // dorsal ridge down the back of the torso (axolotl fin)
  const ridge = add(new THREE.SphereGeometry(0.14, 10, 8), MAT.belly);
  ridge.position.set(0, 0.62, -0.185); ridge.scale.set(0.10, 0.85, 0.4);

  // blob contact shadow — grounds him visually even where the sun shadow falls away
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 24),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.03;
  blob.name = 'blobShadow';
  root.add(blob); // on root, not model — ignores the walk bob

  let t = 0;
  function animate(dt, speed, grounded) {
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
  }

  return { root, model, animate };
}
