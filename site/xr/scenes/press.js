/* Diorama II — The Print Shop, c. 1454.
   A common press by candlelight. Pull the lever: it prints a panic.
   Pull again: it prints the next five hundred years of them.
   Procedural set; drop a press.glb beside this file to replace it
   (same contract as the bunker — see NOTES.md). */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createDiorama, reducedMotion } from "../diorama.js";
import * as sfx from "../audio.js";

/* ---------- materials ---------- */
const M = {
  plaster:   new THREE.MeshStandardMaterial({ color: 0xb0a184, roughness: 0.95 }),
  plasterD:  new THREE.MeshStandardMaterial({ color: 0x8e8168, roughness: 0.97 }),
  timber:    new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 0.85 }),
  oak:       new THREE.MeshStandardMaterial({ color: 0x6e5137, roughness: 0.8 }),
  oakDark:   new THREE.MeshStandardMaterial({ color: 0x513a24, roughness: 0.82 }),
  iron:      new THREE.MeshStandardMaterial({ color: 0x3c3f45, roughness: 0.5, metalness: 0.7 }),
  brass:     new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.85 }),
  paper:     new THREE.MeshStandardMaterial({ color: 0xe4dac0, roughness: 0.9 }),
  ink:       new THREE.MeshStandardMaterial({ color: 0x16130f, roughness: 0.4 }),
  leather:   new THREE.MeshStandardMaterial({ color: 0x5e4530, roughness: 0.75 }),
  wax:       new THREE.MeshStandardMaterial({ color: 0xe8dcb8, roughness: 0.6 }),
  moon:      new THREE.MeshBasicMaterial({ color: 0xb8cde0 }),
  concreteD: new THREE.MeshStandardMaterial({ color: 0x3b3733, roughness: 0.97 }),
};

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

/* ---------- the five centuries of headlines ---------- */
const HEADLINES = [
  ["ON WRITING:", "MEMORY IS DOOMED"],
  ["TOO MANY BOOKS:", "SCHOLARS DROWN"],
  ["NOVELS CORRUPT", "THE YOUNG"],
  ["RAILWAY SPEED", "DERANGES THE SPINE"],
  ["TELEGRAPH TOO FAST", "FOR THE TRUTH"],
  ["THE DEVIL SPEAKS", "BY TELEPHONE"],
  ["THE WIRELESS RUINS", "THE CHILDREN"],
  ["COMIC BOOKS BREED", "DELINQUENTS"],
  ["TELEVISION DECLARED", "A VAST WASTELAND"],
  ["DICE GAMES", "SUMMON DEMONS"],
  ["VIDEO GAMES", "TRAIN KILLERS"],
  ["THE INTERNET?", "BAH!"],
  ["MILLENNIUM BUG", "TO END WORLD"],
  ["TELEPHONES ROT", "THE BRAIN"],
  ["THIS HEADLINE", "PRINTED ITSELF"],
];

const sheetTexCache = [];
function sheetTexture(i) {
  if (sheetTexCache[i]) return sheetTexCache[i];
  const [l1, l2] = HEADLINES[i % HEADLINES.length];
  const t = canvasTexture(512, 704, (g, w, h) => {
    g.fillStyle = "#e9dfc6";
    g.fillRect(0, 0, w, h);
    /* deckled edge grime */
    for (let k = 0; k < 260; k++) {
      g.fillStyle = "rgba(90,70,40," + Math.random() * 0.1 + ")";
      const s = Math.random() * 3 + 0.5;
      g.fillRect(Math.random() * w, Math.random() * h, s, s);
    }
    g.strokeStyle = "#3a2c1a"; g.lineWidth = 3;
    g.strokeRect(18, 18, w - 36, h - 36);
    g.textAlign = "center"; g.fillStyle = "#241a0e";
    g.font = "700 58px UnifrakturCook, serif";
    g.fillText("The Daily Panick", w / 2, 96);
    g.font = "400 17px Georgia";
    g.fillText("EST. 1454  ·  NEVER ONCE STOPPED  ·  PRICE ONE PENNY", w / 2, 128);
    g.fillRect(40, 146, w - 80, 3);
    g.font = "900 52px 'Playfair Display', Georgia";
    g.fillText(l1, w / 2, 226);
    g.fillText(l2, w / 2, 286);
    g.fillRect(40, 316, w - 80, 2);
    /* filler columns */
    g.fillStyle = "#4d4232";
    for (let col = 0; col < 2; col++) {
      const x = 48 + col * ((w - 96) / 2 + 10);
      for (let row = 0; row < 22; row++) {
        const lw = (w - 96) / 2 - 10 - Math.random() * 28;
        g.fillRect(x, 340 + row * 14, lw, 5);
      }
    }
    g.fillStyle = "#241a0e";
    g.font = "italic 400 17px Georgia";
    g.fillText("Panick: free of charge, now and always.", w / 2, h - 40);
  });
  sheetTexCache[i] = t;
  return t;
}

/* ============================================================ */
createDiorama({
  camera: {
    position: [1.5, 1.8, 3.9],
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
    root.name = "shop_root";
    scene.add(root);

    /* ---------- try Blender set first ---------- */
    const GLB_URL = new URL("./press.glb", import.meta.url).href;
    let usedGLB = false;
    try {
      const probe = await fetch(GLB_URL, { method: "HEAD" });
      if (probe.ok) {
        const gltf = await new GLTFLoader().loadAsync(GLB_URL);
        gltf.scene.traverse((n) => {
          if (n.isLight) n.removeFromParent();
          if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; }
        });
        root.add(gltf.scene);
        usedGLB = true;
        console.info("Press: loaded press.glb (Blender set)");
      }
    } catch (e) { /* fall through to procedural */ }

    if (!usedGLB) buildProcedural(root);

    /* ---------- find the working parts by name ---------- */
    const find = (n) => root.getObjectByName(n) || null;
    const lever = find("press_lever");
    const platen = find("press_platen");
    const candle = find("candle");
    const pressGroup = find("press");
    const pilePoint = find("pile_point") || root;

    /* ---------- lights (always code-owned) ---------- */
    const hemi = new THREE.HemisphereLight(0x2a2a33, 0x0b0a09, 0.38);
    scene.add(hemi);
    const fill = new THREE.SpotLight(0x9fb4c8, 26, 0, 0.55, 0.7, 2);
    fill.position.set(2.4, 3.4, 4.6);
    fill.target.position.set(0, 0.9, -0.8);
    scene.add(fill);
    scene.add(fill.target);

    const candleLight = new THREE.PointLight(0xffb36b, 9, 0, 2);
    candleLight.castShadow = true;
    candleLight.shadow.mapSize.set(1024, 1024);
    candleLight.shadow.bias = -0.004;
    if (candle) candle.add(candleLight), candleLight.position.set(0, 0.16, 0);
    else { candleLight.position.set(-1.1, 1.1, -0.9); scene.add(candleLight); }

    const moonLight = new THREE.SpotLight(0x9fb4c8, 12, 0, 0.5, 0.8, 2);
    moonLight.position.set(-0.8, 2.2, -3.4);
    moonLight.target.position.set(0.5, 0.6, 0.2);
    scene.add(moonLight);
    scene.add(moonLight.target);

    /* ============================================================
       the press at work
       ============================================================ */
    const state = { mode: "idle", t: 0, printed: 0 };
    const sheets = [];   /* settled printed sheets */
    let flying = null;   /* sheet mid-flight */
    const pileBase = new THREE.Vector3(1.18, 0.795, -0.5);

    function spawnSheet() {
      const idx = state.printed % HEADLINES.length;
      const tex = sheetTexture(idx);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(0.28, 0.385),
        new THREE.MeshStandardMaterial({ map: tex.tex, roughness: 0.9, side: THREE.DoubleSide })
      );
      m.rotation.x = -Math.PI / 2;
      m.castShadow = true;
      /* start on the press bed */
      const start = pressGroup
        ? pressGroup.localToWorld(new THREE.Vector3(0, 0.62, 0.34))
        : new THREE.Vector3(0.3, 0.7, -0.85);
      m.position.copy(start);
      root.add(m);

      const target = pileBase.clone();
      target.y += sheets.length * 0.004;
      target.x += (Math.random() - 0.5) * 0.05;
      target.z += (Math.random() - 0.5) * 0.05;
      flying = {
        mesh: m, t: 0, from: start, to: target,
        rot: (Math.random() - 0.5) * 0.7,
      };
    }

    function pull() {
      if (state.mode !== "idle") return;
      sfx.ensureAudio();
      state.mode = "pulling";
      state.t = 0;
      sfx.tone({ freq: 120, slideTo: 70, dur: 0.8, type: "sawtooth", gain: 0.035 });
      sfx.tone({ freq: 900, slideTo: 500, dur: 0.5, type: "triangle", gain: 0.012 });
    }

    const HINTS = {
      1: "One pull, one panic. That is the exchange rate.",
      3: "The press does not tire. Do you?",
      6: "Note the dates on these panics. The press prints ahead of schedule.",
      10: "Five centuries down. The press is just warming up.",
      15: "The press has begun reporting on itself. The museum considers this normal.",
    };

    if (pressGroup) makeInteractive(pressGroup, pull);
    if (candle) makeInteractive(candle, () => {
      candleFlicker = 1.6;
      sfx.noise({ dur: 0.15, gain: 0.02, freq: 900, q: 0.8 });
      setHint("Careful. This entire industry is flammable.");
    });
    const inkBalls = find("ink_balls");
    if (inkBalls) makeInteractive(inkBalls, () => {
      sfx.noise({ dur: 0.2, gain: 0.025, freq: 300, q: 0.6 });
      setHint("Ink of lampblack and varnish. Stains last longer than most panics.");
    });
    const typeCase = find("type_case");
    if (typeCase) makeInteractive(typeCase, () => {
      sfx.noise({ dur: 0.25, gain: 0.03, freq: 2400, q: 0.5 });
      setHint("Twenty-six lead letters. Every panic ever printed is a rearrangement.");
    });

    setHint("Drag to look around. Pull the press — click it.");

    /* service hatch */
    window.__press = {
      pull,
      state,
      usedGLB,
      exportGLB(download = true) {
        return new Promise((resolve, reject) => {
          new GLTFExporter().parse(
            root,
            (buf) => {
              if (download) {
                const blob = new Blob([buf], { type: "model/gltf-binary" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "press-export.glb";
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 4000);
              }
              resolve(buf.byteLength);
            },
            reject,
            { binary: true }
          );
        });
      },
    };

    /* ============================================================
       tick
       ============================================================ */
    let candleFlicker = 0;
    const leverRest = lever ? lever.rotation.y : 0;
    const platenRest = platen ? platen.position.y : 0;

    return {
      tick(dt, t) {
        /* candle light: constant nervous life */
        if (!reducedMotion) {
          const base = 9 + Math.sin(t * 11) * 0.7 + Math.sin(t * 23 + 1.3) * 0.5;
          candleLight.intensity = base + candleFlicker * 6 * Math.random();
          candleFlicker = Math.max(0, candleFlicker - dt * 2);
        }

        /* press cycle */
        if (state.mode === "pulling") {
          state.t += dt / 0.85;
          const k = Math.min(1, state.t);
          const e = k * k * (3 - 2 * k); /* smoothstep */
          if (lever) lever.rotation.y = leverRest - e * 2.1;
          if (platen) platen.position.y = platenRest - e * 0.1;
          if (k >= 1) {
            state.mode = "lifting";
            state.t = 0;
            state.printed++;
            sfx.tone({ freq: 60, dur: 0.12, type: "sine", gain: 0.06 });
            sfx.noise({ dur: 0.1, gain: 0.03, freq: 150, q: 1 });
          }
        } else if (state.mode === "lifting") {
          state.t += dt / 0.7;
          const k = Math.min(1, state.t);
          const e = 1 - (1 - k) * (1 - k);
          if (lever) lever.rotation.y = leverRest - 2.1 + e * 2.1;
          if (platen) platen.position.y = platenRest - 0.1 + e * 0.1;
          if (k >= 1) {
            state.mode = "sliding";
            spawnSheet();
            sfx.noise({ dur: 0.3, gain: 0.02, freq: 4000, q: 0.4 });
          }
        } else if (state.mode === "sliding") {
          if (flying) {
            flying.t += dt / 0.8;
            const k = Math.min(1, flying.t);
            const e = k * k * (3 - 2 * k);
            flying.mesh.position.lerpVectors(flying.from, flying.to, e);
            flying.mesh.position.y += Math.sin(k * Math.PI) * 0.22; /* arc */
            flying.mesh.rotation.z = flying.rot * e;
            if (k >= 1) {
              flying.mesh.position.copy(flying.to);
              sheets.push(flying.mesh);
              if (sheets.length > 24) {
                const old = sheets.shift();
                old.removeFromParent();
              }
              flying = null;
              state.mode = "idle";
              const h = HINTS[state.printed];
              if (h) setHint(h);
              if (state.printed === 15) showCard("STILL PRINTING.", 3200);
            }
          } else state.mode = "idle";
        }
      },
    };

    /* ============================================================
       procedural set
       ============================================================ */
    function buildProcedural(root) {
      /* plinth */
      const plinth = box(4.4, 0.14, 4.0, M.concreteD);
      plinth.name = "plinth";
      plinth.position.set(0, -0.07, -0.7);
      root.add(plinth);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(4.44, 0.02, 4.04), M.brass);
      trim.position.set(0, -0.135, -0.7);
      root.add(trim);

      const plaqueTex = canvasTexture(512, 96, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#d4af37"); grad.addColorStop(1, "#8f7620");
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
        g.fillStyle = "#241c08"; g.textAlign = "center";
        g.font = "600 30px 'IBM Plex Mono', monospace";
        g.fillText("EXHIBIT II — THE PRESS", w / 2, 42);
        g.font = "22px 'IBM Plex Mono', monospace";
        g.fillText("CIRCA 1454", w / 2, 74);
      });
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 0.16),
        new THREE.MeshStandardMaterial({ map: plaqueTex.tex, roughness: 0.4, metalness: 0.6 })
      );
      plaque.position.set(0, 0.02, 1.302);
      plaque.rotation.x = -0.5;
      root.add(plaque);

      /* room shell: plank floor, plaster walls, timber frame */
      const floor = box(3.4, 0.08, 3.0, M.oakDark);
      floor.name = "floor";
      floor.position.set(0, 0.04, -0.7);
      root.add(floor);
      for (let i = 0; i < 8; i++) {
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 3.0), M.timber);
        seam.position.set(-1.5 + i * 0.42, 0.082, -0.7);
        root.add(seam);
      }

      const backWall = box(3.64, 2.35, 0.12, M.plaster);
      backWall.position.set(0, 1.175, -2.26);
      root.add(backWall);
      const leftWall = box(0.12, 2.35, 3.16, M.plasterD);
      leftWall.position.set(-1.76, 1.175, -0.74);
      root.add(leftWall);
      const rightWall = box(0.12, 2.35, 3.16, M.plasterD);
      rightWall.position.set(1.76, 1.175, -0.74);
      root.add(rightWall);
      const ceiling = box(3.64, 0.12, 3.16, M.timber);
      ceiling.position.set(0, 2.41, -0.74);
      root.add(ceiling);

      /* timber beams */
      [[-1.68, -0.74, 0], [1.68, -0.74, 0], [0, -2.18, 1]].forEach(([x, z]) => {
        const beam = box(0.14, 2.35, 0.14, M.timber);
        beam.position.set(x, 1.175, z);
        root.add(beam);
      });
      const lintel = box(3.64, 0.16, 0.16, M.timber);
      lintel.position.set(0, 2.25, -2.18);
      root.add(lintel);

      /* window with moonlight (back wall, left) */
      const winFrame = box(0.7, 0.9, 0.08, M.timber);
      winFrame.position.set(-0.85, 1.5, -2.21);
      root.add(winFrame);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.76), M.moon);
      glow.position.set(-0.85, 1.5, -2.16);
      root.add(glow);
      const mullionV = box(0.03, 0.76, 0.03, M.timber);
      mullionV.position.set(-0.85, 1.5, -2.15);
      root.add(mullionV);
      const mullionH = box(0.56, 0.03, 0.03, M.timber);
      mullionH.position.set(-0.85, 1.5, -2.15);
      root.add(mullionH);

      /* ---------- the common press ---------- */
      const press = new THREE.Group();
      press.name = "press";
      press.position.set(0.3, 0.08, -1.25);
      root.add(press);

      const sled = box(1.0, 0.12, 0.8, M.oakDark);
      sled.position.y = 0.06;
      press.add(sled);

      [-0.38, 0.38].forEach((x) => {
        const cheek = box(0.16, 1.9, 0.22, M.oak);
        cheek.position.set(x, 1.07, -0.1);
        press.add(cheek);
      });
      const crown = box(1.0, 0.18, 0.26, M.oak);
      crown.position.set(0, 2.0, -0.1);
      press.add(crown);
      const brace = box(1.0, 0.12, 0.22, M.oak);
      brace.position.set(0, 1.45, -0.1);
      press.add(brace);

      /* screw + housing */
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.55, 14), M.iron);
      screw.position.set(0, 1.18, -0.1);
      screw.castShadow = true;
      press.add(screw);
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 14), M.oakDark);
      housing.position.set(0, 1.3, -0.1);
      press.add(housing);

      /* lever (the verb) */
      const lever = new THREE.Group();
      lever.name = "press_lever";
      lever.position.set(0, 1.3, -0.1);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 1.15, 10), M.iron);
      bar.rotation.z = Math.PI / 2;
      bar.position.x = 0.45;
      bar.castShadow = true;
      lever.add(bar);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 10), M.leather);
      grip.rotation.z = Math.PI / 2;
      grip.position.x = 0.95;
      lever.add(grip);
      /* bar rests swung toward the operator — visible, and where a
         pressman would actually leave it */
      lever.rotation.y = 1.15;
      press.add(lever);

      /* generous invisible hitbox so any click near the press pulls it */
      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 2.2, 1.7),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      hitbox.name = "press_hitbox";
      hitbox.position.set(0, 1.1, 0.1);
      press.add(hitbox);

      /* platen */
      const platen = box(0.55, 0.07, 0.42, M.oakDark);
      platen.name = "press_platen";
      platen.position.set(0, 0.98, -0.1);
      press.add(platen);

      /* bed with type form, rails running toward the viewer */
      const rails = box(0.62, 0.06, 1.3, M.oak);
      rails.position.set(0, 0.52, 0.2);
      press.add(rails);
      const bed = box(0.55, 0.08, 0.45, M.oak);
      bed.position.set(0, 0.59, -0.1);
      press.add(bed);
      const form = box(0.42, 0.03, 0.32, M.ink);
      form.position.set(0, 0.645, -0.1);
      press.add(form);
      /* blank sheet waiting on the tympan */
      const waiting = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.385), M.paper);
      waiting.rotation.x = -Math.PI / 2;
      waiting.position.set(0, 0.63, 0.34);
      press.add(waiting);

      /* ---------- ink table (left) ---------- */
      const inkTable = new THREE.Group();
      inkTable.position.set(-1.15, 0.08, -1.0);
      root.add(inkTable);
      const itTop = box(0.7, 0.05, 0.9, M.oak);
      itTop.position.y = 0.72;
      inkTable.add(itTop);
      [[-0.3, -0.4], [0.3, -0.4], [-0.3, 0.4], [0.3, 0.4]].forEach(([x, z]) => {
        const leg = box(0.06, 0.72, 0.06, M.oakDark);
        leg.position.set(x, 0.36, z);
        inkTable.add(leg);
      });
      /* ink slab + balls */
      const slab = box(0.3, 0.03, 0.3, M.ink);
      slab.position.set(-0.12, 0.76, -0.2);
      inkTable.add(slab);
      const inkBalls = new THREE.Group();
      inkBalls.name = "ink_balls";
      inkBalls.position.set(-0.1, 0.78, -0.18);
      [[-0.06, 0], [0.1, 0.08]].forEach(([x, z]) => {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), M.leather);
        ball.position.set(x, 0.06, z);
        ball.castShadow = true;
        inkBalls.add(ball);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.14, 8), M.oakDark);
        handle.position.set(x, 0.16, z);
        inkBalls.add(handle);
      });
      inkTable.add(inkBalls);
      /* blank paper stack */
      const blanks = box(0.3, 0.1, 0.42, M.paper);
      blanks.position.set(0.16, 0.8, 0.22);
      inkTable.add(blanks);
      /* candle */
      const candle = new THREE.Group();
      candle.name = "candle";
      candle.position.set(0.22, 0.745, -0.28);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.03, 12), M.brass);
      candle.add(stick);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.16, 10), M.wax);
      shaft.position.y = 0.09;
      candle.add(shaft);
      const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.014, 0.05, 8),
        new THREE.MeshStandardMaterial({
          color: 0xffd27a, emissive: 0xffa030, emissiveIntensity: 3.2,
        })
      );
      flame.position.y = 0.2;
      candle.add(flame);
      inkTable.add(candle);

      /* ---------- delivery table (right) — the pile grows here ---------- */
      const outTable = new THREE.Group();
      outTable.position.set(1.18, 0.08, -0.5);
      root.add(outTable);
      const otTop = box(0.6, 0.05, 0.8, M.oak);
      otTop.position.y = 0.69;
      outTable.add(otTop);
      [[-0.25, -0.35], [0.25, -0.35], [-0.25, 0.35], [0.25, 0.35]].forEach(([x, z]) => {
        const leg = box(0.06, 0.69, 0.06, M.oakDark);
        leg.position.set(x, 0.345, z);
        outTable.add(leg);
      });
      const pilePoint = new THREE.Group();
      pilePoint.name = "pile_point";
      pilePoint.position.set(1.18, 0.795, -0.5);
      root.add(pilePoint);

      /* ---------- type case on back wall ---------- */
      const typeCase = new THREE.Group();
      typeCase.name = "type_case";
      typeCase.position.set(0.85, 1.45, -2.17);
      const caseTex = canvasTexture(256, 160, (g, w, h) => {
        g.fillStyle = "#513a24"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "#2e2114"; g.lineWidth = 3;
        for (let x = 0; x <= w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
        for (let y = 0; y <= h; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
        g.fillStyle = "#8a7a60"; g.font = "16px Georgia"; g.textAlign = "center";
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ.,;!?&";
        let li = 0;
        for (let y = 22; y < h; y += 32)
          for (let x = 16; x < w; x += 32) g.fillText(letters[li++ % letters.length], x, y);
      });
      const caseFront = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.5),
        new THREE.MeshStandardMaterial({ map: caseTex.tex, roughness: 0.85 })
      );
      typeCase.add(caseFront);
      const caseFrame = box(0.86, 0.56, 0.05, M.timber);
      caseFrame.position.z = -0.03;
      typeCase.add(caseFrame);
      root.add(typeCase);

      /* re-render canvas textures once fonts land */
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          [plaqueTex, caseTex].forEach((t) => {
            t.draw(t.g, t.canvas.width, t.canvas.height);
            t.tex.needsUpdate = true;
          });
          sheetTexCache.length = 0; /* re-bake any cached sheets with real fonts */
        });
      }
    }
  },
});
