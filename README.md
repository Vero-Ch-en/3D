# Cozy Birthday Simulator

A birthday gift game built from the *Cozy Birthday Simulator* design bible: a cozy relationship sim that slowly turns into a gentle memory-horror story and ends with a personal birthday message.

| Folder | What it is | Status |
|---|---|---|
| `cozy-birthday-simulator/` | The full game: prologue, four acts, a second Echo cycle and seven endings. Top-down 2D, canvas and Web Audio. | Complete and playable end to end. |
| `demo-3d/` | A real-time 3D vertical slice in an Unreal-style look (three.js r128): one birthday evening in the house, ending at the first uncanny turn. | Demo, for deciding on the 3D direction. |

Both are static sites with no build step. Open `cozy-birthday-simulator/index.html` or `demo-3d/index.html`, or serve the folder with `python3 -m http.server`. To personalise names and the birthday message, edit `cozy-birthday-simulator/js/config.js`; details are in that folder's README.

three.js and its example post-processing modules are bundled under `demo-3d/lib/` (MIT licence, see `three.LICENSE`).
