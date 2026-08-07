/* The Museum of Technophobia — shared diorama engine.
   Every scene gets the same bones: renderer, void, lights-out stage,
   orbit controls, VR plumbing, and click routing. Scenes supply the
   objects and the verbs. */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export const reducedMotion =
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createDiorama(opts) {
  const host = document.getElementById("stage");
  const veil = document.getElementById("veil");
  const hintEl = document.getElementById("hint");
  const cardEl = document.getElementById("card");
  const vrBtn = document.getElementById("vr-btn");

  /* ---------- renderer ---------- */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true });
  } catch (err) {
    if (veil) veil.innerHTML =
      "<span>This diorama requires WebGL, which your browser has declined " +
      "to provide. The museum apologizes. The irony is noted.</span>";
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.xr.enabled = true;
  host.appendChild(renderer.domElement);

  /* ---------- scene & camera ---------- */
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0a09);
  scene.fog = new THREE.Fog(0x0b0a09, 7, 16);

  const cam = opts.camera || {};
  const camera = new THREE.PerspectiveCamera(
    cam.fov || 50,
    window.innerWidth / window.innerHeight,
    0.05,
    60
  );
  camera.position.fromArray(cam.position || [3, 2, 4]);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.fromArray(cam.target || [0, 1, 0]);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.enablePan = false;
  controls.minDistance = cam.minDistance ?? 1.2;
  controls.maxDistance = cam.maxDistance ?? 8;
  controls.minPolarAngle = cam.minPolar ?? 0.15;
  controls.maxPolarAngle = cam.maxPolar ?? 1.52;
  if (cam.minAzimuth !== undefined) controls.minAzimuthAngle = cam.minAzimuth;
  if (cam.maxAzimuth !== undefined) controls.maxAzimuthAngle = cam.maxAzimuth;
  controls.update();

  /* ---------- click routing (desktop, touch, and VR trigger) ---------- */
  const interactives = [];
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function makeInteractive(object, onClick) {
    interactives.push(object);
    object.userData.onClick = onClick;
  }

  function findHandler(hit) {
    let node = hit;
    while (node) {
      if (node.userData && node.userData.onClick) return node;
      node = node.parent;
    }
    return null;
  }

  function castAndFire() {
    const hits = raycaster.intersectObjects(interactives, true);
    for (const h of hits) {
      const target = findHandler(h.object);
      if (target) {
        target.userData.onClick(h);
        return true;
      }
    }
    return false;
  }

  let downX = 0, downY = 0;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    downX = e.clientX; downY = e.clientY;
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    /* a click, not the tail end of an orbit drag */
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 8) return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    castAndFire();
  });

  /* VR controllers: trigger = click, with a visible ray */
  const tempMatrix = new THREE.Matrix4();
  function onSelect(event) {
    const c = event.target;
    tempMatrix.identity().extractRotation(c.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(c.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
    castAndFire();
  }
  for (let i = 0; i < 2; i++) {
    const controller = renderer.xr.getController(i);
    controller.addEventListener("select", onSelect);
    const rayGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const ray = new THREE.Line(
      rayGeo,
      new THREE.LineBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.4 })
    );
    ray.scale.z = 3;
    controller.add(ray);
    scene.add(controller);
  }

  /* ---------- HUD helpers ---------- */
  function setHint(text) {
    if (hintEl) hintEl.textContent = text;
  }

  let cardTimer = null;
  function showCard(text, ms) {
    if (!cardEl) return;
    cardEl.textContent = text;
    cardEl.classList.add("show");
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => cardEl.classList.remove("show"), ms || 3500);
  }

  /* ---------- VR entry ---------- */
  let xrSession = null;
  if (vrBtn && navigator.xr && navigator.xr.isSessionSupported) {
    navigator.xr.isSessionSupported("immersive-vr").then((ok) => {
      if (!ok) return;
      vrBtn.hidden = false;
      vrBtn.addEventListener("click", async () => {
        if (xrSession) { xrSession.end(); return; }
        try {
          xrSession = await navigator.xr.requestSession("immersive-vr", {
            optionalFeatures: ["local-floor", "bounded-floor", "hand-tracking"],
          });
          renderer.xr.setReferenceSpaceType("local-floor");
          await renderer.xr.setSession(xrSession);
          vrBtn.textContent = "Exit VR";
          xrSession.addEventListener("end", () => {
            xrSession = null;
            vrBtn.textContent = "Enter VR";
          });
        } catch (err) {
          vrBtn.textContent = "VR declined";
        }
      });
    }).catch(() => {});
  }

  /* ---------- build the scene (may be async: GLB loading) ---------- */
  const ctx = {
    scene, camera, renderer, controls,
    makeInteractive, setHint, showCard, reducedMotion,
  };
  let built = {};
  let ready = false;
  Promise.resolve(opts.build(ctx))
    .then((b) => { built = b || {}; ready = true; })
    .catch((err) => {
      console.error("Diorama build failed:", err);
      if (veil) veil.innerHTML =
        "<span>The excavation collapsed. The museum's engineers have been " +
        "notified, once they finish panicking.</span>";
    });

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();
  let veilUp = true;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    controls.update();
    if (ready && built.tick) built.tick(dt, clock.elapsedTime);
    renderer.render(scene, camera);
    if (ready && veilUp) {
      veilUp = false;
      if (veil) veil.classList.add("lifted");
    }
  });

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return ctx;
}
