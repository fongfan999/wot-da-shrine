# Wot Da Shrine 🪔

A shrine your team keeps so the servers stay up, and prays at when they
don't. Open one, send the link to your teammates, and bow every morning, bless
every deploy, keep the kami fed and count the days without an incident, all in
real time on one shared altar. When something goes down anyway, the vigil
opens and the whole team prays through it: incense, the bowl, bows, offerings
and prayers to the rack.

Inspired by every "I haven't been able to reach the server for an hour" thread,
and the classic photo of sysadmins praying to a rack with incense. A
[Wot Da Fong](https://wotdafong.dev/) project.

Open source at [github.com/fongfan999/wot-da-shrine](https://github.com/fongfan999/wot-da-shrine).
Issues and pull requests are welcome.

Built with [Vite](https://vite.dev), [GSAP](https://gsap.com) and the Web Audio
API, running on [Cloudflare Workers](https://developers.cloudflare.com/workers/)
with a [Durable Object](https://developers.cloudflare.com/durable-objects/) per
shrine.

## How it works

- `/` is the landing page. The altar on the first screen is a demo: light
  it, ring the bowl, say a prayer, and after a few actions it points you at
  the one thing to do here, open a shrine for your team. Rituals, vigils,
  records and sharing only exist in a shrine, and
  nothing done on the demo is counted in the world totals. Below it: how a
  vigil works, the rituals, how the link travels through Slack, and the
  live world count.
- There is no solo page: praying alone is a shrine with one person in it.
  For planned downtime the landing page's builder makes a shrine of its own,
  `/r/<slug>?title=…&eta=…`, whose first visit gives the room that title and
  time. Customize has three tabs: This shrine (title, subtitle, sound, scene, alerts),
  On the TV (how every screen showing the shrine looks and sounds) and Just for
  you (this browser). On the home page, the demo and a TV it is the last only.
- `/r/demo` is the public demo shrine, streamed onto the landing page in TV
  mode. Names there come from a list, only the ready-made prayers are
  accepted and the title is fixed, so it stays fit for a wall.
- `/new` redirects to a freshly named shared shrine, e.g. `/r/serene-rack-42`.
  `/new?name=Prod is down` names it `/r/prod-is-down` instead, and the landing
  page has a field for exactly that.
- `/r/:room` asks for a name and avatar, then joins that room's `Shrine`
  Durable Object over a WebSocket. The room keeps the shared state: who is
  here, incense burn time, karma, the offerings on the table, the last 12
  prayers, the title and ETA, the open vigil and the last 12 vigils. Late
  joiners see the incense mid-burn and the prayers they missed.
  The name card first shows what the room is going through: what is down,
  for how long, whether the incense burns and who is kneeling. Each tab gets
  a resume token, so a refresh or a dropped connection comes back as the same
  person, and the room only hears someone left after five quiet seconds.
- `/r/:room?tv=1` is the war-room screen: it watches without kneeling (it is
  not counted as praying), shows the vigil timer big, and a QR code to join.
  When nothing is down it stays worth leaving on: the heading says how long it
  has been quiet ("4 days without an incident") and what was down last, and a
  card shows the room's sound mix and how to change it. A TV nobody has touched yet
  may be held silent by the browser; the card says so until someone presses a
  key. The first thing done at the altar turns it back into the incident screen.
- Every shrine reports its actions to one `World` Durable Object, which keeps
  the site-wide totals the landing page shows.
- Durable Objects use the WebSocket Hibernation API, so idle shrines cost
  nothing. A shrine nobody visits for 30 days deletes itself.

## Days without an incident, and the kami

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
hear so (see Notifications). Nothing real hangs on its mood: the servers go
down when they go down. The rules are `KAMI_*` in `shared/rules.js`, the
lines in `shared/kami.js`, and the demo shrine has no kami.

### What the kami watches

Click the mask and the kami says what it watches: the services the team names
for it (payments-api, the DNS, the cron box), up to eight, +2 karma each. Its
lines look at those instead of the stock list, and when a vigil opens whose
title names one, by a person or an alert through the webhook, it points at it
("The kami told you about payments-api") until the vigil ends; the vigil's
record keeps which. A pasted link says how many it watches. None in the demo.

### Purifying the altar

When the servers come back, the altar is cleansed. The vigil's paper lantern
hangs dark, the kami says it wants the altar purified, and its chip reads
**Purify the altar** instead of Bow to feed it; the credits that roll after
They're back offer the same button, and clicking the dark lantern does it too.
Each person may purify once per vigil, for a day after it ended and while
nothing new is down: +5 karma, and it feeds the kami. The first purification
lights the lantern; its tooltip names who purified. Vigils from before
purifying was kept keep their lanterns lit. The rule is `PURIFY_FOR` and
`purifiable()` in `shared/rules.js`.

### Today's forecast

The kami's popover opens with **today's forecast** for the shrine: a sky from
Clear skies to Typhoon watch, a line about something it watches ("A front of
retries is moving toward payments-api. Keep the runbook dry."), a lucky
offering, a lucky hour and one thing to avoid. Everyone in the room reads the
same one until midnight UTC. The sky is chance, made one worse on a Friday,
while Mercury is retrograde and under a full moon, and it says which. The TV
reads it out in its quiet heading, **Copy the forecast** puts it in the team
channel with the link, and the omens before a deploy count a storm against it
and clear skies for it. Nothing real is in it. It lives in `shared/forecast.js`.

### What the shrine believes

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

### The column beside the altar

On every screen but a TV the column holds three things: who is here, the
activity feed, and **This shrine** as one line, its level and karma. The line
opens a sheet with the rest: the vitals, the charms, the way to the next level,
the vow, your rank, the keepers and the vigils. A TV shows all of it under the
line, since it has the room and nothing else to do. New things get a line in
something that exists, or a sheet, never a card of their own.

## A vigil, not a visit

An incident is a *vigil*, and it begins when someone says something is down:
**Something's down** in the top bar, or **Yes, start the vigil** when the
incense is lit in a quiet room (lighting asks "Is something down?"). Naming what
is down in Customize while the room is quiet opens one too, and so does lighting
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
above the altar for every vigil survived, and the altar itself grows with the
room's karma: a torii gate at 150, a lucky cat on the table at 400, a golden
censer at 1000. Past that it keeps growing, to Mountain monastery at 2500 and
Head temple at 5000, and every level past the first opens a sound (see
Sounds and scenes).

Title, subtitle and "back at" are shared by the whole room: click the title
and type what is down, click "back at" to pick a time, set them in Customize,
or open `/new?title=Payments+API+is+down&eta=…` and the first person in sets
them for everyone.

### Rituals

- **Burn a blame**: write what happened, press burn, and a paper slip flies
  into the censer and catches fire. The words never leave the browser; the
  room only learns that a confession was burned. +5 karma, blameless.
- **Draw a fortune**: an omikuji for engineers, one per person per vigil.
  Five levels from Great blessing to Great curse, each with a line about the
  deploy, the night on call and plain luck. Tie it to the rail, or copy it.
- **Chorus**: three or more people bowing within four seconds earn the room
  a bonus and a peal of bells. The shrine counts it, so no single tab can
  fake it.

### Bless a deploy

Incidents are rare and deploys are daily, so a shrine is worth opening before
anything breaks. With nothing down, **Bless a deploy** in the top bar asks what
is shipping (optional) and starts a *blessing*: the heading says "Shipping
payments-api v2.3", a clock counts up in the corner, and the room's bows and
prayers count toward it. It ends one of two ways:

- **Shipped**: bells, +5 karma, and the heading says it shipped clean for a
  minute. The room's clean run goes on.
- **It broke**: the vigil opens at once, named after the deploy ("Payments-api
  v2.3 broke"), with the team already kneeling. The clean run starts again.

A vigil that opens within 30 minutes of a Shipped counts against that deploy:
the shrine marks it broke and the clean run starts again, so a streak means
something. One blessing at a time, never during a vigil (then the vigil is the
prayer), and one nobody ends within two hours is filed as never said, which
neither keeps nor breaks the run. The **Shrine records** card shows deploys
blessed and the clean run once there is one; the quiet TV says how many clean
deploys in a row, and a pasted link mentions a blessing in progress. The rules
live in `shared/rules.js` with the vigil's.

**The omens.** Before anything goes out, the Bless a deploy prompt reads
them: it is Friday, the weekend or after 4 pm (by the deployer's clock),
nobody has bowed today, the kami is hungry, the last deploy broke, something
went down in the last day, the moon is full, Mercury is retrograde. Someone
having bowed today, a pleased kami and a clean run of three weigh against
them, and a verdict runs from *Auspicious. Ship it.* to *Absolutely not. Well,
it is your deploy.* At three or more against, Bless it reads **Ship anyway**.
Nothing is ever stopped. The shrine reads the same omens when the blessing
starts and keeps the bad ones on it: the heading says what it went out
against, It broke then says the omens did say, and shipping clean against
three or more earns the **Defiant** charm. The omens are in `shared/omens.js`;
the Mercury dates there run to the end of 2027.

### The watch

Someone is on call every night, so the shrine keeps a lantern for them. Under
the heading, **Take the watch** makes you the one holding the pager; whoever
holds it sees **Hand over**, which lists everyone kneeling in the shrine and
passes it to them ("An handed you the watch. Sleep lightly."), or ends the
watch. Anyone else can **Take over**. One holder at a time, and the holder
kneels at the altar with a lantern on their name tag.

- **A quiet watch**: a watch that saw no vigil and lasted an hour or more
  earns the room +10 karma and a peal of bells when it is handed on or ended.
  Taking the watch during an incident inherits it, so that watch is not quiet.
- **On whose watch**: a vigil that opens while someone holds the pager says so
  in its corner ("on Linh's watch"), and its record keeps the name.
- **On the TV**: the war-room screen shows who is on call and since when, and
  shows nothing when nobody is.

The holder is matched by connection, or by name and avatar, so the same person
on their phone the next morning still holds it. A watch nobody hands on is let
go after a week. **Shrine records** counts the quiet watches once one has
ended. Holders' names stay in the room: link previews and badges never show
them.

### Your standing, and the morning bow

The room's karma grows the altar; your own gives you a title in that shrine.
The shrine keeps what each person earned, under their name and avatar like
the watch, so the same person on their phone tomorrow keeps it: what you do
at the altar, your share of a chorus, a quiet watch you kept, the incense you
lit when it burns down. **This shrine** shows your title and how far to the
next (Lurker in #incidents up to Patron saint of prod at 2000), hovering a
name shows theirs, and the room hears when someone earns a new one. Renaming
takes it with you, unless the new name is someone's already.

Your first bow of the day is the **morning bow**: +5 karma on top of the bow,
and every seventh morning in a row +15 more. Until you make it the Bow key
wears a seal (+5, or 🔥3 when a run is waiting on today), and a run of two or
more shows as a flame beside your name. The shrine counts days by your own
clock, and two morning bows are at least four hours apart, so moving the
clock buys nothing. The room keeps a run too, the days in a row someone in it
bowed: **Mornings in a row** in the records, and on the quiet TV. A shrine
remembers its hundred most recent people. Not in the demo.

### Together

A shrine shows what each person put in, so the team can see it building something together:

- **Keepers this week**: the five who earned the most karma here this week,
  with their morning runs, in This shrine and on the TV. It starts over every
  Monday at 00:00 UTC, so a newcomer can top it by Friday. Not on it yet, you
  see your own week under it.
- **Building the next level**: the way to the shrine's next level (Village
  shrine at 150, Temple at 400, Grand temple at 1000) is a bar in one segment
  per person who earned it, with their faces beside it. When the shrine grows,
  the room hears who built it. Karma from before anyone kept count is the
  grey at the start.
- **The cast**: when the servers come back, everyone in the shrine, the TV
  too, sees the vigil's credits roll: who said it was down (or which alert
  raised it), who was on watch, who prayed most, who said they're back, and
  everyone who earned karma in it, most first. Whoever said they're back gets
  the share sheet after the credits. The vigil's record keeps the cast, its
  row in the records names them, and the retro Markdown says who kept it.
- **Thanks**: click someone else's name in the shrine, or Thank beside them
  in a vigil's credits, and they earn +3 karma; the room sees who thanked
  whom. Once a day for each pair, and never yourself.
- **The weekly vow**: anyone can make the room's one goal for the week from
  This shrine: 10 morning bows, 3 quiet watches, 5 clean deploys or 300 karma
  together. Its bar fills in a segment for each person who moved it (a clean
  deploy that breaks within half an hour comes back off), the quiet TV says
  how far it has come, and keeping it pays everyone who helped +5. One vow a
  week: it stays until it is kept, or the week ends and it is filed as
  missed. **Vows kept** joins the records once one has ended.

### Charms

A shrine collects charms: sixteen omamori, each earned once by the room and
kept for good. The shelf in This shrine has a slot for every one, the earned
ones in colour, and names the charm the room is closest to ("next: Choir, 3 of
5"). Click it for the sheet with them all, how to earn each, when it was
earned and how far the room has come toward the rest.

| Charm | Earned by |
| --- | --- |
| First light | lighting the first stick |
| Survivor, Veteran | surviving a vigil, then ten |
| Quick fix | being back between one and ten minutes after going down |
| Full table | four offerings on the table at once |
| Choir | a chorus of five |
| Great blessing, Brave face | drawing a Great blessing, or a Great curse |
| Kept word | keeping a weekly vow |
| Seven mornings, A moon of mornings | the room's morning run reaching 7, then 30 |
| Blameless | ten blames burned |
| Clean hands | ten clean deploys in a row |
| Lantern keeper | ten quiet watches |
| Grateful | 25 thanks given |
| Long night | surviving a vigil three hours long |

Each charm pays the room +10 karma, and whoever's act earned it as much; the
whole room hears it with bells. A charm is never taken back, not even by an
Undo. The shrine counts and pays (`CHARMS` in `shared/rules.js`), so no tab can
fake one. A shrine from before charms hangs whatever it had already done the
first time it wakes, quietly and unpaid. The demo has none.

### Sounds and scenes

A shrine opens more of itself as it goes. Six sound layers and the Sakura
scene are every shrine's; the rest are earned, and once open they stay open.

| Opens | at |
| --- | --- |
| Koto: a plucked zither, a few notes at a time | Village shrine, 150 karma |
| Shakuhachi: a bamboo flute, long and breathy | Temple, 400 |
| The rack: fans, mains hum, disks seeking, a UPS down the aisle | Grand temple, 1000 |
| Great bell: the temple's bonshō, struck every half minute | Mountain monastery, 2500 |
| Shō: reed chords that swell like breathing | Head temple, 5000 |
| Momiji scene: maple leaves, warm paper | the Survivor charm |
| Yuki scene: snow, cold paper | the Seven mornings charm |
| Hotaru scene: fireflies rising, a summer night | the Long night charm |
| Kin scene: gold leaf, gilded paper | the Clean hands charm |

A scene is the room's, like its sound: everyone in the shrine and every TV
showing it sees what falls past the altar and the tint of the paper. Customize
→ This shrine shows every layer and scene, the locked ones with how far the
room has to go, and names the one that opens next. The way there is named
where the room already watches its progress: the bar toward the next level
says "120 karma to go · opens Koto", and a charm that brings a scene says so
on the shelf and in the charms sheet. When something opens, everyone in the
shrine gets a card with **Play it** or **Show it**, which puts the new layer
in the room's mix or the scene on for everyone, and the feed says so. Each
browser remembers what it has seen open in each shrine, so whoever comes back
later gets the same card, headed "New since you were last here". A TV shows a
large card of its own and rings it in. Until someone opens Customize, a dot
waits on More. The shrine refuses a layer or scene it has not opened, so a mix in a
link (`?mix=koto:60`) plays only what the room has earned. The rules live in
`UNLOCKS` in `shared/rules.js`.

## Straight from your alerting

Every shrine has a webhook, so the vigil can open before anyone thinks of
it. In a shrine, Customize → **Alerts** → Get the link gives
`/api/rooms/<room>/hook/<key>`. Point your alerting at it: a firing alert
opens the vigil, named after the alert, and a resolved one says the servers
are back, bells and all. The feed shows who raised it (🔔 Grafana said
something is down), and the vigil's record keeps it.

It reads what these tools already send, with no template to write:
Alertmanager, Grafana, PagerDuty (webhooks v3), Opsgenie, Statuspage
(incidents and component updates), Better Stack, Datadog (with
`$ALERT_TRANSITION` in the payload) and UptimeRobot. Anything else can say
it plainly:

```bash
curl -X POST "$HOOK" -H 'Content-Type: application/json' -d '{"status":"down","title":"Payments API"}'
curl -X POST "$HOOK?status=up"
```

An empty POST, or a few plain words, says something is down. `?status=`,
`?title=` and `?from=` on the URL override what the body says. The answer is
what happened (`opened`, `already-down`, `resolved`, `already-up` or
`ignored`, for events like an acknowledgement), whether it is down and for
how long, and the shrine's link to post in the incident channel. A payload it
can't read gets a 422 with a hint, a wrong key a plain 404.

An alert never renames a vigil the team already named, and a vigil it ends
can't be taken back with Undo: the monitor would only say so again. The link
is no secret from the room: anyone who can open the shrine can get it, and
could press Something's down and They're back by hand anyway. Its key only
keeps out people who don't know the room's name, and Replace the link cuts
off a tool you stopped using; everyone who had the old one open hears so. The demo shrine has no webhook. Each IP
gets 30 calls a minute.

## Notifications

A shrine can call people back while it is closed. In a shrine, Customize →
Just for you → **Turn on notifications** subscribes this browser to this
shrine, and the shrine offers it once at the moments it matters: when you
take the watch, when your morning bows reach two in a row, and when a vigil
you sat through ends. It sends:

- **Something's down**: a vigil opened, by a person or an alert ("Grafana
  raised the alarm in payments-war-room. Come kneel."). Urgent, and it stays on
  screen until it is tapped. A flapping monitor is heard once in ten minutes.
- **They're back**: the same vigil ended, replacing the down message, to those
  who heard it go down. "Not back after all" if it is taken back.
- **You hold the watch**: someone handed it to you.
- **Keep your run**: at 7 pm on your clock, if your run of two or more morning
  bows is waiting on today's.
- **The kami is hungry**: at the same hour, once it has gone two days unfed
  (its line, and "One bow at payments will do."), once per hunger. It comes
  before the run reminder, and only one of the two a day.

The down, back and reminder messages skip whoever is kneeling in that shrine; tapping one opens it.
Each of the four kinds can be switched off, per shrine and per device. iPhones
and iPads deliver web notifications only to a page added to the Home Screen,
so there the panel says to do that first; the shrine has a manifest and icons
for it.

It is Web Push with nothing in between: the Worker encrypts each message
(RFC 8291) and signs it with VAPID (RFC 8292) itself, in `worker/push.js`, so
Google's, Mozilla's, Apple's or Microsoft's push service only ever carries
ciphertext. The shrine keeps up to 100 subscriptions, by push endpoint, with
the name and avatar they belong to, and forgets one when its push service says
it is gone. Only those services' hosts are accepted as endpoints. The demo
shrine and TVs never subscribe.

Notifications need a key, one secret. Without it the panel shows nothing:

```bash
npm run vapid --silent | npx wrangler secret put VAPID_KEY
```

For local dev, `npm run vapid --silent -- --dev >> .dev.vars`. A new key cuts
off every browser subscribed with the old one until they visit again.


The shrine is built to travel from one incident channel to the next:

- **Links that explain themselves**: a room link unfurls in Slack, Teams,
  Discord or X with a drawn preview card and a live line about the room
  ("3 praying · incense burning, 7 min left · 48 karma · last prayer: …").
  The Worker rewrites the room page's `<title>` and Open Graph tags on the
  way out, so every paste shows what is happening right now.
- **Share**: the Share menu copies the link, casts to the TV, or opens a sheet with the link, a ready-made
  Slack message ("🪔 The servers are down. The shrine is open, come pray
  with us: …"), a post for X, and the system share sheet on phones.
- **Previews that show the state**: the unfurl's picture is one of three drawn
  in advance (`public/og.png`, `og-down.png`, `og-back.png`): a room with an
  open vigil shows the lit altar, one that came back within the hour the
  celebration, any other the shrine's own card. In dev,
  `await __incense.previewCard('down' | 'back')` draws them again from the live
  altar.
- **The share card**: a PNG of this shrine as it is right now, drawn from the
  live altar (every offering on the table), the team's avatars, how long
  you prayed, the karma and the last prayers. Share it, copy it or download
  it; it comes with a caption. Light or dark, to match the page.
- **They're back!**: when the servers come back, press the button. Bells, a
  shower of petals, +20 karma for the room, the heading becomes "The servers
  are back", and the share card is offered at the one moment people want to
  post it. Everyone in the room sees the celebration.
- **The world**: the landing page shows what every shrine is doing: prayers
  sent, shrines opened, how many are burning right now, and the last thing
  that happened (only the ready-made prayers are ever echoed, never free
  text, and no room name leaves the counter).
- **For the retro**: the share sheet also hands out the vigil as a few lines
  of Markdown (down for how long, people at the peak, prayers, blames,
  fortunes, karma, the link) for the postmortem doc.
- **A badge for the README or status page**:
  `[![Wot Da Shrine](https://shrine.wotdafong.dev/api/rooms/serene-rack-42/badge.svg)](https://shrine.wotdafong.dev/r/serene-rack-42)`
  shows "shrine | down 12m · 3 praying" while a vigil is open, "back · 3
  praying" for the hour after, and otherwise who is there and whether the
  incense burns. It links to the altar.

## Features

- **Shared altar**: everyone sees and hears every action, and the activity
  feed shows who did what (repeats fold into "rang the bowl ×3").
- **The congregation**: everyone in the room kneels in front of the altar with
  their name above them, in rows when the team is big. They bow when they
  bow, and their prayer lanterns rise from where they kneel.
- **Prod vitals** (or whatever the shrine says is down): a heart monitor that flatlines while the incense is cold
  and beats faster with more people and more devotion, with a mood face to
  match.
- **The offering tray**: pick what the servers get (energy drink, noodles,
  rubber duck, the backups…) or roll the dice. `O` still offers at random.
- **Quick prayers**: three ready-made prayers under the altar, reshuffled
  every time you use one.
- **The wish board**: every prayer also hangs on the altar as a wooden plaque,
  and a shared shrine restores the last six for late joiners.
- **Bowl combos**: ring fast, or ring together, and the combo counter climbs
  from "the rack hears you" to "enlightenment achieved". Each ring in a combo
  sits a little higher than the last.
- **Ranks**: karma promotes you from lurker in #incidents to enlightened SRE,
  with a toast and a shower of petals at every promotion.
- **Effects levels**: phones, small tablets and anything that reports a weak
  CPU get *lite* effects (no fog, fewer particles, flames that flicker at
  6 fps instead of 60). Desktops start with
  the full set and drop to lite for the session if the frame rate falls below
  40 fps after the intro. Pick one yourself under Customize, or with `?fx=lite`
  / `?fx=full`. Lite mode, and any shrine nobody has touched for 90 seconds,
  runs the whole scene at 30 fps; a cold altar draws nothing at all.
- **Atmosphere**: a camera push down the server corridor on load, dust over
  the altar, sparks when the incense catches, and cobalt shockwaves across the
  floor when the bowl rings.
- **Drawn, not downloaded**: the whole scene is an ink line drawing on
  notebook paper, in the Wot Da Fong brand. The incense burner is inline SVG
  (the sticks really burn down), the server room is procedural, the smoke is
  painted at runtime, and the ambient music is synthesized in the browser.
- **Light and dark**: paper by day, a night vigil after dark. It follows the
  system setting unless you pick one.
- **Sound for the room**: a mixer under Customize, heard by everyone in the
  shrine, the TV too, so the altar is worth leaving on when nothing is down.
  Six synthesized layers, each with its own slider: Sacred (drone, slow chords,
  temple bells), Chant (a voice singing "om" over a hand drum), Rain (on the
  roof, drops close by, thunder far away), White noise (soft and wide, for deep
  work), Spa (water in a stone basin, wooden chimes, a singing bowl) and Garden
  (birds, crickets, a frog, an owl, a dog far away). Presets are a few mixes
  with names: Vigil, Focus, Temple, Monsoon, Onsen, Dusk. Every slider to zero is
  silence. A layer only runs while its slider is up, nothing is recorded, and
  mixing opens no vigil; the room hears who put what on.
- **Customizable**: title, subtitle, "back at" time, sound, theme, toggles for
  music/effects/petals/fog. Open the settings panel or use URL params.
- **Keyboard**: `L` light · `B` bowl · `P` bow · `O` offer · `Space` breathe ·
  `M` mute · `T` theme.
- **Worker API**: `GET /api/status` (JSON), `GET /api/health` (`om`),
  `GET /api/world` (totals across every shrine), `GET /api/rooms/:room/status`
  (the room at a glance, including how long it has been down and how many
  vigils it survived), `GET /api/rooms/:room/badge.svg`,
  `GET /api/rooms/:room/ws` (WebSocket). Shrines report to the world counter
  themselves.

## URL parameters

| Param      | Values                                   | Example                        |
| ---------- | ---------------------------------------- | ------------------------------ |
| `title`    | any text (rooms only)                    | `?title=Back+in+5+minutes`     |
| `subtitle` | any text (rooms only)                    | `?subtitle=Deploying+v2.0`     |
| `eta`      | ISO 8601 date/time (rooms only)          | `?eta=2026-10-14T18:30:00Z`    |
| `track`    | a preset: `vigil` `focus` `chant` `rain` `spa` `garden` (rooms only) | `?track=focus` |
| `mix`      | layers and levels, `layer:0-100,…` (rooms only) | `?mix=garden:70,noise:30`  |
| `theme`    | `auto` `light` `dark`                    | `?theme=dark`                  |
| `music` `sfx` `petals` `fog` | `1` / `0`              | `?petals=0&fog=0`              |

`title`, `subtitle`, `eta`, `track` and `mix` seed a room that has none yet, e.g.
`/r/serene-rack-42?title=Payments+API`. The rest work everywhere.

## Develop

```bash
npm install
npm run dev        # Vite + the Worker and Durable Object in workerd, http://localhost:5173
```

`npm run preview` builds and serves the production bundle locally.

## Deploy

```bash
npx wrangler login # once
npm run deploy
```

It deploys to https://shrine.wotdafong.dev as a Workers custom domain (the
`wotdafong.dev` zone must be on the same Cloudflare account). The
`*.workers.dev` URL and preview URLs are turned off in `wrangler.jsonc`.

## Project layout

One folder per kind of thing, one file per part of the page, and nothing very long:

- **Two pages.** `index.html` is the home page: `/` and the `/tv` code
  screen. `r/index.html` is a shared shrine, which the Worker serves for every `/r/:room`.
  Each is only its head and a list of `<include src="…">` lines, which a small Vite plugin
  (in `vite.config.js`) replaces with the partials at dev and build time. The shrine's
  pieces in `src/partials/shrine/` are shared; the home page adds its own from
  `src/partials/landing/`, and a room never loads them.
- **Styles** live in `src/styles/`, one file per part of the page. `core.css` is the shrine,
  `landing.css` the home page's sections and `overrides.css` the modes and breakpoints;
  `home.css` imports all three and `room.css` skips the landing, always in cascade order.
- **Behaviour** lives in `src/app/` for the shrine and `src/landing/` for the home page.
  `src/main.js` is what every page runs; `src/home.js` and `src/room.js` are the pages'
  entries. Shared code never imports from `src/landing/`: the home page hooks itself in.
  Drawing engines are in `src/scene/`, sound in `src/audio/`, and plain helpers in `src/lib/`.
- **Time.** Anything that changes with the clock (the vigil timer, the burn left, the ETA,
  the feed's times, the polls) runs on `src/lib/clock.js`, never its own interval. Readings
  are computed from `Date.now()`, so a background tab's late tick is never a wrong one, and a
  moment that must not be missed is a `setTimeout`, never `gsap.delayedCall` (GSAP sleeps in
  background tabs). The rules are written out at the top of that file.
- **The Worker** is a Hono app: a route file per area in `worker/routes/`, shared middleware
  in `worker/middleware.js`, and the Durable Objects in `worker/objects/`.

A new part of the page usually means a partial, a stylesheet and a module with the same name.

```
index.html               the home page: head + includes (/ and /tv)
r/index.html             a shared shrine: head + includes (/r/:room, served by the Worker)
vite.config.js           Vite, the Cloudflare plugin, the partials plugin and the two pages
src/main.js              what every page runs: loads the modules, keyboard shortcuts, start()
src/home.js, src/room.js the pages' entries: the home page adds the landing and the world line
src/partials/            the pages' markup
  head.html              the head both pages share
  scene.html, bar.html, breath.html, tv.html, settings.html
  shrine/                heading, altar, live card, shrine card, credit, TV join, the dock
  sheets/                join, open a shrine, cast, blame, fortune, share
  landing/               the home page's hero pieces, open card and sections, and the footer
src/styles/              the pages' styles, in cascade order
  home.css, room.css     each page's stylesheet
  core.css               the shrine's parts, from tokens.css on
  landing.css, landing/  the home page's sections
  overrides.css          modes.css, responsive.css, ink.css: overrides by mode and screen width
  tokens.css             design tokens, light and dark themes
  scenes.css             each scene's paper, light and dark
src/app/                 the shrine
  context.js             where we are (room, TV, home page), settings, shared state, records
  engines.js             builds the drawing engines (room, burner, smoke, fog, petals…)
  unlocks.js             what the shrine has opened: locked layers and scenes, the scene shown, the moment one opens
  stage.js               layout, split title, intro, parallax, mantras
  fx.js                  lite/full effects, frame budget, TV sleep
  settings.js            applying settings, the settings panel, sound toggle
  ui.js                  toasts, activity feed, shockwaves, copy
  stats.js               counters, rank, vigil strip, records, ETA
  incident.js            the title and ETA, edited in the heading
  altar.js               light, burn out, bowl + combos, bow, puff, breathing
  offerings.js, prayers.js, rituals.js   the offering tray, prayers, blame + fortune sheets
  shrine.js              shared-shrine client: join, connection, remote actions
  people.js              people card and presence stack
  resolve.js             "they're back"
  shareSheet.js          invite + share card sheet
  menus.js               the top bar's Share and More menus
  cast.js, screen.js     Cast to TV, and the TV's own screens
  quiet.js               nothing down: the days without an incident, and the TV's sound mix
  kami.js                the kami's mask, meter and line under the heading, and what it watches
  beliefs.js             what the shrine believes, in the This shrine sheet
  vigilStart.js          saying something is down: the button, the question on lighting
  etaPicker.js           the Back at picker, in the heading and the builder
  openShrine.js          name fields and the Open sheet
src/landing/             the home page's sections (pulse, showcase, steps, builder, TV…) and its world line
src/scene/               what is drawn
  burner.js              inline-SVG incense burner (burn-down, embers, offerings)
  serverRoom.js          procedural SVG server room with blinking LEDs
  smoke.js               incense smoke particles (runtime sprite)
  fog.js, petals.js, motes.js   ambient fog, what falls in the scene (petals, leaves, snow, gold, fireflies), dust and sparks
  lanterns.js            prayer lanterns
  ema.js                 prayers hung on the altar as plaques
  congregation.js        teammates kneeling at the altar
  vitals.js              prod's heart monitor
  palette.js             theme colours for the canvas layers
src/audio/
  index.js               Web Audio sound kit (one-shot effects)
  music.js               generative ambient sound: eleven layers, mixed by the room
src/lib/
  clock.js               the page's one clock, and the rules for anything timed
  config.js              settings: URL params > localStorage > defaults
  strings.js             brand name, copy and mantras
  room.js                room URL, saved name, reconnecting WebSocket
  share.js               the share card: live altar + stats as SVG, rasterised to PNG
  omikuji.js             the fortunes: five levels, three lines each
  icons.js               line icons for the dock, tray and pings
public/favicon.svg       the mark
public/og*.png           the link preview cards (1200×630): the shrine, a room that is down, one that is back
public/wotdafong-*.svg   the Wot Da Fong P?! mark for the credit line
shared/                  used by the page and the Worker: the rules (burn time, karma, vigils, the kami), the kami’s lines, ready-made prayers, room names, link previews
worker/index.js          Cloudflare Worker: a Hono app that mounts the routes below
worker/middleware.js     security headers, API headers, rate limits, socket-only
worker/routes/api.js     /api/health, /api/status, /api/world
worker/routes/rooms.js   /new, /r/:room (link previews), a room's socket, status and badge
worker/routes/tv.js      /api/tv/ws and casting to a paired TV
worker/views/            the room page (r/index.html) with its link preview rewritten, the README badge SVG
worker/objects/shrine.js   Shrine Durable Object: one per room
worker/objects/world.js    World Durable Object: totals across every shrine
worker/objects/pairing.js  Pairing Durable Object: one per TV code
wrangler.jsonc           Worker + Durable Object config
```

## License

[O'Saasy](https://osaasy.dev/): MIT-style, except you may not offer this software as a competing hosted or SaaS service. See [LICENSE](LICENSE).
