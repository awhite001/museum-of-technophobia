/* Diorama VIII — The Schoolyard Bonfire, 1954.
   They really did march the children out to burn their own collections.
   The verb is: throw one on the fire. The museum then does the arithmetic.
   Procedural set; drop a bonfire.glb beside this file to replace it. */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createDiorama, reducedMotion } from "../diorama.js";
import * as sfx from "../audio.js";

const M = {
  asphalt:  new THREE.MeshStandardMaterial({ color: 0x35322d, roughness: 1.0 }),
  brick:    new THREE.MeshStandardMaterial({ color: 0x6b4436, roughness: 0.92 }),
  brickD:   new THREE.MeshStandardMaterial({ color: 0x4e3228, roughness: 0.95 }),
  stone:    new THREE.MeshStandardMaterial({ color: 0x5c574e, roughness: 0.95 }),
  char:     new THREE.MeshStandardMaterial({ color: 0x191512, roughness: 0.9 }),
  ash:      new THREE.MeshStandardMaterial({ color: 0x3a352f, roughness: 1.0 }),
  crate:    new THREE.MeshStandardMaterial({ color: 0x6e5137, roughness: 0.85 }),
  crateD:   new THREE.MeshStandardMaterial({ color: 0x4f3a26, roughness: 0.88 }),
  iron:     new THREE.MeshStandardMaterial({ color: 0x3c3f45, roughness: 0.5, metalness: 0.7 }),
  brass:    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.85 }),
  glass:    new THREE.MeshStandardMaterial({ color: 0x1d2630, roughness: 0.25, metalness: 0.2 }),
  cloth:    new THREE.MeshStandardMaterial({ color: 0x3b3f4a, roughness: 0.9 }),
  book:     new THREE.MeshStandardMaterial({ color: 0x7a2b22, roughness: 0.75 }),
  concreteD:new THREE.MeshStandardMaterial({ color: 0x3b3733, roughness: 0.97 }),
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

/* ---------- what was actually on the pyre ----------
   Titles and approximate high-grade auction results are real; figures are
   rounded, and every issue here predates the 1954 hearings. */
const COMICS = [
  { title: "TALES FROM THE CRYPT #46", year: 1954, value: 45000 },
  { title: "THE HAUNT OF FEAR #19",    year: 1953, value: 25000 },
  { title: "VAULT OF HORROR #12",      year: 1950, value: 30000 },
  { title: "WHIZ COMICS #2",           year: 1940, value: 280000 },
  { title: "CRIME SUSPENSTORIES #22",  year: 1954, value: 500000 },
  { title: "ALL STAR COMICS #8",       year: 1941, value: 1600000 },
  { title: "MARVEL COMICS #1",         year: 1939, value: 1260000 },
  { title: "DETECTIVE COMICS #27",     year: 1939, value: 1500000 },
  { title: "BATMAN #1",                year: 1940, value: 2200000 },
  { title: "CAPTAIN AMERICA COMICS #1",year: 1941, value: 3100000 },
  { title: "ACTION COMICS #1",         year: 1938, value: 3200000 },
  { title: "SUPERMAN #1",              year: 1939, value: 5300000 },
];

const money = (n) => "$" + n.toLocaleString("en-US");

/* pastiche covers — invented mastheads, period palette, no real art */
const COVER_WORDS = [
  ["ASTOUNDING", "CRIME", 0xb5211c],
  ["TALES OF", "TERROR", 0x2f6b3a],
  ["THE MASKED", "AVENGER", 0x1f4f8f],
  ["WEIRD", "SCIENCE", 0x7a3f9e],
  ["MIDNIGHT", "HORROR", 0x8a5a1c],
  ["JUSTICE", "SQUAD", 0xc2a01e],
];

function coverTexture(i) {
  const [l1, l2, col] = COVER_WORDS[i % COVER_WORDS.length];
  const hex = "#" + col.toString(16).padStart(6, "0");
  return canvasTexture(256, 384, (g, w, h) => {
    g.fillStyle = "#e0d3ad"; g.fillRect(0, 0, w, h);
    g.fillStyle = hex; g.fillRect(0, 0, w, 96);
    g.fillStyle = "#f6ecd0"; g.textAlign = "center";
    g.font = "700 30px Oswald, sans-serif";
    g.fillText(l1, w / 2, 42);
    g.font = "700 44px Oswald, sans-serif";
    g.fillText(l2, w / 2, 86);
    /* crude period cover art: figure + burst */
    g.fillStyle = "#c9b98c"; g.fillRect(14, 110, w - 28, h - 150);
    g.save(); g.translate(w / 2, 230);
    g.fillStyle = hex;
    g.beginPath();
    for (let k = 0; k < 20; k++) {
      const a = (k / 20) * Math.PI * 2;
      g.lineTo(Math.cos(a) * (k % 2 ? 46 : 76), Math.sin(a) * (k % 2 ? 46 : 76));
    }
    g.closePath(); g.fill();
    g.fillStyle = "#2b241a";
    g.beginPath(); g.arc(0, -14, 18, 0, 7); g.fill();
    g.fillRect(-14, 6, 28, 46);
    g.restore();
    g.fillStyle = "#2b241a"; g.font = "700 20px Oswald, sans-serif";
    g.fillText("10¢", 40, h - 22);
    g.font = "400 16px Georgia";
    g.fillText("APPROVED BY NOBODY", w / 2 + 20, h - 22);
    /* wear */
    for (let k = 0; k < 300; k++) {
      g.fillStyle = "rgba(70,55,30," + Math.random() * 0.12 + ")";
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

createDiorama({
  camera: {
    position: [2.1, 1.85, 5.0],
    target: [0, 0.55, -0.4],
    minDistance: 1.4,
    maxDistance: 10,
    minAzimuth: -1.1,
    maxAzimuth: 1.1,
    minPolar: 0.22,
    maxPolar: 1.5,
  },

  async build(ctx) {
    const { scene, makeInteractive, setHint, showCard } = ctx;
    scene.fog = new THREE.Fog(0x0b0a09, 7, 22);

    const root = new THREE.Group();
    root.name = "yard_root";
    scene.add(root);

    /* the throwable comics, bottom of the pile first */
    const pile = [];

    const GLB_URL = new URL("./bonfire.glb", import.meta.url).href;
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
        console.info("Bonfire: loaded bonfire.glb (Blender set)");
      }
    } catch (e) { /* procedural */ }

    if (!usedGLB) buildProcedural(root);
    root.updateMatrixWorld(true);

    const find = (n) => root.getObjectByName(n) || null;
    const flames = find("fire_flames");
    const stack = find("comic_stack");
    const firePos = new THREE.Vector3(0, 0.12, -0.35);
    if (find("fire_pit")) find("fire_pit").getWorldPosition(firePos);

    /* a Blender set supplies its own comic_01… meshes; collect them in order */
    if (usedGLB) {
      const found = [];
      root.traverse((n) => { if (/^comic_\d+$/.test(n.name)) found.push(n); });
      found.sort((a, b) => a.name.localeCompare(b.name));
      pile.push(...found);
    }

    /* ---------- lights ---------- */
    const hemi = new THREE.HemisphereLight(0x1e2430, 0x0b0a09, 0.26);
    scene.add(hemi);
    const moonFill = new THREE.SpotLight(0x8fa6bf, 16, 0, 0.6, 0.7, 2);
    moonFill.position.set(2.6, 4.0, 4.6);
    moonFill.target.position.set(0, 0.5, -0.6);
    scene.add(moonFill);
    scene.add(moonFill.target);

    const fireLight = new THREE.PointLight(0xff8b2e, 26, 0, 2);
    fireLight.position.copy(firePos).add(new THREE.Vector3(0, 0.62, 0));
    fireLight.castShadow = true;
    fireLight.shadow.mapSize.set(1024, 1024);
    fireLight.shadow.bias = -0.004;
    scene.add(fireLight);

    /* ---------- embers ---------- */
    const EMBERS = reducedMotion ? 0 : 150;
    let emberPts = null;
    const emberVel = [];
    if (EMBERS) {
      const pos = new Float32Array(EMBERS * 3);
      for (let i = 0; i < EMBERS; i++) {
        pos[i * 3] = firePos.x + (Math.random() - 0.5) * 0.5;
        pos[i * 3 + 1] = firePos.y + Math.random() * 1.6;
        pos[i * 3 + 2] = firePos.z + (Math.random() - 0.5) * 0.5;
        emberVel.push({
          y: 0.5 + Math.random() * 0.9,
          x: (Math.random() - 0.5) * 0.25,
          z: (Math.random() - 0.5) * 0.25,
        });
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      emberPts = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          color: 0xffb257, size: 0.028, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      emberPts.name = "embers";
      scene.add(emberPts);
    }

    /* ============================================================
       burning
       ============================================================ */
    const state = { burned: 0, total: 0, throwing: null, flare: 0 };
    const cards = [];

    function priceCard(comic) {
      const t = canvasTexture(512, 128, (g, w, h) => {
        g.clearRect(0, 0, w, h);
        g.fillStyle = "rgba(10,8,6,0.82)";
        g.fillRect(0, 0, w, h);
        g.strokeStyle = "#c9a227"; g.lineWidth = 3;
        g.strokeRect(4, 4, w - 8, h - 8);
        g.textAlign = "center";
        g.fillStyle = "#e8ddc0";
        g.font = "500 27px 'IBM Plex Mono', monospace";
        g.fillText(comic.title, w / 2, 44);
        g.fillStyle = "#ffb257";
        g.font = "700 46px 'IBM Plex Mono', monospace";
        g.fillText(money(comic.value), w / 2, 98);
      });
      /* a Sprite billboards itself — no per-frame lookAt to get wrong */
      const m = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: t.tex, transparent: true, depthWrite: false, fog: false,
        })
      );
      m.scale.set(0.9, 0.225, 1);
      /* clear of the flame cones — additive fire washes out anything inside it */
      m.position.copy(firePos).add(new THREE.Vector3(0, 1.5, 0.2));
      m.renderOrder = 999;
      m.userData.life = 0;
      scene.add(m);
      cards.push(m);
    }

    function throwComic() {
      if (state.throwing || state.burned >= COMICS.length) return;
      sfx.ensureAudio();
      const comic = COMICS[state.burned];
      /* lift the top comic off the pile */
      const mesh = pile.pop();
      if (!mesh) return;
      const from = new THREE.Vector3();
      mesh.getWorldPosition(from);
      scene.attach(mesh);
      state.throwing = {
        mesh, comic, t: 0,
        from,
        to: firePos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 0.24, 0.12, (Math.random() - 0.5) * 0.24
        )),
        spin: (Math.random() - 0.5) * 8,
      };
      sfx.noise({ dur: 0.22, gain: 0.02, freq: 2600, q: 0.5 });
    }

    const LINES = {
      1: "One down. The museum is keeping a tally; you may wish it wouldn't.",
      3: "No study has ever linked these to delinquency. The fire is unmoved.",
      6: "Half the crate. Somewhere, a future collector is being born.",
      9: "The Senate held hearings. The children held matches.",
    };

    if (stack) makeInteractive(stack, throwComic);
    const wertham = find("wertham_book");
    if (wertham) makeInteractive(wertham, () =>
      setHint("“Seduction of the Innocent,” 1954. Its own first edition now fetches a tidy sum.")
    );
    const notice = find("poster_notice");
    if (notice) makeInteractive(notice, () =>
      setHint("The notice does not specify what to do afterward. Nobody asked.")
    );

    setHint("Drag to look around. Take a comic from the crate and throw it on.");

    window.__bonfire = {
      throwComic, state, usedGLB, cards, scene, root,
      exportGLB(download = true) {
        return new Promise((resolve, reject) => {
          new GLTFExporter().parse(root, (buf) => {
            if (download) {
              const blob = new Blob([buf], { type: "model/gltf-binary" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "bonfire-export.glb";
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 4000);
            }
            resolve(buf.byteLength);
          }, reject, { binary: true });
        });
      },
    };

    /* ============================================================
       tick
       ============================================================ */
    return {
      tick(dt, t) {
        /* fire: flame cones breathe, light flickers */
        const flick = reducedMotion ? 1
          : 1 + Math.sin(t * 13) * 0.09 + Math.sin(t * 27 + 1.7) * 0.06 + Math.random() * 0.05;
        fireLight.intensity = (26 + state.flare * 40) * flick;
        state.flare = Math.max(0, state.flare - dt * 1.6);

        if (flames && !reducedMotion) {
          flames.children.forEach((f, i) => {
            const p = t * (2.4 + i * 0.5) + i;
            f.scale.y = f.userData.baseY * (0.78 + Math.sin(p) * 0.2 + state.flare * 0.5);
            f.scale.x = f.userData.baseX * (0.9 + Math.cos(p * 1.3) * 0.12);
            f.position.x = f.userData.baseX0 + Math.sin(p * 0.8) * 0.03;
            f.position.z = f.userData.baseZ0 + Math.cos(p * 0.7) * 0.03;
          });
        }

        /* embers rise and recycle */
        if (emberPts) {
          const arr = emberPts.geometry.attributes.position.array;
          for (let i = 0; i < EMBERS; i++) {
            const v = emberVel[i];
            arr[i * 3] += v.x * dt;
            arr[i * 3 + 1] += v.y * dt * (1 + state.flare);
            arr[i * 3 + 2] += v.z * dt;
            if (arr[i * 3 + 1] > firePos.y + 2.4) {
              arr[i * 3] = firePos.x + (Math.random() - 0.5) * 0.45;
              arr[i * 3 + 1] = firePos.y + 0.1;
              arr[i * 3 + 2] = firePos.z + (Math.random() - 0.5) * 0.45;
            }
          }
          emberPts.geometry.attributes.position.needsUpdate = true;
        }

        /* comic in flight */
        if (state.throwing) {
          const th = state.throwing;
          th.t += dt / 0.9;
          const k = Math.min(1, th.t);
          const e = k * k * (3 - 2 * k);
          th.mesh.position.lerpVectors(th.from, th.to, e);
          th.mesh.position.y += Math.sin(k * Math.PI) * 0.75;
          th.mesh.rotation.x += th.spin * dt;
          th.mesh.rotation.z += th.spin * 0.6 * dt;
          if (k >= 1) {
            /* it lands, it flares, it is gone */
            th.mesh.removeFromParent();
            state.flare = 1;
            state.burned++;
            state.total += th.comic.value;
            priceCard(th.comic);
            sfx.noise({ dur: 0.5, gain: 0.05, freq: 420, q: 0.5 });
            sfx.tone({ freq: 180, slideTo: 70, dur: 0.5, type: "sawtooth", gain: 0.02 });
            const line = LINES[state.burned];
            setHint((line ? line + "  " : "") + "VALUE INCINERATED: " + money(state.total));
            if (state.burned === COMICS.length) {
              setTimeout(() => showCard(money(state.total) + " — NO LINK WAS EVER ESTABLISHED", 6000), 1400);
              setTimeout(() => setHint(
                "Approximate high-grade auction results. The delinquents grew up and bought them back."
              ), 5200);
            }
            state.throwing = null;
          }
        }

        /* price cards drift up and fade */
        for (let i = cards.length - 1; i >= 0; i--) {
          const c = cards[i];
          c.userData.life += dt;
          c.position.y += dt * 0.16;
          /* opacity must stay within 0..1 — above 1 three.js draws nothing */
          const l = c.userData.life;
          const fadeIn = Math.min(1, l / 0.3);
          const fadeOut = Math.min(1, Math.max(0, (6.5 - l) / 1.5));
          c.material.opacity = Math.max(0, Math.min(fadeIn, fadeOut));
          if (l > 6.5) { c.removeFromParent(); cards.splice(i, 1); }
        }
      },
    };

    /* ============================================================
       procedural set
       ============================================================ */
    function buildProcedural(root) {
      const plinth = box(4.6, 0.14, 4.2, M.concreteD);
      plinth.name = "plinth";
      plinth.position.set(0, -0.07, -0.5);
      root.add(plinth);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(4.64, 0.02, 4.24), M.brass);
      trim.position.set(0, -0.135, -0.5);
      root.add(trim);

      const plaqueTex = canvasTexture(512, 96, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#d4af37"); grad.addColorStop(1, "#8f7620");
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
        g.fillStyle = "#241c08"; g.textAlign = "center";
        g.font = "600 28px 'IBM Plex Mono', monospace";
        g.fillText("EXHIBIT VIII — THE BONFIRE", w / 2, 42);
        g.font = "21px 'IBM Plex Mono', monospace";
        g.fillText("A SCHOOLYARD, 1954", w / 2, 74);
      });
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 0.16),
        new THREE.MeshStandardMaterial({ map: plaqueTex.tex, roughness: 0.4, metalness: 0.6 })
      );
      plaque.position.set(0, 0.02, 1.502);
      plaque.rotation.x = -0.5;
      root.add(plaque);

      /* yard */
      const ground = box(4.2, 0.08, 3.6, M.asphalt);
      ground.name = "ground";
      ground.position.set(0, 0.04, -0.5);
      root.add(ground);

      /* school wall */
      const wall = box(4.2, 2.5, 0.18, M.brick);
      wall.name = "school_wall";
      wall.position.set(0, 1.25, -2.24);
      root.add(wall);
      const base = box(4.2, 0.35, 0.22, M.brickD);
      base.position.set(0, 0.25, -2.24);
      root.add(base);
      /* two dark windows */
      [-1.15, 1.15].forEach((x, i) => {
        const frame = box(0.8, 1.0, 0.08, M.brickD);
        frame.position.set(x, 1.55, -2.15);
        root.add(frame);
        const pane = box(0.68, 0.88, 0.04, M.glass);
        pane.position.set(x, 1.55, -2.11);
        root.add(pane);
        const mull = box(0.03, 0.88, 0.05, M.brickD);
        mull.position.set(x, 1.55, -2.09);
        root.add(mull);
      });
      /* door */
      const door = box(0.75, 1.45, 0.08, M.crateD);
      door.position.set(0, 0.72, -2.13);
      root.add(door);

      /* the notice */
      const noticeTex = canvasTexture(300, 400, (g, w, h) => {
        g.fillStyle = "#ded3b4"; g.fillRect(0, 0, w, h);
        for (let k = 0; k < 260; k++) {
          g.fillStyle = "rgba(90,70,40," + Math.random() * 0.1 + ")";
          g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        g.strokeStyle = "#241a0e"; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
        g.fillStyle = "#7e1408"; g.textAlign = "center";
        g.font = "900 40px Georgia";
        g.fillText("NOTICE", w / 2, 62);
        g.fillStyle = "#241a0e";
        g.font = "700 25px Georgia";
        g.fillText("PROTECT OUR", w / 2, 118);
        g.fillText("YOUTH", w / 2, 150);
        g.fillStyle = "#241a0e"; g.fillRect(48, 172, w - 96, 3);
        g.font = "400 21px Georgia";
        g.fillText("SURRENDER ALL", w / 2, 214);
        g.fillText("CRIME & HORROR", w / 2, 244);
        g.fillText("COMIC BOOKS", w / 2, 274);
        g.font = "italic 400 18px Georgia";
        g.fillText("Assembly: 7 o'clock", w / 2, 322);
        g.fillText("in the yard", w / 2, 348);
      });
      const notice = new THREE.Mesh(
        new THREE.PlaneGeometry(0.46, 0.62),
        new THREE.MeshStandardMaterial({ map: noticeTex.tex, roughness: 0.9 })
      );
      notice.name = "poster_notice";
      notice.position.set(-0.62, 1.28, -2.14);
      notice.rotation.z = -0.025;
      root.add(notice);

      /* ---------- the fire ---------- */
      const pit = new THREE.Group();
      pit.name = "fire_pit";
      pit.position.set(0, 0.08, -0.35);
      root.add(pit);

      const ashBed = new THREE.Mesh(new THREE.CircleGeometry(0.62, 20), M.ash);
      ashBed.rotation.x = -Math.PI / 2;
      ashBed.position.y = 0.005;
      ashBed.receiveShadow = true;
      pit.add(ashBed);

      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2;
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.05), M.stone);
        s.position.set(Math.cos(a) * 0.6, 0.04, Math.sin(a) * 0.6);
        s.rotation.set(Math.random(), Math.random(), Math.random());
        s.castShadow = true;
        pit.add(s);
      }
      /* charred logs */
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI + 0.4;
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.8, 8), M.char);
        log.rotation.set(0, a, Math.PI / 2 - 0.22);
        log.position.set(Math.cos(a) * 0.12, 0.12, Math.sin(a) * 0.12);
        log.castShadow = true;
        pit.add(log);
      }

      /* flames: additive cones that breathe */
      const flameGroup = new THREE.Group();
      flameGroup.name = "fire_flames";
      flameGroup.position.y = 0.1;
      pit.add(flameGroup);
      const flameSpecs = [
        [0, 0, 0.34, 0.85, 0xffcf5a],
        [-0.16, 0.08, 0.24, 0.62, 0xff9a2e],
        [0.17, -0.06, 0.26, 0.68, 0xff8420],
        [0.04, 0.17, 0.2, 0.5, 0xffd98a],
        [-0.09, -0.15, 0.18, 0.46, 0xff7a18],
      ];
      flameSpecs.forEach(([x, z, r, hgt, col]) => {
        const f = new THREE.Mesh(
          new THREE.ConeGeometry(r, hgt, 10, 1, true),
          new THREE.MeshBasicMaterial({
            color: col, transparent: true, opacity: 0.4,
            blending: THREE.AdditiveBlending, depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        f.position.set(x, hgt / 2, z);
        f.userData = { baseY: 1, baseX: 1, baseX0: x, baseZ0: z };
        flameGroup.add(f);
      });
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.17, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xfff0b8, transparent: true, opacity: 0.55,
          blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      core.position.y = 0.16;
      flameGroup.add(core);

      /* ---------- the crate of comics ---------- */
      const crate = new THREE.Group();
      crate.name = "crate";
      crate.position.set(-1.28, 0.08, 0.25);
      crate.rotation.y = 0.28;
      root.add(crate);
      /* shallow crate: deep walls just shadow their own contents */
      [[-0.3, 0], [0.3, 0]].forEach(([x]) => {
        const side = box(0.03, 0.2, 0.5, M.crate);
        side.position.set(x, 0.1, 0);
        crate.add(side);
      });
      [[0, -0.25], [0, 0.25]].forEach(([, z]) => {
        const end = box(0.6, 0.2, 0.03, M.crate);
        end.position.set(0, 0.1, z);
        crate.add(end);
      });
      const crateFloor = box(0.6, 0.03, 0.5, M.crateD);
      crateFloor.position.y = 0.02;
      crate.add(crateFloor);

      /* the pile — one mesh per comic, newest on top */
      const stackGroup = new THREE.Group();
      stackGroup.name = "comic_stack";
      stackGroup.position.set(0, 0.04, 0);
      crate.add(stackGroup);
      for (let i = 0; i < COMICS.length; i++) {
        const tex = coverTexture(i);
        const mat = new THREE.MeshStandardMaterial({ map: tex.tex, roughness: 0.9 });
        const side = new THREE.MeshStandardMaterial({ color: 0xd8caa4, roughness: 0.95 });
        const c = new THREE.Mesh(
          new THREE.BoxGeometry(0.3, 0.014, 0.44),
          [side, side, mat, side, side, side]
        );
        c.name = "comic_" + String(i + 1).padStart(2, "0");
        c.castShadow = true;
        c.receiveShadow = true;
        c.position.set((Math.random() - 0.5) * 0.04, 0.03 + i * 0.019, (Math.random() - 0.5) * 0.04);
        c.rotation.y = (Math.random() - 0.5) * 0.22;
        stackGroup.add(c);
        pile.push(c);
      }
      /* generous click zone over the crate */
      const crateHit = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, 0.7, 0.7),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      crateHit.position.y = 0.3;
      stackGroup.add(crateHit);

      /* ---------- Wertham's book on an upturned crate ---------- */
      const stool = box(0.4, 0.34, 0.34, M.crateD);
      stool.position.set(1.3, 0.25, 0.15);
      stool.rotation.y = -0.3;
      root.add(stool);
      const bookGroup = new THREE.Group();
      bookGroup.name = "wertham_book";
      bookGroup.position.set(1.3, 0.44, 0.15);
      bookGroup.rotation.y = -0.3;
      const bk = box(0.28, 0.05, 0.38, M.book);
      bookGroup.add(bk);
      const bookTex = canvasTexture(256, 340, (g, w, h) => {
        g.fillStyle = "#7a2b22"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "#e8ddc0"; g.lineWidth = 3;
        g.strokeRect(14, 14, w - 28, h - 28);
        g.fillStyle = "#e8ddc0"; g.textAlign = "center";
        g.font = "700 30px Georgia";
        g.fillText("SEDUCTION", w / 2, 90);
        g.fillText("OF THE", w / 2, 126);
        g.fillText("INNOCENT", w / 2, 162);
        g.font = "italic 400 18px Georgia";
        g.fillText("F. Wertham, M.D.", w / 2, 236);
        g.font = "400 15px Georgia";
        g.fillText("1954", w / 2, 268);
      });
      const jacket = new THREE.Mesh(
        new THREE.PlaneGeometry(0.26, 0.36),
        new THREE.MeshStandardMaterial({ map: bookTex.tex, roughness: 0.85 })
      );
      jacket.rotation.x = -Math.PI / 2;
      jacket.position.y = 0.026;
      bookGroup.add(jacket);
      root.add(bookGroup);

      /* a dropped comic nobody noticed, at the edge of the light */
      const strayTex = coverTexture(3);
      const stray = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.012, 0.44),
        [
          new THREE.MeshStandardMaterial({ color: 0xd8caa4, roughness: 0.95 }),
          new THREE.MeshStandardMaterial({ color: 0xd8caa4, roughness: 0.95 }),
          new THREE.MeshStandardMaterial({ map: strayTex.tex, roughness: 0.9 }),
          new THREE.MeshStandardMaterial({ color: 0xd8caa4, roughness: 0.95 }),
          new THREE.MeshStandardMaterial({ color: 0xd8caa4, roughness: 0.95 }),
          new THREE.MeshStandardMaterial({ color: 0xd8caa4, roughness: 0.95 }),
        ]
      );
      stray.name = "comic_stray";
      stray.position.set(0.95, 0.09, 0.95);
      stray.rotation.y = 0.9;
      stray.receiveShadow = true;
      root.add(stray);

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          [plaqueTex, noticeTex, bookTex].forEach((tx) => {
            tx.draw(tx.g, tx.canvas.width, tx.canvas.height);
            tx.tex.needsUpdate = true;
          });
        });
      }
    }
  },
});
