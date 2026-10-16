# Making the 3D game more realistic

Everything in `demo-3d` is built procedurally so the game runs with no
downloads. It is laid out so that each part can be replaced with real assets
later, without rewriting the game. This note lists the hooks and the
conventions a realistic asset needs to follow.

## Already realism-ready

- **Units and scale:** metres, y up, real proportions. The cabin is 15 × 4.6 m
  with 2.7 m walls; the characters are 1.84 m and 1.60 m tall.
- **Lighting:** physically based materials (`MeshStandardMaterial`), physically
  correct light units, ACES tone mapping, sRGB output, image-based lighting
  from environment maps (sunset, night, day outside, a warm room inside),
  shadow maps, SSAO on Epic.
- **Time of day:** one set of blended values (`STATE.day`, `STATE.tod`)
  drives sky, sun, fog, exposure, window glow and lamps, so a physical sky or
  baked lighting can be dropped in as another set.
- **Sound:** sources are placed in the world (fire, fridge, clock, windows,
  kettle) and heard through HRTF panners from the camera, muffled through
  walls. Recorded audio can replace each procedural source one at a time.
- **Story and content:** dialogue, interactions, reactions and smart objects
  live in `js/story.js` and refer to places by coordinates and ids, not to how
  anything looks.

## The asset manifest (`js/assets.js`)

List a real asset in `G.ASSET_MANIFEST` and it replaces the procedural one;
anything not listed stays procedural.

```js
props: {
  kettle:   { url: 'models/props/kettle.glb' },
  armchair: { url: 'models/props/armchair.glb', scale: 1 },
},
textures: {
  floor: { map: 'textures/oak_albedo.jpg', normalMap: 'textures/oak_normal.jpg',
           roughnessMap: 'textures/oak_rough.jpg', repeat: [2, 2] },
},
characters: {
  partner: { url: 'models/partner.glb', fit: true, keepMaterials: true, hideProcedural: 'all' },
},
```

Assets load before the world is built, behind the loading screen, so they are
compiled in the shader warm-up like everything else.

### Props

Slots that accept a model today: `kettle`, `armchair`, `chair` (all three
kitchen chairs), `clock`. New props should be added with
`G.propSlot(id, x, y, z, rotationY, buildFn)` or `G.propify(id, group)`.

Conventions for prop models:

- glTF 2.0 (`.glb`), metres, y up.
- Origin on the floor at the centre of the object's footprint; front faces +z.
- Fit the existing footprint. Colliders and interaction points are defined
  separately (in `interior.js` / `story.js`), so a model that is much larger or
  smaller than the procedural one needs those numbers changed too.
- Real PBR materials (base colour, normal, roughness/metalness). Keep texel
  density consistent across props, roughly 512–1024 px per metre.

### Textures

Any named material in `G.MAT` can take a texture set: `floor`, `boards` (the
interior walls), `logs` (the outside walls), `stone`, `shingle`, `snow`,
`plaid`, `knitCream`, `linen`, `rug`, `sofa`, `wood`, `darkWood`, and others.
A normal map replaces the painted bump map.

### Characters

The characters are animated by a procedural rig (hips, spine, chest, neck,
head, arms, legs) in `js/people.js`. A skinned model is driven by copying each
rig joint's motion onto the matching bone.

- Bone names are matched automatically for common rigs: Mixamo
  (`mixamorig:Hips`, `LeftArm`, `LeftForeArm`, `LeftUpLeg`…), Rigify / MPFB
  (`upperarm.L`, `forearm.L`, `thigh.L`, `shin.L`…) and similar. Left and
  right are worked out from where each bone actually sits.
- `fit: true` scales the model to the character's height.
- `keepMaterials: true` keeps the model's own materials (skin, hair, clothes)
  instead of the game's knit and jersey.
- `hideProcedural: 'all'` hides the procedural face and hair too. Use it when
  the model has its own head.
- Export in a relaxed A-pose or T-pose with the feet on the ground at the
  origin, facing +z.

The realistic MPFB characters are in `models/real/partner.glb` and
`models/real/player.glb`, made in Blender by `tools/game_export.py` on the
`claude/character-models` branch (`prepare()`, `optimise()`, `export_all()`).
They are compressed with meshopt geometry and WebP textures; `lib/meshopt_decoder.js`
decodes them. **To change a character, edit the `.blend` and export again;
don't edit the GLB.** `js/models_real.js` holds the same two files as base64,
for hosts that can't serve `.glb`. They're stored decompressed (`node tools/unmeshopt.js`)
so they load without WebAssembly. Regenerate it after a new export. Stats shows
which body each character got. The
children keep the built-in bodies.

Outdoor clothes are fitted to whatever body is loaded. `people.js`
(`measureFit`) measures the model in its rest pose. `life.js` (`fitGear`) then
uses those measurements to:
- widen each sleeve to clear its arm;
- flare the coat hem over the thighs and centre the coat on the body;
- set the hat on that skull and over the hair;
- move the scarf to the collar and size the boots to the feet.

The adults' long wool coats are real meshes in the models (`tools/coats.py` on the
`claude/character-models` branch: `make_coat()` builds each round its character's body and jumper,
`skin_coat()` weights it — upper coat like the body, never the arms; the skirt split front and back,
each half blending from the hips onto its own thigh and a spring bone, `coat_L` / `coat_R`). In the game
`setDressed` swaps the built-on coat for them, they take the game's wool, and `G.swingCoat` (people.js)
swings the tails so they trail, swing out on turns and settle when you stop. Hat, scarf and boots stay
built-on; the boots are sized from each model's own feet and ride its foot bones.

The children in the prologue are child copies of the same characters
(`models/real/kid_*.glb`, embedded in `js/models_kids.js`), made by `make_kid()`,
`kid_figure()` and `export_kids()` in `tools/game_export.py`; their bobble hats
and scarf are fitted the same way (`fitKid`).

The model's own jumper is hidden while the coat is on. The real heads have no blink shapes, so each eye
gets a skin-coloured lid (`makeRealLids` in people.js) on the head bone, shown while the eyes are shut: in
blinks, dozing, hugs. Hats and the snow on them are handed to the model's own head bone after fitting
(`toHeadBone` in life.js), so they stay on when the head turns. Blend-shape blinks from the `.blend` would be better.

### Motion smoothing

- The neck and head ride a critically damped spring toward their pose (`springHead`, people.js), so a new look-at,
  a glance, a doze or a hug eases in and out instead of snapping; a target behind keeps the same shoulder.
- Pose weights (arm poses, holding hands, swaying, the hug) use `G.spring` (core.js) instead of plain damping,
  so they start gently. Sitting down and getting up take about a second, eased, with the chest going forward
  over the feet half-way.
- Turning on the spot takes small steps.
- The scarf's hanging end is a chain of five knitted segments with verlet physics (`G.simScarf`, life.js):
  gravity, the body's own motion, a little wind, kept in front of the chest. The player's pace is on a spring.
- Boot shafts ride the shin bone and flare for the calf; the coat's seams share skin weights so they don't open;
  the legs under the leggings are tucked a few millimetres so skin can't poke through.

## Stand-ins to replace later

These are deliberately cheap approximations, each in one place:

| Effect | Now | Realistic replacement |
| --- | --- | --- |
| Sunbeams | additive light shafts (`fx.js`, `buildSunbeams`) | volumetric lighting / froxel fog |
| Steam, breath, chimney smoke, snow puffs | sprites | particle system with lit, soft particles |
| Snowfall | point sprites | GPU particles with motion blur |
| Footprints, wet prints | instanced decals | deferred decals or a deformable snow height map |
| Windows | flat glow at night | interior mapping / real interior lighting seen through glass |
| Trees | procedural cones, instanced | scanned or SpeedTree-style conifers with LODs |
| Fire | animated flame planes | flipbook or simulated fire with a light probe |
| Faces | procedural eyes, lids, lips | the model's own head with blend shapes |
| Hair | alpha-tested cards | the model's hair cards or strands |
| Radio music, humming, sound effects | synthesised in `game.js` (`G.Audio`) | recorded audio through the same placed sources |
| Gerald (the bullfinch) | primitive shapes (`fx.js`) | a small rigged bird with a few animation clips |
| Front door | hinged box, swings by proximity | modelled door with the same pivot (`G.FRONT_DOOR`) |
| Outdoor clothes | coat, hat, scarf and boots built over the body (`life.js`, `buildGear`) | clothing on the character model, swapped by a visibility flag |
| Snow on shoulders, frost | small snow caps; a frosted overlay drawn on a canvas | snow accumulation in the cloth shader; lens frost post-effect |
| Snowman, snow angels, the summer circle | spheres, decals, instanced tufts and flowers (`play.js`, `walk.js`) | sculpted snow, deformable snow, scanned grass and flowers |
| Props in hands (book, mug, logs, watering can) | attached to the chest or hand of the procedural rig | attached to hand bones of the model with proper grips |

## Performance budget

Measured on the current build: about 200 draw calls and 0.55 M triangles on
High; under 2 M triangles on Epic outdoors; no shaders compiled mid-game.
Realistic assets should keep draw calls down (static meshes are merged per
material and area by `G.mergeStatic`, so share materials where possible) and
come with LODs for anything seen from far away.
