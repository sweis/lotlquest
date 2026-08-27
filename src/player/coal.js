// Coal, the black axolotl — built from primitives (matches the child's-drawing
// character sheet: black body, big white eyes, frilly external gills).
// Model faces +Z. animate() drives a procedural waddle from speed.

import * as THREE from 'three';

const MAT = {
  body: new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.55 }),
  belly: new THREE.MeshStandardMaterial({ color: 0x44444f, roughness: 0.7 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.3 }),
  pupil: new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.2 }),
  gill: new THREE.MeshStandardMaterial({ color: 0x565f7d, roughness: 0.55 }),
};

const BASE_Y = 0.36; // body centre height so the feet touch y=0

export function buildCoal() {
  const root = new THREE.Group(); root.name = 'coal';
  const model = new THREE.Group(); model.name = 'coalModel';
  root.add(model);
  model.position.y = BASE_Y;

  const add = (geo, mat, parent = model) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // torso — capsule lying along Z
  const torsoGeo = new THREE.CapsuleGeometry(0.24, 0.55, 6, 14);
  torsoGeo.rotateX(Math.PI / 2);
  const torso = add(torsoGeo, MAT.body);
  torso.scale.set(1.0, 0.85, 1.0);

  // belly patch
  const bellyGeo = new THREE.CapsuleGeometry(0.19, 0.48, 5, 12);
  bellyGeo.rotateX(Math.PI / 2);
  const belly = add(bellyGeo, MAT.belly);
  belly.position.y = -0.09; belly.scale.set(1.02, 0.62, 1.0);

  // head — wide flat axolotl head, slightly proud of the torso
  const head = new THREE.Group(); head.position.set(0, 0.09, 0.52); model.add(head);
  const skull = add(new THREE.SphereGeometry(0.32, 20, 16), MAT.body, head);
  skull.scale.set(1.28, 0.76, 1.02);
  const snout = add(new THREE.SphereGeometry(0.23, 16, 12), MAT.body, head);
  snout.position.set(0, -0.06, 0.17); snout.scale.set(1.35, 0.5, 1.0);

  // eyes — big, white, on the front of the face (the drawing's defining feature)
  for (const side of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.105, 16, 12), MAT.white, head);
    eye.position.set(0.235 * side, 0.075, 0.19);
    const pupil = add(new THREE.SphereGeometry(0.055, 12, 10), MAT.pupil, head);
    pupil.position.set(0.242 * side, 0.082, 0.283); // forward-facing gaze
  }

  // external gills — 3 long frilly stalks per side, flared up and out so they
  // read in silhouette from any angle
  const gills = [];
  const gillGeo = new THREE.ConeGeometry(0.055, 0.40, 6);
  gillGeo.translate(0, 0.20, 0);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const g = add(gillGeo, MAT.gill, head);
      g.position.set(0.26 * side, 0.08 - i * 0.05, -0.08 - i * 0.06);
      g.rotation.set(-0.30 - i * 0.30, 0, -side * (0.85 + i * 0.20)); // flare OUTWARD

      g.scale.set(1, 1, 0.5); // flattened frill
      g.userData.baseZ = g.rotation.z;
      gills.push(g);
    }
  }

  // legs — short and stubby, pivot at hip for the waddle
  const legGeo = new THREE.CapsuleGeometry(0.065, 0.14, 4, 8);
  legGeo.translate(0, -0.08, 0);
  const legs = [];
  const legPos = [
    [0.21, 0.28], [-0.21, 0.28],   // front L/R
    [0.19, -0.24], [-0.19, -0.24], // rear L/R
  ];
  for (const [x, z] of legPos) {
    const hip = new THREE.Group(); hip.position.set(x, -0.12, z); model.add(hip);
    add(legGeo, MAT.body, hip);
    const foot = add(new THREE.SphereGeometry(0.07, 10, 8), MAT.body, hip);
    foot.position.y = -0.20; foot.scale.set(1.15, 0.5, 1.35);
    legs.push(hip);
  }

  // tail — modest vertical fin, pivots at the body's rear
  const tail = new THREE.Group(); tail.position.set(0, 0.02, -0.42); model.add(tail);
  const tailGeo = new THREE.ConeGeometry(0.15, 0.48, 10);
  tailGeo.rotateX(-Math.PI / 2); tailGeo.translate(0, 0, -0.24);
  const tailMesh = add(tailGeo, MAT.body, tail);
  tailMesh.scale.set(0.28, 0.8, 1.0);

  // dorsal ridge along the back → tail (axolotl fin)
  const ridge = add(new THREE.SphereGeometry(0.15, 10, 8), MAT.belly);
  ridge.position.set(0, 0.155, -0.22); ridge.scale.set(0.10, 0.45, 1.7);

  let t = 0;
  function animate(dt, speed, grounded) {
    const walk = Math.min(speed / 3.2, 1.6);
    t += dt * (2.2 + speed * 2.6);

    // waddle: roll + bob scale with speed; gentle breath at idle
    model.rotation.z = Math.sin(t) * 0.085 * walk;
    model.rotation.x = Math.cos(t * 2) * 0.03 * walk;
    model.position.y = BASE_Y + Math.abs(Math.sin(t)) * 0.05 * walk + (grounded ? 0 : 0.06);
    const breathe = 1 + Math.sin(t * 0.35) * 0.012;
    torso.scale.set(1.0 * breathe, 0.85, 1.0);

    head.rotation.z = -Math.sin(t) * 0.05 * walk;
    head.rotation.x = grounded ? 0 : -0.25;

    legs[0].rotation.x = Math.sin(t) * 0.7 * walk;
    legs[1].rotation.x = -Math.sin(t) * 0.7 * walk;
    legs[2].rotation.x = -Math.sin(t) * 0.7 * walk;
    legs[3].rotation.x = Math.sin(t) * 0.7 * walk;
    if (!grounded) for (const l of legs) l.rotation.x = 0.5; // tucked hop

    tail.rotation.y = Math.sin(t * 0.5) * (0.12 + 0.28 * walk);
    for (let i = 0; i < gills.length; i++) {
      gills[i].rotation.z = gills[i].userData.baseZ + Math.sin(t * 0.8 + i) * 0.06;
    }
  }

  return { root, model, animate };
}
