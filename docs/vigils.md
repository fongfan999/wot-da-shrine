# A vigil, not a visit

An incident is a *vigil*, and it begins when someone says something is down:
**Something's down** in the top bar, or **Yes, start the vigil** when the
incense is lit in a quiet room (lighting asks "Is something down?"). Naming what
is down in Settings while the room is quiet opens one too, and so does lighting
in a shrine whose name says it (`prod-is-down`, `payments-outage`), without
asking. On a quiet day incense, bows, prayers and music are only that: the
"All quiet" streak goes on and nothing is filed. A vigil ends when someone
presses **They're back!**, and for ten minutes after that the room celebrates.
The public demo shrine is always down: there the first thing done at the altar
opens a vigil, as it always has. Whoever said they're back can take it back for 30 seconds: the
vigil reopens as it was. A vigil is never forgotten while anyone is kneeling;
once the room has stood empty and untouched for 12 hours it is filed as
forgotten. While it is open the heading counts how long the servers have been
down, who is praying and how many prayers were said. When it ends the shrine
files it: what was down (the title at the time), minutes, people, prayers,
karma. The rules both sides play by live in `shared/rules.js`. The **Shrine
records** card shows what the altar has survived, a paper lantern hangs
above the altar for every vigil survived, and the shrine itself grows with the
room's karma, drawn in ink behind the censer (`src/scene/temple.js`): The altar
(a moving-box altar, a DO NOT REBOOT note, a cord to the coffee machine),
Roadside shrine at 150 (a roof on two posts, a shimenawa of Cat6), Village
shrine at 400 (a torii, a small hall, stone lanterns), Temple at 1000 (a bell
on a patch cable), Grand temple at 2500 (two storeys, banners, fox guardians)
and Head temple at 5000 (a pagoda, a cherry tree, a vending machine that sells
Hope). The home page and the demo show the Head temple. Every level past the
first opens a sound (see [Sounds and scenes](sounds-and-scenes.md)).

**Mats.** Each level lays more mats in front of the altar (1, 3, 5, 7, 10, 12;
`MATS` in `shared/rules.js`). The closest go to whoever earned the most karma
this week (the board's week, Monday 00:00 UTC), then the longer run of
mornings; everyone past the mats stands, a step back. Overtaking someone swaps
your mats in full view and the feed says so; the status card's place row says
which mat is yours and how much karma it takes to pass the one ahead. Lighting
incense or bringing an offering is a walk: your figure gets up, carries it to
the censer, bows and walks back. **Upkeep** is the kami's mood drawn on the
shrine: dust when it is peckish, cobwebs when hungry, weeds when starving (they
take the last two mats), and after a week unfed a tanuki moves in.

**Raising a level.** Karma alone does not raise the next level. When the room's
karma reaches it, the carpenters put up bamboo scaffolding around the shrine,
with a sign that counts bows (not while the kami has gone a day unfed; they
come with its next meal). Then three different people have to bow within a day
of each other; a team smaller than three needs as many as have earned karma
there. Each bow lashes a pole and the feed says so; the third raises the level,
everyone at the altar stands up to look, and the toast names whoever raised it.
Nobody bows: the scaffolding waits, and nothing is lost. This shrine shows the
bows as faces in the build bar, with the time the first one runs out. Rules
are `RAISE_*` in `shared/rules.js`; the demo grows with its karma as before.
Whoever holds the watch kneels on the **on-call stool** in front of the altar,
outside the order of the mats. The share card carries the shrine around the
altar too.

Title, subtitle and "back at" are shared by the whole room: click the title
and type what is down, click "back at" to pick a time, set them in Settings,
or open `/new?title=Payments+API+is+down&eta=…` and the first person in sets
them for everyone.

## Rituals

- **Burn a blame**: write what happened, press burn, and a paper slip flies
  into the censer and catches fire. The words never leave the browser; the
  room only learns that a confession was burned. +5 karma, blameless.
- **Draw a fortune**: an omikuji for engineers, one per person per vigil.
  Five levels from Great blessing to Great curse, each with a line about the
  deploy, the night on call and plain luck. Tie it to the rail, or copy it.
- **Chorus**: three or more people bowing within four seconds earn the room
  a bonus and a peal of bells. The shrine counts it, so no single tab can
  fake it.
