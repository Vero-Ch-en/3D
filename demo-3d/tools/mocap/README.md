# Motion capture clips

`js/mocap.js` holds the idle, walk and seated clips the characters move with, retargeted from the
**CMU Graphics Lab Motion Capture Database** (mocap.cs.cmu.edu — "the data is free for all uses"),
via the cgspeed BVH conversion at github.com/Shriinivas/cmubvh:

- idle: 82_08 (stand still), 40_10 and 40_11 (waiting for a bus), 77_02 (standing)
- walk: 16_15
- seated: 86_09 (sitting, looking around)

To rebuild: put those `.bvh` files in `tools/mocap/bvh/` (sparse-clone the repo above and unzip the
`Data/*.zip` for each), then `node build_clips.js ../../js/mocap.js`.

`retarget.js` matches limbs by direction (so the BVH's T-pose rest doesn't matter), the torso and head by
relative rotation, measures knees front-to-back only (this conversion kinks shins sideways), removes the
rest pose's bowed-head offset and calms the bus-stop head-turning. In the game (`people.js`) the
recording drives the upper body standing and walking, and the legs while walking; standing and seated
legs, look-at, poses, hugs and hand-holding stay the game's own, on top.
