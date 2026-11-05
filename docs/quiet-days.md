# Days without an incident, and the kami

A shrine is for the days nothing is down, which is most of them. While nothing
is down, going out or just back, the heading counts: "12 days without an
incident" (or the hours, on the first day; "Nothing has gone down. Yet." before
the shrine's first act), with the eyebrow *Under the shrine's protection*, on
phones, laptops and the TV alike. A pasted link unfurls the same count once a
day has passed, the README badge reads `up 12d`, the share card leads with it,
and the invite says come and keep it quiet rather than come and pray. The
count runs from the end of the last vigil, or from the room's first act.

Under the heading lives the **kami**, the spirit of the shrine: a fox mask
whose eyes follow its mood, a sliver of a meter for the protection it still
offers, when it was last fed and by whom, and *Bow to feed it*. Anything done
at the altar feeds it (incense, the bowl, a bow, an offering, a prayer, a
burned blame, a fortune). Fed, it is *pleased* for two hours and *content*
for the day; left alone it turns *peckish* after a day, *hungry* after two,
*starving* after four, and the meter runs out. Its line leads the quiet
heading and the TV ("The kami has not been fed since Tuesday. It is looking at
your Postgres."): the same line for everyone in the room all day, watching a
different thing tomorrow. While a vigil is open it is not surprised. Feeding a
kami that has waited a day or more, or its first meal ever, earns the feeder
+3 karma and a toast. Once it has gone two days unfed, the phones that asked
hear so (see [Notifications](notifications.md)). Nothing real hangs on its mood: the servers go
down when they go down. The rules are `KAMI_*` in `shared/rules.js`, the
lines in `shared/kami.js`, and the demo shrine has no kami.

## What the kami watches

Click the mask and the kami says what it watches: the services the team names
for it (payments-api, the DNS, the cron box), up to eight, +2 karma each. Its
lines look at those instead of the stock list, and when a vigil opens whose
title names one, by a person or an alert through the webhook, it points at it
("The kami told you about payments-api") until the vigil ends; the vigil's
record keeps which. A pasted link says how many it watches. None in the demo.

## Purifying the altar

When the servers come back, the altar is cleansed. The vigil's paper lantern
hangs dark, the kami says it wants the altar purified, and its chip reads
**Purify the altar** instead of Bow to feed it; the credits that roll after
They're back offer the same button, and clicking the dark lantern does it too.
Each person may purify once per vigil, for a day after it ended and while
nothing new is down: +5 karma, and it feeds the kami. The first purification
lights the lantern; its tooltip names who purified. Vigils from before
purifying was kept keep their lanterns lit. The rule is `PURIFY_FOR` and
`purifiable()` in `shared/rules.js`.

## Today's forecast

The kami's popover opens with **today's forecast** for the shrine: a sky from
Clear skies to Typhoon watch, a line about something it watches ("A front of
retries is moving toward payments-api. Keep the runbook dry."), a lucky
offering, a lucky hour and one thing to avoid. Everyone in the room reads the
same one until midnight UTC. The sky is chance, made one worse on a Friday,
while Mercury is retrograde and under a full moon, and it says which. The TV
reads it out in its quiet heading, **Copy the forecast** puts it in the team
channel with the link, and the omens before a deploy count a storm against it
and clear skies for it. Nothing real is in it. It lives in `shared/forecast.js`.

## What the shrine believes

The This shrine sheet ends with up to three superstitions the shrine has drawn
from its own last dozen vigils and deploys: "3 of your last 4 incidents
started on a Tuesday. The kami suggests skipping Tuesdays." Each is a real
count, read the way a team reads its incidents at 2 am. They cover when it went
down (the weekday, the part of the day, by the reader's clock), how long it
took against the prayers, burned blames and drawn fortunes, who held the watch
or said it first, how long the kami had gone unfed (each vigil now records
that), and the deploys that broke (against the omens, on what day, with how few
bows). A belief is only held when the history backs it: at least three
incidents, most of them agreeing, and one belief of each kind so three lines
never say one thing three ways. A younger shrine says how many incidents it
has so far. A TV shows the strongest one. The rules are
`shared/superstitions.js`.

## The column beside the altar

On every screen but a TV the column holds three things: who is here, the
activity feed, and **This shrine** as one line, its level and karma. The line
opens a sheet with the rest: the vitals, the charms, the way to the next level,
the vow, your rank, the keepers and the vigils. A TV shows all of it under the
line, since it has the room and nothing else to do. New things get a line in
something that exists, or a sheet, never a card of their own.
