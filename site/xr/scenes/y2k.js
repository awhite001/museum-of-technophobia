/* Diorama XIII — The Y2K Bunker.
   11:59 PM, December 31, 1999. Concrete, canned goods, one television.
   The visitor resumes time; midnight arrives; nothing happens.

   ART PIPELINE: on load this scene looks for ./y2k.glb (a Blender-refined
   set). If found, interactions bind to nodes BY NAME — see NOTES.md for the
   naming contract. If not found, the procedural set below is built instead.
   Either way, the code owns the lights, the CRT screen, and the verbs. */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createDiorama, createEnvironment, reducedMotion } from "../diorama.js";
import * as sfx from "../audio.js";

/* ---------- palette ---------- */
const M = {
  concrete:  new THREE.MeshStandardMaterial({ color: 0x4d4944, roughness: 0.95 }),
  concreteD: new THREE.MeshStandardMaterial({ color: 0x3b3733, roughness: 0.97 }),
  steel:     new THREE.MeshStandardMaterial({ color: 0x5c646c, roughness: 0.45, metalness: 0.65 }),
  steelDark: new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.5, metalness: 0.6 }),
  brass:     new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.85 }),
  wood:      new THREE.MeshStandardMaterial({ color: 0x6e5137, roughness: 0.8 }),
  plastic:   new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 0.6 }),
  crtShell:  new THREE.MeshStandardMaterial({ color: 0x9b9484, roughness: 0.55 }),
  paper:     new THREE.MeshStandardMaterial({ color: 0xc9c0ab, roughness: 0.9 }),
  silver:    new THREE.MeshStandardMaterial({ color: 0xb8bcc0, roughness: 0.3, metalness: 0.8 }),
  jug:       new THREE.MeshStandardMaterial({ color: 0x5d6d75, roughness: 0.4 }),
  black:     new THREE.MeshStandardMaterial({ color: 0x14120f, roughness: 0.7 }),
};
const CAN_LABELS = [0x8f3b2e, 0x6b6b3a, 0xa8842c, 0xb9ac93, 0x4e6470];

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { tex: t, canvas: c, g, draw };
}

/* ============================================================
   Procedural set — the fallback when no y2k.glb exists.
   Every interactable carries its contract name (see NOTES.md).
   ============================================================ */
function buildProcedural(root) {
  const extraTex = [];

  /* plinth */
  const plinth = box(4.4, 0.14, 4.0, M.concreteD);
  plinth.name = "plinth";
  plinth.position.set(0, -0.07, -0.7);
  root.add(plinth);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(4.44, 0.02, 4.04), M.brass);
  trim.name = "plinth_trim";
  trim.position.set(0, -0.135, -0.7);
  root.add(trim);

  const plaqueTex = canvasTexture(512, 96, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#d4af37");
    grad.addColorStop(1, "#8f7620");
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#241c08";
    g.font = "600 30px 'IBM Plex Mono', monospace";
    g.textAlign = "center";
    g.fillText("EXHIBIT XIII — THE BUNKER", w / 2, 42);
    g.font = "22px 'IBM Plex Mono', monospace";
    g.fillText("DECEMBER 31, 1999", w / 2, 74);
  });
  extraTex.push(plaqueTex);
  const plaque = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.16),
    new THREE.MeshStandardMaterial({ map: plaqueTex.tex, roughness: 0.4, metalness: 0.6 })
  );
  plaque.name = "plinth_plaque";
  plaque.position.set(0, 0.02, 1.302);
  plaque.rotation.x = -0.5;
  root.add(plaque);

  /* room shell */
  const floor = box(3.4, 0.08, 3.0, M.concreteD);
  floor.name = "room_floor";
  floor.position.set(0, 0.04, -0.7);
  root.add(floor);
  const backWall = box(3.64, 2.35, 0.12, M.concrete);
  backWall.name = "wall_back";
  backWall.position.set(0, 1.175, -2.26);
  root.add(backWall);
  const leftWall = box(0.12, 2.35, 3.16, M.concrete);
  leftWall.name = "wall_left";
  leftWall.position.set(-1.76, 1.175, -0.74);
  root.add(leftWall);
  const rightWall = box(0.12, 2.35, 3.16, M.concrete);
  rightWall.name = "wall_right";
  rightWall.position.set(1.76, 1.175, -0.74);
  root.add(rightWall);
  const ceiling = box(3.64, 0.12, 3.16, M.concreteD);
  ceiling.name = "ceiling";
  ceiling.position.set(0, 2.41, -0.74);
  root.add(ceiling);

  /* bunker door */
  const door = new THREE.Group();
  door.name = "door";
  door.position.set(-1.69, 1.15, -0.9);
  const doorDisc = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 0.09, 32), M.steelDark
  );
  doorDisc.rotation.z = Math.PI / 2;
  doorDisc.castShadow = true;
  door.add(doorDisc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 12, 40), M.steel);
  rim.rotation.y = Math.PI / 2;
  door.add(rim);
  const wheel = new THREE.Group();
  wheel.name = "door_wheel";
  wheel.position.x = 0.09;
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 10, 32), M.steel);
  wheelRing.rotation.y = Math.PI / 2;
  wheel.add(wheelRing);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 8), M.steel);
    spoke.rotation.x = (i * Math.PI) / 3;
    wheel.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.07, 12), M.steel);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  door.add(wheel);
  root.add(door);

  /* shelving + cans */
  const shelf = new THREE.Group();
  shelf.name = "shelf";
  shelf.position.set(-0.55, 0.08, -2.0);
  const SHELF_W = 1.5, SHELF_D = 0.42;
  [0.1, 0.6, 1.1, 1.6].forEach((y) => {
    const board = box(SHELF_W, 0.04, SHELF_D, M.steelDark);
    board.position.y = y;
    shelf.add(board);
  });
  [[-SHELF_W / 2, -SHELF_D / 2], [SHELF_W / 2, -SHELF_D / 2],
   [-SHELF_W / 2, SHELF_D / 2], [SHELF_W / 2, SHELF_D / 2]].forEach(([x, z]) => {
    const post = box(0.04, 1.8, 0.04, M.steelDark);
    post.position.set(x, 0.9, z);
    shelf.add(post);
  });
  root.add(shelf);

  let canCount = 0;
  function addCan(x, y, z, lying) {
    const label = CAN_LABELS[Math.floor(Math.random() * CAN_LABELS.length)];
    const side = new THREE.MeshStandardMaterial({ color: label, roughness: 0.7 });
    const can = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.11, 18),
      [side, M.silver, M.silver]
    );
    can.castShadow = true;
    can.receiveShadow = true;
    const holder = new THREE.Group();
    holder.name = "can_" + String(++canCount).padStart(2, "0");
    holder.position.set(x, y, z);
    if (lying) can.rotation.z = Math.PI / 2;
    can.rotation.y = Math.random() * Math.PI;
    holder.add(can);
    shelf.add(holder);
  }
  for (let i = 0; i < 7; i++) addCan(-0.62 + i * 0.145, 0.675, -0.07);
  for (let i = 0; i < 7; i++) addCan(-0.62 + i * 0.145, 0.675, 0.09);
  for (let i = 0; i < 6; i++) addCan(-0.55 + i * 0.15, 1.175, 0.0);
  addCan(0.52, 1.165, 0.1, true);
  addCan(0.6, 0.175, 0.05);
  addCan(0.45, 0.175, -0.08);

  /* radio */
  const radio = new THREE.Group();
  radio.name = "radio";
  radio.position.set(-0.25, 1.8, -2.0);
  const radioBody = box(0.34, 0.19, 0.13, M.wood);
  radio.add(radioBody);
  const grille = new THREE.Mesh(new THREE.CircleGeometry(0.06, 20), M.black);
  grille.position.set(-0.07, 0, 0.066);
  radio.add(grille);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16), M.brass);
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.09, 0, 0.066);
  radio.add(dial);
  root.add(radio);

  /* desk */
  const desk = new THREE.Group();
  desk.name = "desk";
  desk.position.set(1.3, 0.08, -0.75);
  const deskTop = box(0.6, 0.05, 1.15, M.wood);
  deskTop.position.y = 0.76;
  desk.add(deskTop);
  [[-0.26, -0.52], [0.26, -0.52], [-0.26, 0.52], [0.26, 0.52]].forEach(([x, z]) => {
    const leg = box(0.05, 0.76, 0.05, M.steelDark);
    leg.position.set(x, 0.38, z);
    desk.add(leg);
  });
  root.add(desk);

  /* CRT (screen material is assigned by the wiring pass) */
  const crt = new THREE.Group();
  crt.name = "crt";
  crt.position.set(1.28, 1.065, -0.75);
  crt.rotation.y = -Math.PI / 2 + 0.55;
  const crtBody = box(0.5, 0.4, 0.44, M.crtShell);
  crt.add(crtBody);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.38, 0.29),
    new THREE.MeshBasicMaterial({ color: 0x051205 })
  );
  screen.name = "crt_screen";
  screen.position.set(0, 0.015, 0.221);
  crt.add(screen);
  const knob1 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 12), M.black);
  knob1.rotation.x = Math.PI / 2;
  knob1.position.set(0.16, -0.155, 0.221);
  crt.add(knob1);
  const knob2 = knob1.clone();
  knob2.position.x = 0.11;
  crt.add(knob2);
  root.add(crt);

  /* flashlight + batteries */
  const torch = new THREE.Group();
  torch.name = "flashlight";
  torch.position.set(1.34, 0.905, -0.28);
  torch.rotation.y = 0.8;
  const torchBody = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.16, 14), M.steel);
  torchBody.rotation.z = Math.PI / 2;
  torch.add(torchBody);
  const torchHead = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.028, 0.05, 14), M.steelDark);
  torchHead.rotation.z = Math.PI / 2;
  torchHead.position.x = 0.095;
  torch.add(torchHead);
  root.add(torch);
  for (let i = 0; i < 2; i++) {
    const batt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.05, 10), M.plastic);
    batt.rotation.z = Math.PI / 2;
    batt.position.set(1.42, 0.885, -0.14 + i * 0.045);
    batt.castShadow = true;
    root.add(batt);
  }

  /* water jugs */
  [[-1.35, -1.35, "jug_1"], [-1.22, -0.9, "jug_2"]].forEach(([x, z, name]) => {
    const jugMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.4, 18), M.jug);
    jugMesh.name = name;
    jugMesh.position.set(x, 0.28, z);
    jugMesh.castShadow = true;
    jugMesh.receiveShadow = true;
    root.add(jugMesh);
  });

  /* newspapers */
  const newsTex = canvasTexture(256, 180, (g, w, h) => {
    g.fillStyle = "#cfc6b0";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#1c1a16";
    g.font = "900 34px Georgia, serif";
    g.textAlign = "center";
    g.fillText("MILLENNIUM BUG", w / 2, 44);
    g.font = "italic 17px Georgia, serif";
    g.fillText("World holds its breath", w / 2, 70);
    g.fillStyle = "#6f695c";
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 2; col++) {
        g.fillRect(18 + col * 116, 88 + row * 16, 104, 7);
      }
    }
  });
  extraTex.push(newsTex);
  const papers = new THREE.Group();
  papers.name = "newspapers";
  papers.position.set(-1.05, 0.08, 0.15);
  for (let i = 0; i < 4; i++) {
    const sheet = box(0.32, 0.018, 0.45, M.paper);
    sheet.position.y = 0.01 + i * 0.019;
    sheet.rotation.y = (Math.random() - 0.5) * 0.4;
    papers.add(sheet);
    if (i === 3) {
      const front = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.43),
        new THREE.MeshStandardMaterial({ map: newsTex.tex, roughness: 0.9 })
      );
      front.rotation.x = -Math.PI / 2;
      front.rotation.z = sheet.rotation.y;
      front.position.set(0, 0.086, 0);
      papers.add(front);
    }
  }
  root.add(papers);

  /* calendar */
  const calTex = canvasTexture(256, 320, (g, w, h) => {
    g.fillStyle = "#d8cfba";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#8f3b2e";
    g.fillRect(0, 0, w, 58);
    g.fillStyle = "#f0e9d8";
    g.font = "600 26px Georgia, serif";
    g.textAlign = "center";
    g.fillText("DECEMBER", w / 2, 28);
    g.fillText("1999", w / 2, 52);
    g.strokeStyle = "#8a8171";
    g.fillStyle = "#3a362e";
    g.font = "16px Georgia, serif";
    let day = 1;
    for (let r = 0; r < 5 && day <= 31; r++) {
      for (let c = 0; c < 7 && day <= 31; c++) {
        const x = 12 + c * 33, y = 84 + r * 46;
        g.strokeRect(x, y, 30, 40);
        g.fillText(String(day), x + 15, y + 26);
        if (day === 31) {
          g.strokeStyle = "#a83226";
          g.lineWidth = 3;
          g.beginPath();
          g.arc(x + 15, y + 20, 16, 0, Math.PI * 2);
          g.stroke();
          g.lineWidth = 1;
          g.strokeStyle = "#8a8171";
        }
        day++;
      }
    }
  });
  extraTex.push(calTex);
  const calendar = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.52),
    new THREE.MeshStandardMaterial({ map: calTex.tex, roughness: 0.9 })
  );
  calendar.name = "poster_calendar";
  calendar.position.set(0.75, 1.55, -2.19);
  root.add(calendar);

  /* checklist poster */
  const posterTex = canvasTexture(256, 320, (g, w, h) => {
    g.fillStyle = "#c9bfa6";
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#1c1a16";
    g.font = "700 24px 'IBM Plex Mono', monospace";
    g.textAlign = "center";
    g.fillText("Y2K READINESS", w / 2, 40);
    g.textAlign = "left";
    g.font = "17px 'IBM Plex Mono', monospace";
    const items = [
      ["WATER", true], ["CANNED FOOD", true], ["BATTERIES", true],
      ["CASH", true], ["RADIO", true], ["REMAIN CALM", false],
    ];
    items.forEach(([label, done], i) => {
      const y = 86 + i * 38;
      g.strokeStyle = "#1c1a16";
      g.lineWidth = 2;
      g.strokeRect(20, y - 16, 20, 20);
      if (done) {
        g.beginPath();
        g.moveTo(24, y - 6);
        g.lineTo(30, y);
        g.lineTo(40, y - 14);
        g.stroke();
      }
      g.fillText(label, 52, y);
    });
  });
  extraTex.push(posterTex);
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.58),
    new THREE.MeshStandardMaterial({ map: posterTex.tex, roughness: 0.9 })
  );
  poster.name = "poster_checklist";
  poster.rotation.y = -Math.PI / 2;
  poster.position.set(1.69, 1.6, -1.35);
  root.add(poster);

  /* hanging lamp — pivot at the ceiling mount so it can sway */
  const lamp = new THREE.Group();
  lamp.name = "lamp";
  lamp.position.set(0, 2.35, -0.55);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 6), M.black);
  cord.position.y = -0.25;
  lamp.add(cord);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.1, 20, 1, true), M.steelDark);
  shade.name = "lamp_shade";
  shade.position.y = -0.5;
  lamp.add(shade);
  const bulb = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 12, 10),
    new THREE.MeshStandardMaterial({
      color: 0xfff2d0, emissive: 0xffd9a0, emissiveIntensity: 2.4,
    })
  );
  bulb.name = "lamp_bulb";
  bulb.position.y = -0.56;
  lamp.add(bulb);
  root.add(lamp);

  /* redraw procedural textures once webfonts land */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => {
      extraTex.forEach((t) => {
        t.draw(t.g, t.canvas.width, t.canvas.height);
        t.tex.needsUpdate = true;
      });
    });
  }
}

/* ============================================================
   Scene
   ============================================================ */
createDiorama({
  camera: {
    position: [1.2, 1.9, 4.0],
    target: [0, 1.0, -0.7],
    minDistance: 1.0,
    maxDistance: 7.5,
    minAzimuth: -1.0,
    maxAzimuth: 1.0,
    minPolar: 0.2,
    maxPolar: 1.5,
  },

  async build(ctx) {
    const { scene, makeInteractive, setHint, showCard } = ctx;
    scene.fog = new THREE.Fog(0x0b0a09, 8, 20);

    const root = new THREE.Group();
    root.name = "bunker_root";
    scene.add(root);

    /* ---------- load the Blender set if one exists ----------
       (resolved against this module, so the GLB lives here in xr/scenes/) */
    const GLB_URL = new URL("./y2k.glb", import.meta.url).href;
    let usedGLB = false;
    try {
      const probe = await fetch(GLB_URL, { method: "HEAD" });
      if (probe.ok) {
        const gltf = await new GLTFLoader().loadAsync(GLB_URL);
        const doomed = [];
        gltf.scene.traverse((o) => {
          if (o.isLight || o.isCamera) doomed.push(o); /* code owns the lights */
          if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; }
        });
        doomed.forEach((o) => o.parent && o.parent.remove(o));
        root.add(gltf.scene);
        usedGLB = true;
        console.info("Bunker: loaded y2k.glb (Blender set).");
      }
    } catch (err) {
      console.warn("Bunker: y2k.glb unusable, falling back to procedural set.", err);
    }
    if (!usedGLB) buildProcedural(root);

    const find = (name) => root.getObjectByName(name) || null;

    /* ---------- house lights (always code-owned) ---------- */
    const hemi = new THREE.HemisphereLight(0x2a2a33, 0x0b0a09, 0.32);
    scene.add(hemi);
    const fill = new THREE.SpotLight(0x9fb4c8, 26, 0, 0.55, 0.7, 2);
    fill.position.set(2.4, 3.4, 4.6);
    fill.target.position.set(0, 0.9, -0.8);
    scene.add(fill);
    scene.add(fill.target);

    /* soft indirect light: lifts the black side of everything, and gives a
       baked occlusion map something to actually occlude */
    const museumEnv = createEnvironment(ctx.renderer, {
      top: "#4a4336", mid: "#2b2721", bottom: "#12100e",
    });
    scene.environment = museumEnv;
    scene.environmentIntensity = 0.4;

    /* bounce off the concrete floor — cheap stand-in for radiosity, and the
       single biggest cure for shadows that read as black holes */
    const bounce = new THREE.PointLight(0xffc287, 5, 5, 2);
    bounce.position.set(0, 0.3, -0.5);
    scene.add(bounce);

    const lamp = find("lamp");
    const bulb = find("lamp_bulb");
    const bulbLight = new THREE.PointLight(0xffd9a4, 32, 0, 2);
    bulbLight.castShadow = true;
    bulbLight.shadow.mapSize.set(1024, 1024);
    bulbLight.shadow.bias = -0.004;
    if (bulb) {
      bulb.add(bulbLight);
      bulbLight.position.set(0, -0.02, 0);
    } else if (lamp) {
      lamp.add(bulbLight);
      bulbLight.position.set(0, -0.58, 0);
    } else {
      bulbLight.position.set(0, 1.77, -0.55);
      root.add(bulbLight);
    }

    const crt = find("crt");
    const crtGlow = new THREE.PointLight(0x86ffa2, 1.6, 1.6, 2);
    if (crt) {
      crt.add(crtGlow);
      crtGlow.position.set(0, 0.1, 0.5);
    }

    /* ---------- clock state (before the CRT texture reads it) ---------- */
    const state = {
      mode: "idle",        /* idle | counting | blackout | after */
      countdown: 15,       /* seconds to midnight from 23:59:45 */
      afterClock: 0,
      blackoutT: 0,
      blink: 0,
      redrawAcc: 0,
    };
    let hum = null;

    function fmtCountdown() {
      const s = Math.max(1, Math.ceil(state.countdown));
      return "23:59:" + String(60 - s).padStart(2, "0");
    }

    function fmtAfter() {
      const s = Math.floor(state.afterClock);
      const m = Math.floor(s / 60);
      return "00:" + String(m).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }

    function drawCRT(g, w, h) {
      g.fillStyle = "#051205";
      g.fillRect(0, 0, w, h);
      if (state.mode === "blackout") return;

      const green = "#7dffa0";
      const dim = "#3f8f56";
      g.textAlign = "left";

      if (state.mode === "idle") {
        g.fillStyle = dim;
        g.font = "22px 'IBM Plex Mono', monospace";
        g.fillText("CIVIL DEFENSE // SHELTER TERM.", 28, 52);
        g.fillText("--------------------------------", 28, 80);
        g.fillStyle = green;
        g.font = "26px 'IBM Plex Mono', monospace";
        g.fillText("DATE: 31 DEC 1999", 28, 130);
        g.fillText("TIME: 23:59:45", 28, 168);
        g.fillStyle = dim;
        g.fillText("CLOCK: [ HOLD ]", 28, 206);
        if (state.blink < 0.6) {
          g.fillStyle = green;
          g.font = "24px 'IBM Plex Mono', monospace";
          g.fillText("> TOUCH SCREEN TO", 28, 290);
          g.fillText("  RESUME TIME", 28, 322);
        }
      } else if (state.mode === "counting") {
        g.fillStyle = dim;
        g.font = "20px 'IBM Plex Mono', monospace";
        g.fillText("CIVIL DEFENSE // MONITORING", 28, 48);
        g.fillStyle = green;
        g.font = "700 72px 'IBM Plex Mono', monospace";
        g.textAlign = "center";
        g.fillText(fmtCountdown(), w / 2, 200);
        g.font = "22px 'IBM Plex Mono', monospace";
        g.fillStyle = state.countdown < 6 && state.blink < 0.5 ? "#ffd24a" : dim;
        g.fillText("ROLLOVER IMMINENT", w / 2, 268);
        g.fillStyle = green;
        const total = 24;
        const gone = Math.round((1 - state.countdown / 15) * total);
        let bar = "";
        for (let i = 0; i < total; i++) bar += i < gone ? "#" : ".";
        g.font = "24px 'IBM Plex Mono', monospace";
        g.fillText(bar, w / 2, 330);
      } else if (state.mode === "after") {
        g.fillStyle = dim;
        g.font = "20px 'IBM Plex Mono', monospace";
        g.fillText("CIVIL DEFENSE // SHELTER TERM.", 28, 48);
        g.fillStyle = green;
        g.font = "26px 'IBM Plex Mono', monospace";
        g.fillText("DATE: 01 JAN 2000", 28, 110);
        g.fillText("TIME: " + fmtAfter(), 28, 148);
        g.fillText("ALL SYSTEMS NOMINAL", 28, 210);
        g.fillStyle = dim;
        g.fillText("ANOMALIES: NONE", 28, 248);
        if (state.blink < 0.6) {
          g.font = "22px 'IBM Plex Mono', monospace";
          g.fillText("> TOUCH TO REWIND HISTORY", 28, 322);
        }
      }

      g.fillStyle = "rgba(0,0,0,0.22)";
      for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 2);
      const v = g.createRadialGradient(w / 2, h / 2, h / 3, w / 2, h / 2, h * 0.72);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.5)");
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
    }

    /* the screen: whatever mesh is named crt_screen gets the live texture */
    const crtTex = canvasTexture(512, 400, drawCRT);
    const screen = find("crt_screen");
    if (screen) {
      screen.material = new THREE.MeshBasicMaterial({ map: crtTex.tex });
    }

    function redraw() {
      drawCRT(crtTex.g, 512, 400);
      crtTex.tex.needsUpdate = true;
    }

    /* ---------- verbs, bound by name ---------- */
    const wheel = find("door_wheel");
    let wheelVel = 0;
    const door = find("door");
    if (door) {
      makeInteractive(door, () => {
        wheelVel += 4.5;
        sfx.tone({ freq: 95, slideTo: 55, dur: 0.7, type: "sawtooth", gain: 0.03 });
        sfx.tone({ freq: 1900, slideTo: 1100, dur: 0.3, type: "sine", gain: 0.012 });
        setHint("The door stays shut until it's over. Whatever it is.");
      });
    }

    const wobblers = [];
    root.traverse((o) => {
      if (/^can(_|$)/.test(o.name)) {
        o.userData.wobble = { t: 9, amp: 0 };
        wobblers.push(o);
        makeInteractive(o, () => {
          o.userData.wobble = { t: 0, amp: 0.3 + Math.random() * 0.15 };
          sfx.tone({ freq: 850 + Math.random() * 500, dur: 0.09, type: "triangle", gain: 0.035 });
          sfx.noise({ dur: 0.05, gain: 0.012, freq: 3000 });
          setHint("Beans. Enough until roughly March.");
        });
      }
    });

    const radio = find("radio");
    if (radio) {
      makeInteractive(radio, () => {
        sfx.noise({ dur: 0.6, gain: 0.045, freq: 1600, q: 0.6 });
        setTimeout(() => sfx.tone({ freq: 440, dur: 0.35, gain: 0.012 }), 650);
        setHint("Every station is a countdown or static. Mostly both.");
      });
    }

    let lampImpulse = 0;
    if (lamp) {
      makeInteractive(lamp, () => {
        lampImpulse = Math.min(lampImpulse + 0.12, 0.3);
        sfx.tone({ freq: 2400, dur: 0.05, gain: 0.01 });
      });
    }

    /* ---------- the clock's verbs ---------- */
    let lastTickSecond = -1;

    function arm() {
      if (state.mode === "counting" || state.mode === "blackout") return;
      sfx.ensureAudio();
      if (!hum) {
        hum = sfx.loop({ freq: 48, type: "sawtooth", gain: 0, noiseGain: 0, filterFreq: 240 });
      }
      hum.setLevel(0.03, 0.8);
      hum.setNoise(0.1, 0.8);
      state.mode = "counting";
      state.countdown = 15;
      lastTickSecond = -1;
      setHint("23:59:45. The museum has resumed history. Brace as needed.");
    }

    function midnight() {
      state.mode = "blackout";
      state.blackoutT = 0;
      sfx.setMaster(0.0001, 0.06);
      bulbLight.intensity = 0;
      if (bulb && bulb.material && bulb.material.emissive) bulb.material.emissiveIntensity = 0;
      hemi.intensity = 0.02;
      fill.intensity = 0;
      crtGlow.intensity = 0;
      bounce.intensity = 0;
      scene.environmentIntensity = 0; /* the dark has to be genuinely dark */
      redraw();
      setHint("");
    }

    function aftermath() {
      state.mode = "after";
      state.afterClock = 3;
      sfx.setMaster(0.9, 2.0);
      if (hum) { hum.setLevel(0.02, 2); hum.setNoise(0.05, 2); }
      [1200, 2100, 3300].forEach((ms) =>
        setTimeout(() => sfx.noise({ dur: 0.5, gain: 0.018, freq: 110, q: 0.7 }), ms)
      );
      setTimeout(() => showCard("EVERYTHING IS FINE.", 4200), 1400);
      setTimeout(
        () => setHint("Somewhere above, faintly, the world is celebrating. Touch the screen to rewind."),
        4800
      );
    }

    function rewind() {
      state.mode = "idle";
      state.countdown = 15;
      if (hum) { hum.setLevel(0, 0.5); hum.setNoise(0, 0.5); }
      /* restore anything the blackout zeroed, in case of an early rewind */
      hemi.intensity = 0.32;
      fill.intensity = 26;
      crtGlow.intensity = 1.6;
      bulbLight.intensity = 32;
      bounce.intensity = 5;
      scene.environmentIntensity = 0.4;
      if (bulb && bulb.material && bulb.material.emissive) bulb.material.emissiveIntensity = 2.4;
      setHint("Drag to look around. Click the television.");
    }

    if (crt) {
      makeInteractive(crt, () => {
        if (state.mode === "idle") arm();
        else if (state.mode === "after") rewind();
      });
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(redraw);
    }
    redraw();
    setHint("Drag to look around. Click the television.");

    /* ---------- museum service hatch ----------
       __bunker.exportGLB() downloads the current set as a .glb —
       the starting point for Blender refinement (see NOTES.md). */
    function exportGLB({ download = true } = {}) {
      return new Promise((resolve, reject) => {
        new GLTFExporter().parse(
          root,
          (buffer) => {
            if (download) {
              const blob = new Blob([buffer], { type: "model/gltf-binary" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "y2k-export.glb";
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 5000);
            }
            resolve(buffer.byteLength);
          },
          reject,
          { binary: true }
        );
      });
    }
    /* Flat, even light for judging a bake — kills the hot key light and
       floods the room from the environment, so baked albedo and occlusion
       can be read on their own terms. __bunker.inspect(false) to go back. */
    let inspecting = false;
    let inspectEnv = null;
    function inspect(on = !inspecting) {
      inspecting = on;
      if (on && !inspectEnv) {
        /* a bright neutral studio dome — the museum's own environment is
           deliberately near-black, so scaling it up only yields dim brown */
        inspectEnv = createEnvironment(ctx.renderer, {
          top: "#ffffff", mid: "#e2e2e2", bottom: "#a8a8a8",
        });
      }
      scene.environment = on ? inspectEnv : museumEnv;
      scene.environmentIntensity = on ? 1.5 : 0.4;
      hemi.intensity = on ? 1.2 : 0.32;
      bulbLight.intensity = on ? 6 : 32;
      fill.intensity = on ? 8 : 26;
      bounce.intensity = on ? 0 : 5;
      return on
        ? "inspection lighting on — flat studio dome, for reading baked maps"
        : "museum lighting restored";
    }

    window.__bunker = { arm, state, exportGLB, usedGLB, inspect, scene };

    /* ============================================================
       tick
       ============================================================ */
    const baseLamp = 32;
    const baseHemi = 0.32;
    const baseFill = 26;
    const baseGlow = 1.6;
    const baseBounce = 5;
    const baseEnv = 0.4;

    return {
      tick(dt, t) {
        state.blink = (state.blink + dt) % 1;

        if (lamp && !reducedMotion) {
          const sway = 0.018 + lampImpulse;
          lamp.rotation.z = Math.sin(t * 1.7) * sway;
          lamp.rotation.x = Math.cos(t * 1.3) * sway * 0.6;
          lampImpulse = Math.max(0, lampImpulse - dt * 0.08);
        }

        for (const holder of wobblers) {
          const wb = holder.userData.wobble;
          if (wb.t < 3) {
            wb.t += dt;
            holder.rotation.z = wb.amp * Math.sin(wb.t * 16) * Math.exp(-4 * wb.t);
          }
        }

        if (wheel && wheelVel > 0.001) {
          wheel.rotation.x += wheelVel * dt;
          wheelVel *= Math.pow(0.15, dt);
        }

        if (state.mode === "counting") {
          state.countdown -= dt;

          const sec = Math.ceil(state.countdown);
          if (sec !== lastTickSecond && state.countdown > 0) {
            lastTickSecond = sec;
            sfx.tone({ freq: 1250, dur: 0.03, type: "square", gain: 0.02 });
            sfx.tone({ freq: 170, dur: 0.06, type: "sine", gain: 0.025 });
            if (sec === 8 && hum) hum.setNoise(0.42, 8);
          }

          if (!reducedMotion && state.countdown < 7) {
            const dread = 1 - state.countdown / 7;
            if (Math.random() < dt * (2 + dread * 10)) {
              bulbLight.intensity = baseLamp * (0.35 + Math.random() * 0.5);
            } else {
              bulbLight.intensity +=
                (baseLamp - bulbLight.intensity) * Math.min(1, dt * 8);
            }
          }

          if (state.countdown <= 0) midnight();
        } else if (state.mode === "blackout") {
          state.blackoutT += dt;
          if (state.blackoutT > 1.9) aftermath();
        } else if (state.mode === "after") {
          state.afterClock += dt;
          const back = Math.min(1, Math.max(0, (state.afterClock - 3) / 0.9));
          const flicker =
            !reducedMotion && state.afterClock < 4.2 && Math.random() < 0.25
              ? 0.4
              : 1;
          bulbLight.intensity = baseLamp * back * flicker;
          if (bulb && bulb.material && bulb.material.emissive) {
            bulb.material.emissiveIntensity = 2.4 * back * flicker;
          }
          hemi.intensity = baseHemi * back;
          fill.intensity = baseFill * back;
          crtGlow.intensity = baseGlow * back;
          bounce.intensity = baseBounce * back * flicker;
          scene.environmentIntensity = baseEnv * back;
        }

        state.redrawAcc += dt;
        if (state.redrawAcc > 0.1) {
          state.redrawAcc = 0;
          redraw();
        }
      },
    };
  },
});
