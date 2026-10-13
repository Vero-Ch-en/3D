# Cozy Birthday Simulator

A birthday gift game built from the *Cozy Birthday Simulator* design bible: a cozy relationship sim that slowly turns into a gentle memory-horror story and ends with a personal birthday message.

| Folder | What it is | Status |
|---|---|---|
| `cozy-birthday-simulator/` | The full game: prologue, four acts, a second Echo cycle and seven endings. Top-down 2D, canvas and Web Audio. | Complete and playable end to end. |
| `demo-3d/` | The 3D base for the game, art-directed after the reference frames: a snowy log cabin in the pines at sunset that turns to a starry night, a lit interior, and the two characters as rigged meshes built in Blender. It plays one short evening with a shot-based camera (over-the-shoulder cuts, low two-shots, rear tracking, depth of field). | Base build, for approving the look before porting the full game. |

Both are static sites with no build step. Open `cozy-birthday-simulator/index.html` or `demo-3d/index.html`, or serve the folder with `python3 -m http.server`. To personalise names and the birthday message, edit `cozy-birthday-simulator/js/config.js`; details are in that folder's README.

three.js and its example post-processing modules are bundled under `demo-3d/lib/` (MIT licence, see `three.LICENSE`).

## Rebuilding the character models

The character bodies are built procedurally in Blender by `demo-3d/tools/build_characters.py`, which exports `demo-3d/models/*.glb` and embeds them in `demo-3d/js/models.js`, so the page also runs straight from disk. To rebuild them:

```
python -m venv bl && bl/bin/pip install bpy
bl/bin/python demo-3d/tools/build_characters.py
```
