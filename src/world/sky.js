// Lighting + analytic gradient sky with fog matched to the horizon.
// setTimeOfDay(h) moves the sun; default is late afternoon, never noon.

import * as THREE from 'three';

const HORIZON = new THREE.Color();
const ZENITH = new THREE.Color();

export function buildSky(scene) {
  const hemi = new THREE.HemisphereLight(0xbdd5e8, 0x4a5a43, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffe8c8, 3.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  // fitted to a moving box around the player (updateShadowTarget), not the whole island
  const sc = sun.shadow.camera;
  sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55;
  sc.near = 10; sc.far = 320;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  const skyGeo = new THREE.SphereGeometry(1900, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      horizonColor: { value: new THREE.Color(0xd8e2ea) },
      zenithColor: { value: new THREE.Color(0x77a8d4) },
      sunDir: { value: new THREE.Vector3(0, 1, 0) },
      sunColor: { value: new THREE.Color(0xfff1d6) },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 horizonColor, zenithColor, sunDir, sunColor;
      void main() {
        float t = smoothstep(-0.02, 0.42, vDir.y);
        vec3 col = mix(horizonColor, zenithColor, t);
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * (pow(s, 350.0) * 1.2 + pow(s, 24.0) * 0.18); // disc + glow
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.name = 'sky';
  scene.add(skyDome);

  scene.fog = new THREE.Fog(0xd8e2ea, 140, 900);

  const api = {
    hemi, sun, skyDome,
    timeOfDay: 16.5,
    setTimeOfDay(h) {
      api.timeOfDay = h;
      // hour → sun elevation (peaks at 13h), fixed south-west azimuth sweep
      const dayT = THREE.MathUtils.clamp((h - 6) / 14, 0, 1);   // 6:00 → 20:00
      const elev = Math.sin(dayT * Math.PI) * 1.05;              // radians-ish
      const azim = THREE.MathUtils.lerp(-2.3, -0.6, dayT);
      const dir = new THREE.Vector3(
        Math.cos(elev) * Math.sin(azim),
        Math.sin(elev),
        Math.cos(elev) * Math.cos(azim),
      );
      sun.position.copy(dir).multiplyScalar(180);
      skyMat.uniforms.sunDir.value.copy(dir);

      const low = 1 - THREE.MathUtils.clamp(Math.sin(dayT * Math.PI) * 1.6, 0, 1); // 1 near dawn/dusk
      sun.color.setHSL(0.09, 0.55, THREE.MathUtils.lerp(0.72, 0.55, low));
      sun.intensity = THREE.MathUtils.lerp(3.4, 1.6, low);
      hemi.intensity = THREE.MathUtils.lerp(1.0, 0.5, low); // lifts shaded walls out of black
      HORIZON.setHSL(0.075, THREE.MathUtils.lerp(0.12, 0.42, low), THREE.MathUtils.lerp(0.86, 0.72, low));
      ZENITH.setHSL(0.58, THREE.MathUtils.lerp(0.45, 0.30, low), THREE.MathUtils.lerp(0.62, 0.45, low));
      skyMat.uniforms.horizonColor.value.copy(HORIZON);
      skyMat.uniforms.zenithColor.value.copy(ZENITH);
      skyMat.uniforms.sunColor.value.copy(sun.color);
      if (api.sceneFog) { api.sceneFog.color.copy(HORIZON); }
    },
    sceneFog: scene.fog,
    // keep the fitted shadow frustum centred on the player; snap to texels to stop shimmer
    updateShadowTarget(p) {
      const dir = sun.position.clone().normalize();
      const texel = 110 / 2048 * 8;
      const tx = Math.round(p.x / texel) * texel;
      const tz = Math.round(p.z / texel) * texel;
      sun.target.position.set(tx, 0, tz);
      sun.position.copy(dir).multiplyScalar(180).add(sun.target.position);
      skyDome.position.set(p.x, 0, p.z); // dome follows so it never clips
    },
  };
  api.setTimeOfDay(api.timeOfDay);
  return api;
}
