# Cozy Birthday Simulator

A birthday gift game built from the *Cozy Birthday Simulator* design bible: a cozy relationship sim that slowly turns into a gentle memory-horror story and ends with a personal birthday message.

| Folder | What it is | Status |
|---|---|---|
| `cozy-birthday-simulator/` | The full game: prologue, four acts, a second Echo cycle and seven endings. Top-down 2D, canvas and Web Audio. | Complete and playable end to end. |
| `demo-3d/` | The 3D version, art-directed after the reference frames: a snowy log cabin in the pines (bedroom, living room, kitchen and a locked study), daylight, sunset and a starry night, and the two characters as rigged meshes built in Blender. Its story is a rewrite of the 2D one, no longer about a birthday: it is the first snow of winter, the anniversary of the night the two of them met at a lantern fair as children (the full plot is in `demo-3d/STORY.md`). Done so far: all of Act I: the prologue at the fair, the snowed-in morning (bed, pancakes, breakfast, with choices), the walk (a pinecone contest, a race up the hill, stones on the frozen lake, the summer circle) and the evening at home. Around the story the cabin is lived in: coats and boots by the door, the cold, a fire to keep fed from the woodpile, changing weather, Partner's own routines when you leave her be, and things to do together (snowmen, snow angels, cocoa, reading, cards, photographs). Shot-based camera (over-the-shoulder cuts, low two-shots, rear tracking, depth of field). | Porting in progress: Act I is in; Act II (the evening, something strange) comes next. |

Both are static sites with no build step. Open `cozy-birthday-simulator/index.html` or `demo-3d/index.html`, or serve the folder with `python3 -m http.server`. To personalise names, nicknames and the birthday message, edit `cozy-birthday-simulator/js/config.js`; details are in that folder's README. In the 3D version the two of them call each other “Partner” (`callPlayer` and `callPartner` in the same file). The 3D demo reads that file when the two folders sit side by side, and shows the full message on its closing card. (`demo-3d/js/config.js` holds fallback values for hosting the 3D folder on its own.)

In the 3D demo, E interacts, Q opens Together (hug, hold hands, tease, kiss, talk, and outdoors snowballs, snowmen and snow angels) and T takes a photograph (they go in the scrapbook and onto the fridge). Esc (or the II button) pauses, with volume, mute (M), a reduced camera motion option, subtitle size, rebindable keys and the scrapbook. The game saves at the start of each chapter; Continue on the title screen picks up from there.

The 3D version is built procedurally but is set up to take realistic models, textures and characters later through `demo-3d/js/assets.js`; `demo-3d/REALISM.md` explains how.

three.js and its example post-processing modules are bundled under `demo-3d/lib/` (MIT licence, see `three.LICENSE`).

## Rebuilding the character models

The character bodies are built procedurally in Blender by `demo-3d/tools/build_characters.py`, which exports `demo-3d/models/*.glb` and embeds them in `demo-3d/js/models.js`, so the page also runs straight from disk. To rebuild them:

```
python -m venv bl && bl/bin/pip install bpy
bl/bin/python demo-3d/tools/build_characters.py
```
