# Cozy Birthday Simulator

A birthday gift game built from the *Cozy Birthday Simulator* design bible: a cozy relationship sim that slowly turns into a gentle memory-horror story and ends with a personal birthday message.

| Folder | What it is | Status |
|---|---|---|
| `cozy-birthday-simulator/` | The full game: prologue, four acts, a second Echo cycle and seven endings. Top-down 2D, canvas and Web Audio. | Complete and playable end to end. |
| `demo-3d/` | The 3D version, art-directed after the reference frames: a snowy log cabin in the pines (bedroom, living room, kitchen and a locked study), daylight, sunset and a starry night, and the two characters as rigged meshes built in Blender. The 2D story is being ported act by act, reshaped around the first snow day of winter rather than the birthday alone (Partner keeps the birthday a secret until the evening): the prologue at a lantern fair, the snowed-in morning (bed, pancakes, breakfast, with choices), then the evening at home. Shot-based camera (over-the-shoulder cuts, low two-shots, rear tracking, depth of field). | Porting in progress: Act I's morning is in; the winter walk comes next. |

Both are static sites with no build step. Open `cozy-birthday-simulator/index.html` or `demo-3d/index.html`, or serve the folder with `python3 -m http.server`. To personalise names, nicknames and the birthday message, edit `cozy-birthday-simulator/js/config.js`; details are in that folder's README. In the 3D version the two of them call each other “Partner” (`callPlayer` and `callPartner` in the same file). The 3D demo reads that file when the two folders sit side by side, and shows the full message on its closing card. (`demo-3d/js/config.js` holds fallback values for hosting the 3D folder on its own.)

In the 3D demo, E interacts and Q opens Together (hug, hold hands, tease, kiss, talk). Esc (or the II button) pauses, with volume, mute (M), a reduced camera motion option and the scrapbook. The game saves at the start of each chapter; Continue on the title screen picks up from there.

three.js and its example post-processing modules are bundled under `demo-3d/lib/` (MIT licence, see `three.LICENSE`).

## Rebuilding the character models

The character bodies are built procedurally in Blender by `demo-3d/tools/build_characters.py`, which exports `demo-3d/models/*.glb` and embeds them in `demo-3d/js/models.js`, so the page also runs straight from disk. To rebuild them:

```
python -m venv bl && bl/bin/pip install bpy
bl/bin/python demo-3d/tools/build_characters.py
```
