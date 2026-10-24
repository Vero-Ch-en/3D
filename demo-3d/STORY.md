# Snowed In: the story (3D version)

This is the game as it stands (build 60). It keeps the shape of the 2D story: an ordinary shared day, something strange, an imitation, and a choice between a perfect day that never ends and real time that passes. It is not about a birthday. The anchor is **the first snow**, the night the two of them met.

## Premise

They met as children at a winter lantern fair, on the night of the first snow, when both of them wandered off from the crowd. Neither remembers much of it: snow, lanterns, somebody small sitting on a log. *He came over. That part, everyone agrees on.*

Every year, on the day of the first real snow, they keep a small tradition: a walk, a cake with one candle for every first snow in the cabin, paper lanterns on the porch, and the three-note whistle they made up at the fair, *if one of us gets lost* (slightly flat on the last one). They speak a little formally and warmly, with a lot of dry teasing underneath.

**What they call each other.** Both say **"my dearest"** or **"my dearest partner"**. He calls her **"my lovely partner"**, and she calls him **"my charming partner"**. Their morning greeting is "Hello, my dearest." / "Hello, my dearest." The imitation never uses these names. It says plain "Partner", or a flat "Hello." The names live in the config (`callBoth`, `callPartner`, `callPlayer`). They are lower case mid-sentence and capitalised at the start of a sentence.

**His real habits, shown early so the imitation can get them wrong.** At night he calls from the bedroom doorway and won't step onto the cold kitchen floor ("There's a line. This is the line."). He says the greeting back. He always waits for her.

The question underneath it all: they have forgotten almost everything about how they began, and it has never mattered. What if something offered to remember all of it for them, forever, as long as nothing ever changed again?

## Playing as Player or as Partner

You choose on the title screen ("Play as: Player / Partner"), and the game remembers it.
- **As Partner:** you control her in free time, and he follows you.
  - The prologue, morning, walk, evening, endings and The First Snow are narrated from her side (`js/narr_her.js`). The speaker labels turn round, and the scene choices are hers. Where the choice used to be one of his lines, she now says her own lead-in and he answers with his line ("Let me guess. Pancakes." → "Pancakes." / "Be honest." → "No. Better."). Things she does herself in the house have plain options ("Leave him a snack on the counter").
  - Story scenes hand control back to him for their length.
  - Using things in the house is hers to do, where she stands.
  - She isn't handed control while the story is walking or leading her somewhere, and he doesn't take over her routines (the armchair, Basil) while you play as her.
- **From the very start (build 72):** in the prologue you're her, on the log at the end of the path. He walks up from the fair while the camera watches from behind her, the talk on the log has her choices, and walking back to the lanterns you're her, with him holding your hand. In the morning she gets up with him, so control is hers as soon as the bed scene ends. Before, both opened as him: the prologue all the way through, and the morning until she got up on her own.
- **Some chapters decide who you are:** playing as him, dawn and Elsewhere are played as her. Playing as her, the night and Act IV follow her own route (below).

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

## Act IV · The Same Day (played as him)

You wake at night in a house that's almost exactly right: lamps on, perfectly round pancakes, two mugs with the handles turned the same way, snow hanging still in the air.
- **The imitation's version of the day.** It wakes you ("Weird dream, huh?"). You can talk to it and tease it: it turns its hat "the right way round" when it already was, offers to do yesterday again exactly the same, and answers the first-meeting question perfectly, which is the mistake. It explains the whistles away as "The kettle." Its present is a snow globe where the snow never settles.
- **Her trail**, never pointed out: a red mitten on the bottom porch step, one pinecone on the contest stump, three flat stones pointing west by the lake. Her sign from Elsewhere is in the kitchen.
- **Breakfast.** If your bond is high enough and you haven't given in much, she bursts in through the front door ("Today, of all days?"). Otherwise you reach *The Perfect Partner*. If it kept her, nobody comes, and you reach *Replaced*.
- **The bottom of the porch path.** "…You're still looking for them. I'm right here." When it's obsessive, it grabs your arm the first time. Going back with it twice while convinced leads to *Replaced*.
- **The reunion**, in the summer circle (or on the frozen lake if it kept her). You sit down together: how many of her things you found; "What was it like?"; "The floor is cold. That's when I knew."; the two sets of small footprints.
- **The walk home**, holding hands, with three conversations along the way.
- **The door in the meadow** only opens for two. The Entity speaks from what it observed about how you played ("You liked the fire. I kept it going all night."). "You could stay." Stay, or go home.

## Act III and Act IV as her (playing as Partner, build 66)

- **Bedtime from her side.** He asks "A good first snow?" and the answers are hers. Then she can curl into him, look at him ("You could simply admit I'm charming." "I could." "…Coward."), or kiss him goodnight. The water line is still hers: "If I get up for water, don't steal my side."
- **Act III, Recognition, as her.** She wakes about three. He's really there, asleep on his front, taking up exactly half the bed. She gets up for water, and the kitchen at night is almost right: three mugs on the rack ("You washed two"), the third shape in the photograph, and snow inside the sill. Then bare footsteps come from the bedroom, and something in his shape comes all the way into the kitchen. From there it plays as Elsewhere: it hunts her, she hides, it can catch her by the wrist, she whistles at the window, leaves her sign, and walks out into the snow. If it catches her three times, it keeps her. If she goes back to the bed while it's up, his side is empty and still warm, and she doesn't get back in.
- **Act IV, The Same Day, as her.** She's outside in the snow with every window of the cabin lit. "He'll come out eventually. He always comes out eventually. I'll leave him a trail."
  - **The trail is hers to leave:** her left mitten on the bottom porch step ("Placed. Not dropped. Placed."), one pinecone standing on the contest stump, and three flat stones from her secret summer pile, pointing west.
  - **The kitchen window:** he's at the perfect breakfast in the jumper he sleeps in, talking to the empty chair and laughing at nothing. If she knocks, he passes the syrup to nobody. If she whistles, he stops, half turns to the window, and then the chair tells him it was the kettle.
  - **The circle** (or the frozen lake if it kept her): she sits and whistles and waits. Something wearing him arrives first, in his sleeping jumper, in his socks in the snow, and says "Found you." She can test it. It remembers the first meeting perfectly, its feet aren't cold, it "counted" the pinecone score, and its hand squeezes exactly the right amount. Going home with it leads to *The Perfect Partner* (from her side, with him left standing in the circle, whistling badly). "You're not him." "I could be. I've been practising. I'm nearly right." "Nearly is how I know." It's gone, with no footprints.
  - **The real one:** three notes from the trees, very badly whistled. He arrives in his coat, complaining that all of the snow is in his boots. He comments on how much of her trail he found, and on her whistle at the window if she whistled. "Say something only you would say." "…The floor is cold." They sit in the grass, he empties his boots, and they find the two sets of small footprints. Then a hug, and the walk home holding hands, with his three conversations on the way.
  - **The door in the meadow:** the Entity speaks from what it watched her do (hiding, the wrist, the window, the trail, sending it away). He says "Your call." She can stay or go home, and the endings work as before.

## Suspense (build 66)

- **Before it comes:** the kitchen light stutters three times, then bare footsteps come from the bedroom, getting louder and closer. That gives a few seconds to hide. The first time, a hint says "(Footsteps. Coming this way.)"
- **While it's searching:** a heartbeat, quicker the closer it gets.
- **The close call:** once per search, if she's hidden, it comes and stands right outside her hiding place. In the alcove, it stands in the opening with its back to her, while the camera holds on the alcove from the dark room. At the study, it stands at the door with its head on one side, listening. "I can hear you breathing, Partner." "(You don't breathe.)" Then "…Pipes. Old house." and it wanders off. **Coming out while it's standing right there gets her caught.**
- **Sound (build 68):** through the night and Act IV (until you're together again), the warm chords thin out and a low, slowly beating drone sits underneath. Just before it comes, the drone cuts out and the house goes silent. The same thing happens at the circle while the snow hangs in the air.
- **His Act IV clue (build 68):** out on the porch path with the imitation, your breath clouds in the cold and hers doesn't. "(Your breath clouds in front of you in the cold. Hers doesn't. Not once.)" If he noticed, the Entity mentions it at the door. The one wearing him at her circle doesn't breathe out either.
- **His night (build 67):** once suspicion is at 2 and it's close, you can hear your own heart. Before the mask slips, the lamps stutter.
- **Her Act IV:** on the way to the circle, now and then, something stands between the trees, very still, and fades when she gets near. At the window, the second time she looks, the empty chair has been turned round to face her. At the circle, three notes answer her whistle **perfectly in tune** ("…That's new."), and the snow stops falling and hangs in the air while the one wearing him is there. When she sends it away, the snow comes down again all at once. The real one's whistle, later, is terrible.

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

## Saving and restart points

The game saves at the start of each chapter, at the Elsewhere door in the night, and in Act IV once you've found her (so a reload puts you back together on the way home, `act4_home`). Every lasting story flag is saved (whether it kept her, the sign she left, whether it withdrew, whether you slept beside it...); only flags that matter mid-scene are left out.

## Hiding and being caught (build 64)

- **Behind the curtain:** she folds herself onto the window seat, knees up, arms wrapped round herself, half hidden by the curtain.
- **In the study:** at night the study door isn't locked. She slips through and stands flat against the wall behind it, in the dark (it smells of pencil shavings and old paper). The camera stays in the kitchen on the closed door with its PRIVATE sign. Coming out brings her back into the kitchen.
- **Caught:** they stand face to face. Her arm is pulled out, and his hand reaches across and closes round her wrist (his arm goes to wherever her hand actually is).
- **The Entity:** when it finally stands in front of you, it's a person's shape in packed, glittering snow. It's a little too tall and has no face, and flakes keep lifting off it and drifting round.

## Title screen (build 69)

- **Nights: Tense / Gentle.** Gentle keeps the story the same, but nothing chases you. Playing as her, the imitation doesn't come back looking for her, so there's no hunt, close call or getting caught, and she can't be kept. Playing as him, the mask never slips and it doesn't walk right up to you. There's no heartbeat, and no figure between the trees. The setting is remembered.
- **Look:** a sleeker, frosted-glass interface (see the realism plan).
- **Endings:** a button shows how many of the seven endings you've found (kept in this browser). The list shows found endings by name, with a Replay button. Unfound ones are hidden, but their one-line hints still show ("At the door in the meadow, stay."). "None of them is the right one."

## Testing aids

- **Chapter list:** on the title screen and in the pause menu. It covers every act, Elsewhere on its own, Act IV on the way home, and each ending.
- **Story state panel:** in the pause menu. It shows bond, trust, corruption, suspicion, memories taken, whether it kept her, whether you slept beside it, and whether it withdrew.

## Still to do

- **Playtest:** finish a full pass as both characters. Build 52 played the whole day (morning, walk, evening), four endings and The First Snow as Partner without getting stuck, and every narration line had her version. Build 65 played the night (through to being kept) and Act IV (to You Found Me) with Partner chosen. There were no errors and every narration line had a version for her, and the door scene from the Act IV restart point leads to Uncertain Morning. Every chapter also gets a quick automated run as both characters.
