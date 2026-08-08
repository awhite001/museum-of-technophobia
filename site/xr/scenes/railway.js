/* Diorama IV — The Railway Platform, 1866.
   A gas-lit halt at night. Pull the signal lever and the 11:42 comes
   through at thirty miles per hour, which physicians agree the human
   frame cannot survive. Stand your ground. Procedural set; drop a
   railway.glb beside this file to replace it (see NOTES.md). */

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createDiorama, reducedMotion } from "../diorama.js";
import * as sfx from "../audio.js";

const M = {
  stone:    new THREE.MeshStandardMaterial({ color: 0x6e675c, roughness: 0.95 }),
  stoneD:   new THREE.MeshStandardMaterial({ color: 0x50493f, roughness: 0.97 }),
  brick:    new THREE.MeshStandardMaterial({ color: 0x5e4436, roughness: 0.9 }),
  timber:   new THREE.MeshStandardMaterial({ color: 0x3d2f20, roughness: 0.85 }),
  ironGreen:new THREE.MeshStandardMaterial({ color: 0x2f4034, roughness: 0.6, metalness: 0.4 }),
  iron:     new THREE.MeshStandardMaterial({ color: 0x3c3f45, roughness: 0.5, metalness: 0.7 }),
  rail:     new THREE.MeshStandardMaterial({ color: 0x777d85, roughness: 0.35, metalness: 0.8 }),
  gravel:   new THREE.MeshStandardMaterial({ color: 0x36322c, roughness: 1.0 }),
  brass:    new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.35, metalness: 0.85 }),
  red:      new THREE.MeshStandardMaterial({ color: 0x8e2f22, roughness: 0.6 }),
  loco:     new THREE.MeshStandardMaterial({ color: 0x181a1c, roughness: 0.55, metalness: 0.35 }),
  car:      new THREE.MeshStandardMaterial({ color: 0x24211e, roughness: 0.7 }),
  window:   new THREE.MeshBasicMaterial({ color: 0xffd98a }),
  headlamp: new THREE.MeshBasicMaterial({ color: 0xfff2c8 }),
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

createDiorama({
  camera: {
    position: [2.2, 1.9, 5.6],
    target: [0, 0.7, 0.2],
    minDistance: 1.5,
    maxDistance: 11,
    minAzimuth: -1.1,
    maxAzimuth: 1.1,
    minPolar: 0.25,
    maxPolar: 1.5,
  },

  async build(ctx) {
    const { scene, makeInteractive, setHint, showCard } = ctx;
    /* night fog — far enough back that the set reads, close enough that
       the train has somewhere to come from */
    scene.fog = new THREE.Fog(0x0b0a09, 7, 24);

    const root = new THREE.Group();
    root.name = "halt_root";
    scene.add(root);

    const GLB_URL = new URL("./railway.glb", import.meta.url).href;
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
        console.info("Railway: loaded railway.glb (Blender set)");
      }
    } catch (e) { /* procedural below */ }

    if (!usedGLB) buildProcedural(root);

    const find = (n) => root.getObjectByName(n) || null;
    const lever = find("signal_lever");
    const leverArm = find("signal_lever_arm");
    const semaphore = find("semaphore_arm");
    const lampNode = find("gas_lamp");
    const train = find("train");

    /* ---------- lights ---------- */
    const hemi = new THREE.HemisphereLight(0x232733, 0x0b0a09, 0.34);
    scene.add(hemi);
    const fill = new THREE.SpotLight(0x9fb4c8, 24, 0, 0.6, 0.7, 2);
    fill.position.set(2.6, 3.6, 4.8);
    fill.target.position.set(0, 0.6, -0.6);
    scene.add(fill);
    scene.add(fill.target);

    const gasLight = new THREE.PointLight(0xffc37a, 14, 0, 2);
    gasLight.castShadow = true;
    gasLight.shadow.mapSize.set(1024, 1024);
    gasLight.shadow.bias = -0.004;
    if (lampNode) { lampNode.add(gasLight); gasLight.position.set(0, 2.18, 0); }
    else { gasLight.position.set(-1.2, 2.3, -0.8); scene.add(gasLight); }

    /* headlight travels with the locomotive */
    const headLight = new THREE.PointLight(0xfff2c8, 0, 9, 2);
    if (train) { train.add(headLight); headLight.position.set(-1.55, 0.75, 0); }

    /* ============================================================
       the 11:42
       ============================================================ */
    const state = { mode: "idle", t: 0, passes: 0 };
    const TRACK_Z = 0.95;
    const SPEED = 13.4;         /* 30 mph, medically inadvisable */
    const START_X = -26, END_X = 24;
    let rumble = null;
    let clackAcc = 0;

    function pullLever() {
      if (state.mode !== "idle") return;
      sfx.ensureAudio();
      if (!rumble) rumble = sfx.loop({ freq: 34, type: "sawtooth", gain: 0, noiseGain: 0, filterFreq: 140 });
      state.mode = "armed";
      state.t = 0;
      /* lever + semaphore motion handled in tick */
      sfx.tone({ freq: 200, slideTo: 90, dur: 0.35, type: "square", gain: 0.03 });
      /* distant two-tone whistle */
      setTimeout(() => {
        sfx.tone({ freq: 620, dur: 0.7, type: "triangle", gain: 0.02, attack: 0.06 });
        sfx.tone({ freq: 465, dur: 0.7, type: "triangle", gain: 0.016, attack: 0.06 });
      }, 900);
      setHint("Signal given. Something answers in the fog.");
    }

    if (lever) makeInteractive(lever, pullLever);
    const bench = find("bench");
    if (bench) makeInteractive(bench, () =>
      setHint("The bench is for passengers who prefer to be seated when derangement strikes.")
    );
    if (lampNode) makeInteractive(lampNode, () => {
      lampFlicker = 1.4;
      sfx.noise({ dur: 0.2, gain: 0.015, freq: 700, q: 0.7 });
      setHint("Gas. Perfectly safe, said the same physicians.");
    });

    setHint("The 11:42 is late. The signal lever is on the platform edge.");

    window.__railway = {
      pull: pullLever,
      state,
      usedGLB,
      exportGLB(download = true) {
        return new Promise((resolve, reject) => {
          new GLTFExporter().parse(root, (buf) => {
            if (download) {
              const blob = new Blob([buf], { type: "model/gltf-binary" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "railway-export.glb";
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
    let lampFlicker = 0;
    const leverRest = leverArm ? leverArm.rotation.x : 0;
    const semaRest = semaphore ? semaphore.rotation.z : 0;

    return {
      tick(dt, t) {
        /* gas lamp: nervous little flame */
        if (!reducedMotion) {
          gasLight.intensity = 10 + Math.sin(t * 9) * 0.8 + Math.sin(t * 21 + 2) * 0.5
            + lampFlicker * 5 * Math.random();
          lampFlicker = Math.max(0, lampFlicker - dt * 2);
        }

        if (state.mode === "armed") {
          state.t += dt;
          const k = Math.min(1, state.t / 0.6);
          if (leverArm) leverArm.rotation.x = leverRest + k * 0.55;
          if (semaphore) semaphore.rotation.z = semaRest - k * 0.7;
          if (rumble) rumble.setLevel(0.008 + k * 0.004, 0.3);
          if (state.t > 2.1) {
            state.mode = "passing";
            state.t = 0;
            if (train) train.visible = true;
            headLight.intensity = 16;
          }
        } else if (state.mode === "passing") {
          state.t += dt;
          const x = START_X + state.t * SPEED;
          if (train) train.position.set(x, 0, TRACK_Z);

          /* rumble and shake scale with proximity of the locomotive */
          const near = Math.max(0, 1 - Math.abs(x) / 16);
          if (rumble) {
            rumble.setLevel(0.012 + near * 0.05, 0.1);
            rumble.setNoise(near * 0.5, 0.1);
          }
          /* rail-joint clacks, faster-feeling as it gets close */
          clackAcc += dt;
          if (clackAcc > 0.22) {
            clackAcc = 0;
            sfx.noise({ dur: 0.05, gain: 0.01 + near * 0.035, freq: 220 + near * 300, q: 2 });
          }
          /* the whole halt trembles (desktop only; VR stays steady) */
          if (!reducedMotion && !ctx.renderer.xr.isPresenting) {
            root.position.y = near * Math.sin(state.t * 47) * 0.006;
            root.position.x = near * Math.sin(state.t * 31) * 0.004;
          }

          if (x > END_X) {
            state.mode = "settling";
            state.t = 0;
            state.passes++;
            if (train) train.visible = false;
            headLight.intensity = 0;
            root.position.set(0, 0, 0);
            if (rumble) { rumble.setLevel(0, 1.2); rumble.setNoise(0, 1.2); }
            /* wind tail */
            sfx.noise({ dur: 1.4, gain: 0.02, freq: 900, q: 0.3 });
          }
        } else if (state.mode === "settling") {
          state.t += dt;
          const k = Math.min(1, state.t / 1.2);
          if (leverArm) leverArm.rotation.x = leverRest + (1 - k) * 0.55;
          if (semaphore) semaphore.rotation.z = semaRest - (1 - k) * 0.7;
          if (state.t > 1.6) {
            state.mode = "idle";
            if (state.passes === 1) {
              showCard("SPINE: INTACT", 3400);
              setHint("Thirty miles per hour, point blank. The physicians will be disappointed.");
            } else if (state.passes === 3) {
              setHint("You may stop testing your nerves whenever you like. The railway won't.");
            } else {
              setHint("The next one is also on time. Pull when ready.");
            }
          }
        }
      },
    };

    /* ============================================================
       procedural set
       ============================================================ */
    function buildProcedural(root) {
      /* plinth */
      const plinth = box(5.2, 0.14, 4.6, M.concreteD);
      plinth.name = "plinth";
      plinth.position.set(0, -0.07, -0.3);
      root.add(plinth);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(5.24, 0.02, 4.64), M.brass);
      trim.position.set(0, -0.135, -0.3);
      root.add(trim);

      const plaqueTex = canvasTexture(512, 96, (g, w, h) => {
        const grad = g.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "#d4af37"); grad.addColorStop(1, "#8f7620");
        g.fillStyle = grad; g.fillRect(0, 0, w, h);
        g.fillStyle = "#241c08"; g.textAlign = "center";
        g.font = "600 30px 'IBM Plex Mono', monospace";
        g.fillText("EXHIBIT IV — THE RAILWAY", w / 2, 42);
        g.font = "22px 'IBM Plex Mono', monospace";
        g.fillText("COLDFIELD HALT, 1866", w / 2, 74);
      });
      const plaque = new THREE.Mesh(
        new THREE.PlaneGeometry(0.85, 0.16),
        new THREE.MeshStandardMaterial({ map: plaqueTex.tex, roughness: 0.4, metalness: 0.6 })
      );
      plaque.position.set(0, 0.02, 2.002);
      plaque.rotation.x = -0.5;
      root.add(plaque);

      /* platform: user stands here (top at y = 0) */
      const platform = box(5.0, 0.3, 2.6, M.stone);
      platform.name = "platform";
      platform.position.set(0, -0.15 + 0.15, -1.0);
      platform.position.y = -0.15;
      root.add(platform);
      /* raise: platform top should be y=0 → center -0.15, spans -0.3..0 */
      const edge = box(5.0, 0.06, 0.12, M.stoneD);
      edge.position.set(0, -0.03, 0.36);
      root.add(edge);

      /* track bed below and in front */
      const bed = box(5.0, 0.1, 1.7, M.gravel);
      bed.position.set(0, -0.35, 1.15);
      root.add(bed);
      [0.72, 1.28].forEach((z) => {
        const railMesh = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.07, 0.05), M.rail);
        railMesh.position.set(0, -0.265, z);
        railMesh.receiveShadow = true;
        root.add(railMesh);
      });
      for (let i = 0; i < 11; i++) {
        const sleeper = box(0.22, 0.06, 0.9, M.timber);
        sleeper.position.set(-2.35 + i * 0.47, -0.3, 1.0);
        root.add(sleeper);
      }

      /* station wall at the back */
      const wall = box(5.0, 2.3, 0.16, M.brick);
      wall.name = "station_wall";
      wall.position.set(0, 1.15, -2.3);
      root.add(wall);

      /* station sign */
      const signTex = canvasTexture(512, 112, (g, w, h) => {
        g.fillStyle = "#1c2b20"; g.fillRect(0, 0, w, h);
        g.strokeStyle = "#e8ddc0"; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
        g.fillStyle = "#e8ddc0"; g.textAlign = "center";
        g.font = "700 46px Georgia";
        g.fillText("COLDFIELD HALT", w / 2, 70);
      });
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(1.4, 0.3),
        new THREE.MeshStandardMaterial({ map: signTex.tex, roughness: 0.7 })
      );
      sign.name = "station_sign";
      sign.position.set(0.55, 1.72, -2.21);
      root.add(sign);

      /* warning poster */
      const posterTex = canvasTexture(300, 400, (g, w, h) => {
        g.fillStyle = "#ddd2b4"; g.fillRect(0, 0, w, h);
        for (let k = 0; k < 220; k++) {
          g.fillStyle = "rgba(90,70,40," + Math.random() * 0.12 + ")";
          g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
        g.strokeStyle = "#241a0e"; g.lineWidth = 4; g.strokeRect(10, 10, w - 20, h - 20);
        g.fillStyle = "#7e1408"; g.textAlign = "center";
        g.font = "900 44px Georgia";
        g.fillText("CAUTION", w / 2, 66);
        g.fillStyle = "#241a0e";
        g.font = "700 26px Georgia";
        g.fillText("RAILWAY SPEED", w / 2, 122);
        g.fillText("DERANGES", w / 2, 156);
        g.fillText("THE NERVES", w / 2, 190);
        g.font = "italic 400 19px Georgia";
        g.fillText("— The Medical Gazette", w / 2, 232);
        g.fillStyle = "#241a0e"; g.fillRect(40, 256, w - 80, 3);
        g.font = "700 30px Georgia";
        g.fillText("TRAVEL", w / 2, 310);
        g.fillText("BY HORSE", w / 2, 348);
      });
      const poster = new THREE.Mesh(
        new THREE.PlaneGeometry(0.5, 0.66),
        new THREE.MeshStandardMaterial({ map: posterTex.tex, roughness: 0.9 })
      );
      poster.name = "poster_caution";
      poster.position.set(-0.9, 1.35, -2.21);
      poster.rotation.z = 0.02;
      root.add(poster);

      /* bench */
      const bench = new THREE.Group();
      bench.name = "bench";
      bench.position.set(1.5, 0, -1.9);
      const seat = box(1.2, 0.05, 0.35, M.timber);
      seat.position.y = 0.45;
      bench.add(seat);
      const back = box(1.2, 0.4, 0.05, M.timber);
      back.position.set(0, 0.75, -0.17);
      bench.add(back);
      [[-0.5, 0], [0.5, 0]].forEach(([x]) => {
        const legIron = box(0.06, 0.45, 0.3, M.ironGreen);
        legIron.position.set(x, 0.225, 0);
        bench.add(legIron);
      });
      root.add(bench);

      /* gas lamp */
      const lamp = new THREE.Group();
      lamp.name = "gas_lamp";
      lamp.position.set(-1.95, 0, -1.55);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.1, 10), M.ironGreen);
      post.position.y = 1.05;
      post.castShadow = true;
      lamp.add(post);
      /* lantern as an open cage: four corner posts, so the flame shows */
      [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].forEach(([x, z]) => {
        const cagePost = box(0.022, 0.34, 0.022, M.ironGreen);
        cagePost.position.set(x, 2.2, z);
        lamp.add(cagePost);
      });
      const lanternFloor = box(0.26, 0.03, 0.26, M.ironGreen);
      lanternFloor.position.y = 2.03;
      lamp.add(lanternFloor);
      const glassGlow = new THREE.Mesh(
        new THREE.BoxGeometry(0.17, 0.26, 0.17),
        new THREE.MeshStandardMaterial({ color: 0xffe9b8, emissive: 0xffc37a, emissiveIntensity: 3 })
      );
      glassGlow.position.y = 2.2;
      lamp.add(glassGlow);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.14, 8), M.ironGreen);
      cap.position.y = 2.42;
      lamp.add(cap);
      root.add(lamp);

      /* signal lever on the platform edge — the verb */
      const lever = new THREE.Group();
      lever.name = "signal_lever";
      lever.position.set(0.5, 0, 0.1);
      const base = box(0.3, 0.1, 0.22, M.iron);
      base.position.y = 0.05;
      lever.add(base);
      const quad = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.16, 0.05, 12, 1, false, 0, Math.PI),
        M.iron
      );
      quad.rotation.z = Math.PI / 2;
      quad.rotation.y = Math.PI / 2;
      quad.position.y = 0.12;
      lever.add(quad);
      const arm = new THREE.Group();
      arm.name = "signal_lever_arm";
      arm.position.y = 0.12;
      const armRod = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.85, 8), M.iron);
      armRod.position.y = 0.42;
      armRod.castShadow = true;
      arm.add(armRod);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 8), M.red);
      grip.position.y = 0.86;
      arm.add(grip);
      arm.rotation.x = -0.35;
      lever.add(arm);
      root.add(lever);
      /* generous hitbox */
      const leverHit = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.3, 0.7),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
      );
      leverHit.position.set(0, 0.6, 0);
      lever.add(leverHit);

      /* semaphore signal by the track */
      const sema = new THREE.Group();
      sema.name = "semaphore";
      sema.position.set(2.45, -0.3, 1.15);
      const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 8), M.ironGreen);
      sPost.position.y = 1.0;
      sPost.castShadow = true;
      sema.add(sPost);
      const sArm = new THREE.Group();
      sArm.name = "semaphore_arm";
      sArm.position.y = 1.82;
      const blade = box(0.65, 0.12, 0.04, M.red);
      blade.position.x = -0.3;
      sArm.add(blade);
      const stripe = box(0.12, 0.12, 0.045, new THREE.MeshStandardMaterial({ color: 0xe8ddc0 }));
      stripe.position.x = -0.5;
      sArm.add(stripe);
      sema.add(sArm);
      root.add(sema);

      /* ---------- the train (hidden until summoned) ---------- */
      const train = new THREE.Group();
      train.name = "train";
      train.visible = false;
      /* locomotive */
      const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.7, 14), M.loco);
      boiler.rotation.z = Math.PI / 2;
      boiler.position.set(-0.8, 0.75, 0);
      train.add(boiler);
      const cab = box(0.9, 1.1, 0.95, M.loco);
      cab.position.set(0.35, 0.75, 0);
      train.add(cab);
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 10), M.loco);
      chimney.position.set(-1.35, 1.45, 0);
      train.add(chimney);
      const lampFace = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), M.headlamp);
      lampFace.rotation.y = -Math.PI / 2;
      lampFace.position.set(-1.66, 0.75, 0);
      train.add(lampFace);
      /* carriages with lit windows */
      for (let carIdx = 0; carIdx < 3; carIdx++) {
        const cx = 1.9 + carIdx * 2.3;
        const body = box(2.1, 1.05, 0.9, M.car);
        body.position.set(cx, 0.85, 0);
        train.add(body);
        for (let wIdx = 0; wIdx < 4; wIdx++) {
          const win = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.32), M.window);
          win.position.set(cx - 0.75 + wIdx * 0.5, 0.95, 0.46);
          train.add(win);
          const win2 = win.clone();
          win2.rotation.y = Math.PI;
          win2.position.z = -0.46;
          train.add(win2);
        }
      }
      /* wheels: dark cylinders, mostly implied in fog */
      for (let wx = -1.4; wx < 8.4; wx += 0.9) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 10), M.iron);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(wx, 0.24, 0.4);
        train.add(wheel);
      }
      train.position.set(-26, 0, 0.95);
      root.add(train);

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          [plaqueTex, signTex, posterTex].forEach((tx) => {
            tx.draw(tx.g, tx.canvas.width, tx.canvas.height);
            tx.tex.needsUpdate = true;
          });
        });
      }
    }
  },
});
