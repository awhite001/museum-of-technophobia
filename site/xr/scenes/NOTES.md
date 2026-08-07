# Scene art pipeline — Blender ↔ the diorama engine

How to replace a scene's procedural set with a Blender-refined one, without
touching any code. Currently applies to the Y2K bunker (`y2k.js`); future
scenes will follow the same pattern.

## The loop

1. **Export the current set**: open the scene in a browser, open the console,
   run `__bunker.exportGLB()`. A `y2k-export.glb` downloads — exact geometry,
   positions, and (crucially) node names.
2. **Refine in Blender**: import the GLB, make it beautiful (guidance below).
3. **Drop it back**: export as `y2k.glb` into this folder (`xr/scenes/`),
   hard-refresh the page. The scene auto-detects the file and uses it;
   console logs `Bunker: loaded y2k.glb`. Delete/rename the file to fall
   back to the procedural set. `__bunker.usedGLB` tells you which one is live.

**⚠ The GLB is a full-set REPLACEMENT, not a patch.** If the file exists,
the procedural bunker is not built at all — whatever the GLB contains is the
entire room. Always export the whole scene (bunker_root and everything in
it, plus your additions). If you use "Selected Objects", select everything
first; exporting just one new prop gives you a diorama of one prop in a void.

## The naming contract

Interactions and effects bind to nodes **by name**. Rename or delete a node
and its behavior silently disappears (nothing crashes). Everything else —
geometry you add, decor, detail meshes — is free-form; unrecognized nodes are
just scenery.

| Node name          | What the code does with it |
|--------------------|----------------------------|
| `crt`              | Click target: starts the countdown / rewinds history |
| `crt_screen`       | Its material is **replaced at runtime** with the live terminal texture |
| `door`             | Click target: clank + spins the wheel |
| `door_wheel`       | The part that spins (child of `door`) |
| `can_01` … `can_NN`| Click target: wobble + clink. Any name matching `can_*` works; add as many as you like |
| `radio`            | Click target: static burst |
| `lamp`             | Sways; click target: nudge. **Pivot/origin must be at the ceiling mount** — it rotates around its origin |
| `lamp_bulb`        | The code parents a real PointLight to it (flicker, blackout). Keep its material emissive if you want the glass to glow |
| `plinth`, `wall_*`, `room_floor`, `ceiling`, `shelf`, `desk`, `newspapers`, `poster_calendar`, `poster_checklist`, `flashlight`, `jug_1`, `jug_2` | Scenery only — safe to rework freely, names kept for orientation |

Pivot rules of thumb: `lamp` rotates at its origin (ceiling mount),
`door_wheel` spins around its own X axis, cans wobble around their origin
(keep it at the can's base center).

## Lighting: what to bake, what to leave alive

**The blackout is the exhibit.** At midnight every light goes to zero for ~2
seconds. If the room's lighting is fully baked into lightmaps, the room can't
go dark and the whole joke dies. So:

- **Bake**: ambient occlusion and indirect bounce into the base color / AO
  maps. Corner darkening, contact shadows under the cans, grime, water
  stains — this is where Blender will add the most.
- **Do NOT bake**: direct lighting from the hanging bulb, or any overall
  room illumination. The code owns three live lights (hanging bulb point
  light, cool museum fill spot, green CRT glow) and animates them — flicker
  during the countdown, zero at midnight, staggered restore after.
- Any lights you leave in the Blender file are **stripped on load** (the code
  assumes they were for previewing). Light the Blender viewport however you
  like; it won't leak through.

## Materials & textures

- Principled BSDF only — it maps cleanly to glTF metallic-roughness.
  No procedural shader nodes survive export; bake them to textures.
- `crt_screen` keeps whatever UV layout you give it, but the live texture is
  drawn on a 512×400 canvas (≈4:3). A simple planar unwrap of the screen
  face, roughly full-frame, is what you want. Slight curvature is fine.
- Texture budget: 1–2K maps, and aim for **≤ 3–4 MB total GLB** so the
  excavation stays fast on shared hosting.
- 90s posters / can labels: make originals (era-pastiche, invented brands)
  rather than sourcing real ones — real posters and logos are copyrighted
  and this site is public.

## Export settings (Blender → glTF)

- Format: **glTF Binary (.glb)**, filename `y2k.glb`, into `xr/scenes/`
- +Y up: leave enabled (default)
- Apply modifiers: on. Scale applied (Ctrl+A) before export — units are
  meters, the room is ~3.4 × 2.35 m and VR treats 1 unit = 1 m
- Materials: export, with images. Compression: **none for now** — Draco or
  meshopt need a decoder wired into the engine; ask Claude and it'll be
  vendored in a minute
- Include: selected objects or full scene, but keep the hierarchy parented
  the way the export gave it to you (names intact)

## Testing checklist after a swap

1. Console shows `loaded y2k.glb`, no red
2. Click the TV → countdown runs → blackout is actually dark → lights return
3. Cans clink, wheel spins, lamp sways
4. File size sane (Network tab), first paint under a few seconds

---

## Scene 2: The Print Shop (press.js / press.glb)

Same pipeline as the bunker: drop `press.glb` in this folder to replace the
whole procedural set (full-set swap, same warning as above). Export the
current set from the console with `__press.exportGLB()`.

Reserved names for the press scene:

| Name           | What the code does with it                                  |
|----------------|-------------------------------------------------------------|
| `press`        | Click target (whole group) — triggers the pull              |
| `press_hitbox` | Invisible generous click zone (keep or replace)             |
| `press_lever`  | Rotated on Y during the pull — pivot at the screw axis      |
| `press_platen` | Translated down/up 0.1m during the pull                     |
| `candle`       | Code attaches the flickering point light here; clickable    |
| `ink_balls`    | Clickable (squish + hint)                                   |
| `type_case`    | Clickable (rattle + hint)                                   |
| `pile_point`   | Empty/locator: printed sheets stack at its world position   |

Printed sheets are spawned by code with canvas textures (the headlines) —
they are not part of the GLB. Keep `press_lever`'s origin at the screw axis
and `press_platen`'s origin at its rest position, or the animation will
orbit strangely. The lever rests swung toward the viewer (rotation.y ≈ 1.15
in the procedural set); the code animates relative to whatever rest pose it
finds.
