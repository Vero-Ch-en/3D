# Snowed In: the story (3D version)

This is the game as it stands (build 51). It keeps the shape of the 2D story: an ordinary shared day, something strange, an imitation, and a choice between a perfect day that never ends and real time that passes. It is not about a birthday. The anchor is **the first snow**, the night the two of them met.

## Premise

They met as children at a winter lantern fair, on the night of the first snow, when both of them wandered off from the crowd. Neither remembers much of it: snow, lanterns, somebody small sitting on a log. *He came over. That part, everyone agrees on.*

Every year, on the day of the first real snow, they keep a small tradition: a walk, a cake with one candle for every first snow in the cabin, paper lanterns on the porch, and the three-note whistle they made up at the fair, *if one of us gets lost* (slightly flat on the last one). They speak a little formally and warmly, with a lot of dry teasing underneath.

**What they call each other.** Both say **"my dearest"** or **"my dearest partner"**. He calls her **"my lovely partner"**, and she calls him **"my charming partner"**. Their morning greeting is "Hello, my dearest." / "Hello, my dearest." The imitation never uses these names. It says plain "Partner", or a flat "Hello." The names live in the config (`callBoth`, `callPartner`, `callPlayer`). They are lower case mid-sentence and capitalised at the start of a sentence.

**His real habits, shown early so the imitation can get them wrong.** At night he calls from the bedroom doorway and won't step onto the cold kitchen floor ("There's a line. This is the line."). He says the greeting back. He always waits for her.

The question underneath it all: they have forgotten almost everything about how they began, and it has never mattered. What if something offered to remember all of it for them, forever, as long as nothing ever changed again?

## Playing as Player or as Partner

You choose on the title screen ("Play as: Player / Partner"), and the game remembers it.
- **As Partner:** you control her in free time, and he follows you.
  - The prologue, morning, walk, evening, endings and The First Snow are narrated from her side (`js/narr_her.js`). The speaker labels turn round, and the scene choices are worded from her side: she steers what happens ("Keep him a little longer", "Let him give you his scarf").
  - Story scenes hand control back to him for their length.
  - Using things in the house is hers to do, where she stands.
- **Some chapters decide who you are:** dawn and Elsewhere are played as her; the night and Act IV as him.

## Act I · Shared Life

- **Prologue: the winter fair, as children.** The lantern man and a paper lantern, a bag of roasted chestnuts, the girl on the log ("Are you lost?" / "Is this seat taken?" "It's a log."). The chestnuts split exactly in half (she checks). He gives her his scarf, or not. Sky lanterns and a wish. She makes up the three-note whistle. "Will you be here tomorrow?" A promise, or a little finger.
- **Dawn, as her.** "Earlier. Before it was light." She gets up for a glass of water. He calls from the bedroom doorway, refuses the cold kitchen floor, says "Hello, my dearest" back, and waits in the doorway, hopping from foot to foot, until she's past him.
- **Morning.** Snowed in. The blanket (it's all on her side), "Hello, my dearest", pancakes, tea, breakfast with its choices, the house and its small stories. She keeps slipping into the locked study. An envelope on the table is marked "not yet".
- **The walk.** A pinecone contest in the meadow, a race up the hill to the bench, sliding stones on the frozen lake. Then the **summer circle**: a ring of green grass and wildflowers in the snow, warm air, and two sets of children's footprints stopping toe to toe. They go home hand in hand at sunset.

Around the story the cabin is lived in. It has a deeper 15 × 7 m layout with a window-seat nook. There are coats and boots by the door, cold if you stay out too long, a fire that burns down, and weather. She has her own routines: reading until she dozes, Basil the plant, the radio. Things to do together: snowball fights, a snowman, snow angels, cocoa, reading aloud, cards (there's a queen up her sleeve), and photographs on the fridge.

## Act II · Something Strange: the evening

- She hadn't forgotten what day it is: the cake, five candles, a wish.
- The empty frame in the hall now holds a photograph of two children in the snow. They compare what they remember (the scarf, the trees, the first thing said) and agree on almost nothing except the whistle.
- Nine paper lanterns on the porch. Her present: a snow globe of the night they met.
- Stars from the bench, then a firefly drifting through the falling snow. "It's the first snow, my dearest. There aren't any fireflies." "Inside. Please."

## Act III · Recognition: the night (played as him)

- **Bedtime, the real her.** "A good first snow?" Then hold, look at or kiss her. The plant line: "If I get up for water, don't steal my side." / "You don't recognise sides." / "…Touché. Goodnight, my dearest."
- **The night, the imitation.** You wake cold, and her side is empty. She comes back: "Couldn't sleep. Got water." She lies down exactly on her side. "Come back to sleep." Moving gets you up.
  - **Going back to sleep beside it** counts as giving in.
  - **Getting up:** it gets up and follows you. You can make cocoa, sit at the fire, sit in the window seat, raid the cake, tease it, or ask "Who are you?". It answers almost right. Agreeing with its certainties, or sitting at its fire, means it is convincing you.
  - **It becomes more obsessive the more it has convinced you:** "Don't go far." → "You keep looking at the door." → "You're mine to keep warm. Mine." At its worst it walks right up to you.
  - **Suspicion:** staring at it, running, or confronting it builds suspicion. At 3 the mask slips: the lights dip and it's right behind you, flat-voiced and unblinking, saying something it shouldn't know. You wake in bed an hour later, and a memory is gone. **The third slip leads to *Replaced*.**
  - **The real one's whistle** comes from the kitchen. It explains it away as "…Pipes. Old house." After two whistles, a door appears in the kitchen wall.
  - **Optional things to notice:** three mugs on the rack, the photo's third shape, snow inside the bedroom sill.
- **Elsewhere, as her.** Going through the door saves the game. "Earlier." Something in his shape walks all the way into the kitchen, barefoot. "Come back to bed, Partner." It answers her greeting with a flat "Hello." and leaves without waiting.
  - **It comes back looking for her.** It comes sooner and moves faster the more it convinced him earlier.
  - **She can hide** behind the window-seat curtain or in the study.
  - **If it catches her**, it grips her wrist ("There you are. Come back to bed."), takes a memory, and she slips away again later.
  - **If it catches her three times, it keeps her.** She lies back down beside it, and in Act IV she is out on the frozen lake instead of in the summer circle.
  - **Otherwise** she whistles at either kitchen window, leaves a sign (pinecones / a bitten pancake / a note), and walks out into the snow.

**What it takes.** A scrapbook page goes blank. The first time, one of the two children disappears from the hall photograph. The colour drains, and at its worst the bed is made perfectly. All of this counts towards the darker endings.

**The Entity's notes.** It logs what it learns about how you play (`G.observe`), in its own voice in the browser console, and keeps the last 80 in this browser. Act IV uses them.

## Act IV · The Last Birthday (played as him)

You wake at night in a house that's almost exactly right: lamps on, perfectly round pancakes, two mugs with the handles turned the same way, snow hanging still in the air.
- **The imitation's birthday for you.** It wakes you ("Weird dream, huh?"). You can talk to it and tease it: it turns its hat "the right way round" when it already was, offers to do yesterday again exactly the same, and answers the first-meeting question perfectly, which is the mistake. It explains the whistles away as "The kettle." Its present is a snow globe where the snow never settles.
- **Her trail**, never pointed out: a red mitten on the bottom porch step, one pinecone on the contest stump, three flat stones pointing west by the lake. Her sign from Elsewhere is in the kitchen.
- **Breakfast.** If your bond is high enough and you haven't given in much, she bursts in through the front door ("On your BIRTHDAY?"). Otherwise you reach *The Perfect Partner*. If it kept her, nobody comes, and you reach *Replaced*.
- **The bottom of the porch path.** "…You're still looking for them. I'm right here." When it's obsessive, it grabs your arm the first time. Going back with it twice while convinced leads to *Replaced*.
- **The reunion**, in the summer circle (or on the frozen lake if it kept her). You sit down together: how many of her things you found; "What was it like?"; "The floor is cold. That's when I knew."; the two sets of small footprints.
- **The walk home**, holding hands, with three conversations along the way.
- **The door in the meadow** only opens for two. The Entity speaks from what it observed about how you played ("You liked the fire. I kept it going all night."). "You could stay." Stay, or go home.

## Endings

None of them is labelled good or bad. The end card names the ending you reached, and the endings you've seen are remembered in this browser.
- **You Found Me:** an ordinary morning, holding on hard. Her three notes come from the kitchen, and you can whistle back.
- **Uncertain Morning:** the drying rack. Count the mugs. "…Did you get a new mug?"
- **I Know It's You:** the sofa and the scrapbook, with pages neither of you is sure about. "I'm choosing it anyway."
- **The Perfect Partner:** every day exactly right. Somewhere else, she sits in the last of the summer and whistles.
- **Stay Here:** the cake, the still snow, "Day 1. Day 2. Day 41. Day 412." With low bond, she leaves.
- **Replaced:** breakfast seen from outside, through the kitchen window. It sits in your place and speaks in your voice. You can knock, whistle (she pauses, and it puts its hand over hers), or say nothing.
- **The First Snow:** offered after any ending ("One more morning"). No Entity, just them. "Hello, my dearest" both ways, the first snow starting, tea going cold on the porch bench, "Do you remember how it started?", the three notes whistled back badly.

**Closing card** (config `closing`, not a birthday message). Heading: "Still here. Still us." Most endings show one line: "However it ended: somewhere, someone is still whistling three notes for you." The full message appears only after The First Snow:
> Somewhere there is a cabin in the snow, with two mugs on the drying rack. Only two.
> Someone always steals the blanket. Someone always stops at the kitchen door and complains about the floor.
> Neither of them remembers exactly how it started. It doesn't matter. They keep choosing it, one ordinary morning at a time.
> If you ever get lost, whistle. Three notes, slightly flat on the last one. Someone will come and find you.

## Testing aids

- **Chapter list:** on the title screen and in the pause menu. It covers every act, Elsewhere on its own, and each ending.
- **Story state panel:** in the pause menu. It shows bond, trust, corruption, suspicion, memories taken, whether it kept her, whether you slept beside it, and whether it withdrew.

## Still to do

- **Partner conversations:** rewrite the "Let him…" choices so that she says the line and he answers.
- **Restart points:** add them within the night and Act IV.
- **Poses:** proper poses for hiding and the wrist grab, and a snow figure for the Entity.
- **Night and Act IV as Partner:** possibly a full Partner route for these chapters (she wakes beside the imitation of him).
- **Playtest:** a full pass as both characters.
