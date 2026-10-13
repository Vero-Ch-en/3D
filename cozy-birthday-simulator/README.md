# Cozy Birthday Simulator

A playable browser adaptation of the *Cozy Birthday Simulator — Comprehensive Game Design Bible* (v2.1).
It's a cozy relationship sim and walking sim that slowly turns into a mystery and then a psychological horror story, and it ends with a real birthday message from you.

It runs on plain HTML5 canvas and JavaScript. There's no build step, nothing to install and no external assets: all art and sound are generated in code.

## Playing it

- **Locally:** open `index.html` in a browser. Double-clicking it works. If your browser blocks local storage on `file://`, run `python3 -m http.server` in this folder and open `http://localhost:8000`.
- **Hosted:** any static host works, including GitHub Pages, Netlify or a plain web server. Upload the whole `cozy-birthday-simulator/` folder.
- **Length:** the first cycle takes about 30–45 minutes. The second, Echo cycle is shorter and leads to the canonical ending.

| Action | Keyboard | Touch |
|---|---|---|
| Walk / run | WASD or arrows / hold Shift | Drag on the left half (push further to run) |
| Interact, advance text | E, Space or Enter | **Use** button, or tap the text box |
| Be together (hug, hold hands, tease, kiss, talk) | Q | **♥** button |
| Choices | 1–4, arrows + Enter, or click | Tap |
| Pause / mute | Esc / M | **II** |

## Making it yours

Edit **`js/config.js`**. It's the only file you need to touch:

- `playerLabel` / `partnerLabel` are the dialogue name tags (defaults: "You" / "Partner").
- `nickForPlayer` / `nickForPartner` are the private nicknames ("giant" / "gremlin").
- `birthday.short` is shown after every ending. `birthday.full` is the full message, shown only after **The First Snow**. `birthday.signature` signs it.

The bible's rule is that the real birthday message is the one thing the Entity can't counterfeit, so write that one yourself.

## How the design bible maps to the game

| Bible section | In the game |
|---|---|
| §3–4 Relationship, physical closeness, adult intimacy | Banter written to the bible's examples. The **Together** menu (hug / hold hand / tease / kiss / talk) is always available near Partner. Intimacy stays non-explicit: at bedtime the "camera" politely drifts to the window, followed by an aftermath scene. |
| §5 Snowy first meeting / bookend | A playable prologue as children. The ending returns to the same place. |
| §6–8 Cozy house, interaction density | Bedroom, bathroom, hallway, kitchen, living room and the locked study, with dozens of interactable objects whose lines change on repeat visits (the fridge, the toothbrushes, the sofa stash, Basil the plant…). |
| §9 Partner AI | Needs-driven autonomy (social / curiosity / fear). Partner uses objects on their own, disappears into the study on "birthday business", leads, looks back, waits, double-taps you for attention, holds your hand, and fidgets when idle. Fear states change their distance and speech. |
| §10 Hidden variables and behavioural memory | Bond, trust, rivalry and fear are tracked but never shown. The game also records whether you wait, let them win, sit beside or across, open the fridge repeatedly, or comfort them. |
| §12 Rivalry | Flower contest, hill race (Partner moves the marker), stone skipping. |
| §13 Scrapbook | A physical scrapbook you can open. It fills with photos from your day, and later contains a photograph neither of you remembers taking. |
| §15 Horror escalation | Impossible snow patch → changed photo → third toothbrush → snow outside the bedroom window → the imitation → the world overlap. |
| §16–17 Entity rules, recognition, social stealth | The imitation only appears after a real separation and is never side by side with the real Partner. **No UI, label, music or camera cue ever reveals it.** The clues are behavioural only: no blanket-stealing, no fidgeting, no double-tap, and, most importantly, *certainty* about details neither of you actually remembers. Staring, confronting it, or running from it raises its hidden suspicion. |
| §18 Corruption and fairness | Corruption is causal, not random. It comes from sleeping beside the imitation, sitting at its fire, or adopting its false certainties. Being fooled once never dooms a run. |
| §19 Partner as co-protagonist | A playable **Partner-perspective** sequence, plus Partner rescuing you, catching you on the ice, and leaving you improvised signs. |
| §20 Echo Memory | A persistent save layer across cycles. Cycle 2 opens differently ("…again?"), Partner remembers your habits warmly, routines are compressed, and the Entity uses a flawless imitation. **Erase all echoes** is always available on the title screen. |
| §21 Quiet fourth-wall pressure | The title screen and its wording change after each ending. Nothing ever reads anything from your device. |
| §23–25 Climax, ending matrix, The First Snow | Seven endings: *You Found Me*, *Uncertain Morning*, *I Know It's You*, *The Perfect Partner*, *Stay Here*, and *The First Snow* (the canonical ending, reached on an Echo cycle), each with a short playable epilogue. Endings are never labelled good, bad or true. |
| §26 PC secret archive | See below (spoilers). |

**Adapted from the Unreal Engine 5.8 spec (§27–29):** the close third-person camera became a close top-down camera. Lumen, Niagara, StateTree and Smart Objects became a canvas renderer with dynamic lighting, procedural particles, a state-machine AI and "smart object" definitions. Audio is procedural Web Audio: a home theme that detunes as things go wrong, fire, wind, birds, and the three-note whistle.

## Debugging and previewing

Append `?debug=1` to the URL to expose `window.CBS` in the console. With debug enabled, you can also:

- `&chapter=night` jumps straight to a chapter. Options: `prologue`, `morning`, `walk`, `evening`, `campfire`, `bedtime`, `night`, `elsewhere`, `lastbirthday`, `echo_morning`, `echo_evening`, `echo_elsewhere`, `firstsnow`, `winter`, `ending_foundme`, and so on.
- `&speed=4` speeds up game time (up to 8×).

## Spoilers for the creator: the hidden layer

<details>
<summary>Open only if you want to know where the secrets are</summary>

- **The Entity's notes:** open the browser's developer console while playing. The Entity quietly logs observations about *how you play* (waiting, letting Partner win, holding on too long…). They're also stored locally under `cbs.entity.observations`. Different players get different notes.
- **The archive:** an HTML comment in `index.html` points at `archive/PAIR_00491.log`, which lists the other records: failed imitation tests, the reconstruction error that put a "third figure" in the snow, the self-model it archived, a base64 fragment, a rejected cycle, and finally `archive/why_491.txt`. The files in `archive/unsorted/` deliberately stay unresolved (§26.31).
- None of this is needed for any ending or for the birthday message.
</details>
