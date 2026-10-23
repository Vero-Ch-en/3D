# Making the 3D game more realistic

Everything in `demo-3d` is built procedurally so the game runs with no
downloads. It is laid out so that each part can be replaced with real assets
later, without rewriting the game. This note lists the hooks and the
conventions a realistic asset needs to follow.

## Already realism-ready

- **Units and scale:** metres, y up, real proportions. The cabin is 15 × 7 m (it was 4.6 m deep; the back wall moved out 2.4 m with the furniture against it, so every room has space to walk round, plus a reading nook beside the hearth; `G.ZM` in core.js maps a position in the old layout to the new one),
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

Fitted on top of that, from each model's own measurements (life.js, `fitGear`):
- the hat comes down to just above the brows (the real eye line) and grows to cover the hair on top;
- the scarf rests on the long coat's front neckline, sized to the collar and riding up a little at the back;
- the coat's peaked sleeve heads are brought down onto a natural shoulder line;
- boots are sized to the body (a child's wellies stop below the knee);
- jumpers follow the hips, not the thighs, and their hems are let down a little (`fixTops`, people.js), so
  sitting doesn't pull them into a point or open a gap at the waist.

The exported hands lost most of their finger width when the meshes were simplified; `plumpFingers` (people.js)
pushes finger-weighted vertices out along their normals at load, and the relaxed hand closes the thumb toward
the index finger. Re-exporting the hands at full detail from the `.blend` would be the proper fix.

Hugs reach with two-bone IK on the model's own arm bones (`hugIK`, people.js): the taller one over the
shoulders, the other round the back, hands curled on the back.

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
- Holding hands, both holding arms reach for one point between the two of you (`holdIK`, on the same two-bone
  solver as the hug, `solveArm`), swinging a little with the stride, so the hands meet.
- Feet follow uneven ground (`plantFeet`): the hips come down for the lower foot and the other knee bends.
- Outdoors the wind presses the coat hems and makes them flutter (`G.swingCoat`).
- Turning on the spot takes small steps; brisk steps in fresh snow kick a little powder off the toes (`G.kickAt`).
- The real eyes are split into two eyeballs on pivots and turn toward what the character looks at, ahead of
  the head, with small saccades (`makeRealEyes`, `aimEyes`, people.js).
- The scarf's hanging end is a chain of five knitted segments with verlet physics (`G.simScarf`, life.js):
  gravity, the body's own motion, a little wind, kept in front of the chest. The player's pace is on a spring.
- Boot shafts ride the shin bone and flare for the calf; the coat's seams share skin weights so they don't open;
  the legs under the leggings are tucked a few millimetres so skin can't poke through.

### Motion capture and body language

- **Clips** (`js/mocap.js`, built by `tools/mocap/build_clips.js` from the CMU Motion Capture Database, free for any use):
  idle (82_08, 40_10, 40_11, 77_02), walk (16_15), seated (86_09), and two newer ones:
  - **talking** (18_08 + 19_08, a recorded conversation with hand gestures): eased in on whoever is speaking, at half
    strength, and softer when walking or sitting;
  - **laughing** (13_14): plays on lines like "Ha!" and when the narration mentions laughing.
  The BVH sources go in `tools/mocap/bvh/` (not committed); the existing clips came out of the rebuild unchanged.
- **Seated hands** no longer stay glued to the thighs: each person drifts between resting places (thighs, clasped in
  the lap, a hand on the knee) on their own slow timing. When talking, the conversation recording moves the forearms
  over that. The CMU sitting clips weren't used for the arms, because their hands are up at the face.
- **Blinking stops** when the imitation drops its act (`noBlink`).

### Camera and control

- **Cutscenes:** you can always look around. Drag, or hold Z / C, to turn the view up to about 80° from where the
  camera stands; it eases back a few seconds after you let go. You stay where the scene puts you.
- **Conversations that aren't staged:** you can keep walking, and the camera follows you instead of cutting to
  over-the-shoulder shots. Hugs, dances, minigames and the scrapbook still hold you in place.
- **Lying in bed:** pushing a movement key gets you up when the story allows it (`G.lieMove`).
- **Playing as Partner:** the two swap bodies where they stand (`swapPlaces`, game.js), so nothing moves on screen.
  A scene hands control back to him *before* it places anyone (the guarded `STATE.busy`, `G.say`, `G.cutTo`,
  `G.setShot` and `G.UI.choose`). Interactions in the house are done by her, where she stands.

### The house as the Entity wins

- The colour grading's memory tint (`uMem`) drains the colour as corruption and memories taken go up, in the night and
  in Act IV. At its worst the bed gets made perfectly. Scrapbook pages go blank, and one child is painted out of the
  hall photograph (`G.take`).

## Hats, scarves, gloves and boots (builds 59–60)

All made in Blender round each character's own body (`tools/winter_gear.py`, run after `tools/overcoat.py` on `cozy_characters_overcoats.blend`), skinned to the same skeleton, and added to `models/real/*.glb` by `tools/patch_gear.js` (which also replaces the coat). The old built-in hat, scarf ring and boots stay in the game but hidden (`userData.replaced`).
- **Beanies:** shaped on the skull with room for the hair, the brim just above the brows and low at the back, a turned-up cuff; hers has a bobble. Knit ribs run round the head. Her hair is tucked to the new hat's real shape.
- **Scarves:** wrapped twice round the neck on the coat's collar, with two flat ends hanging down the chest (one longer), laid over the coat and clear of the lapels and buttons. The wraps follow the neck and chest; the ends take the coat's own weights.
- **Gloves:** knitted, a layer over each hand with the hand's own finger weights (so they curl with the fingers), and a ribbed cuff that goes up under the sleeve.
- **Boots:** built in slices round the foot and lower leg to mid-calf, with a flat sole a little wider than the foot. His are dark leather; hers are tan suede with a fleece cuff (vertex colours, converted to linear in the patch).
- **Build 60:** his beanie sits higher, over the tops of his ears instead of down over them; the gloves have a little more room round the base of the thumb; and when sitting only the front of the coat lies on the lap (with the thighs) while the sides hang from the hips, and the coat-tail springs no longer swing the skirt; before, the whole skirt lifted into a dome over the lap.
- **Coat fixes:** pocket flaps and buttons move as one piece (no spike at the hip when sitting), and the turn-back cuffs are weighted from the sleeve only.
- **Loading:** a body that arrives after the loading screen gives up is now fitted and dressed as soon as it's measured (before, his outdoor clothes could stay unfitted).

## Wool overcoats (builds 57–58)

- **Tailored** (build 57, `tools/overcoat.py`, always starting again from the original coats kept as `backup_coat_*`): the coat body is fitted to the jumper's torso and the sleeves to its arms (1.5 / 1.2 cm ease), so the body no longer wraps round the arms. The front closes with an overlap, the back seam is welded, the collar sits over the jumper's neckline, the cuffs reach just past the wrist and the sleeve heads tuck under the shoulders. Weights above the hips copy the jumper's own, so coat and jumper bend together.
- **Skirt:** an even A-line from the hips (no ledge, no curving in under the seat), clear of the legs. The front and sides follow the thighs (it lies on the lap when sitting, opens with the stride); the back hangs from the hips and the coat-tail springs; under the knee it drapes with the shin.
- **Overcoat details** (build 58): a V opening with notched lapels, a turned-down collar, three dark horn buttons, two flap pockets at the hips, turn-back cuffs, and 6 mm of wool thickness (3.5 mm on the details), all skinned like the coat under them. Each coat is now about 4,800 vertices / 9,600 triangles.
- **In the game:** `tools/patch_overcoat.js` swaps the coat mesh in `models/real/*.glb` (and the embedded copies in `js/models_real.js`) for the export, with UVs (30 cm a tile) and vertex colours. The coat material uses a new wool texture (`TX.wool`, a fine melton with a faint twill; `TX.woolB` for the bump) instead of the jersey, with vertex colours on for the buttons. The old runtime shoulder fold in `life.js` is off (`window.COAT_FOLD` brings it back).
- **Blender files** (CozyCharacters folder on the user's Desktop): `cozy_characters_overcoats.blend` has the finished overcoats; `cozy_characters_coats_tailored.blend` the tailored stage. Earlier files and the originals are untouched.
- **Hair under the hat:** pressed further in (to 84% of the crown), so her bun no longer shows through the back.

## Winter clothes fitted (builds 54–56)

- **Coats refitted in Blender** (`tools/coats.py`, `fit_coat`): each coat is drawn in to sit about 1.6 cm off the jumper and body (1.2 cm on the sleeves), relaxed like cloth, with the skirt's flare kept below the hips and the front seam welded. Same vertices, so the skin weights still hold. The fitted positions are patched into `js/models_real.js` and `models/real/*.glb`.
- **Blender files** on the user's PC (CozyCharacters folder): `cozy_characters_coats_fit.blend` holds the fitted coats, with hidden `backup_coat_*` copies of the old ones; the exports are in `export_fit\`. The original `.blend` files are untouched (`cozy_characters_before_fit_session.blend` is the earlier state).
- **Hair under the hat:** her bun is pressed inside the hat while it's on (`tuckUnderHat` in `js/life.js`) and restored when it comes off, instead of poking through.
- **Hair under the hat (55):** all hair above the brim is pressed inside the crown (his too), fitted to the crown and brim only so nothing pokes through the bobble. The brim sits a little lower on the forehead.
- **Sleeves re-skinned (56):** the sleeves used to be weighted mostly to the hips and chest, so they stayed behind when the arms moved (his showed the jumper through, with a web from armpit to wrist). They are now weighted from the arm bones themselves (`weight_sleeves` in `tools/coats.py`): upper arm, a smooth hand-over to the forearm at the elbow, a little hand at the cuff, and the sleeve head shared with the shoulder and chest. Tested in Blender with arms out and reaching forward. Copied into the game's models by matching vertices (`JOINTS_0`/`WEIGHTS_0`).
- **Blender file:** the session's working copy is now `Downloads\\cozy_characters_coats_fit.blend` (the file that was open in Blender); the Desktop copy has the build-55 coats.
- **Scarf:** the loose tail hangs straight down the chest and lies against the coat. The body's forward is measured from the chest bone to the scarf root, because the rig's bone axes don't point forward (that had swung her tail out sideways).

## Stand-ins to replace later

These are deliberately cheap approximations, each in one place:

| Effect | Now | Realistic replacement |
| --- | --- | --- |
| Sunbeams | additive light shafts (`fx.js`, `buildSunbeams`) | volumetric lighting / froxel fog |
| Steam, breath, chimney smoke, snow puffs | sprites | particle system with lit, soft particles |
| Snowfall | point sprites | GPU particles with motion blur |
| Footprints, wet prints | instanced decals | deferred decals or a deformable snow height map |
| Windows | flat glow at night | interior mapping / real interior lighting seen through glass |
| Trees | near: spruces of separate drooping boughs with snow on their tops; far: low-poly cones; instanced | scanned or SpeedTree-style conifers with LODs |
| Fire | seven flame tongues at different depths and a bright core, a glowing coal bed, logs lit from below, a light that moves | flipbook or simulated fire with a light probe |
| Faces | procedural eyes, lids, lips | the model's own head with blend shapes |
| The Entity at the door | a pale translucent column with a head (`act4.js`) | a figure of drifting snow, shaped like a person |
| Hiding, the wrist grab | text only; hiding freezes you (`night.js`) | crouch and grip poses on the rigs |
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
