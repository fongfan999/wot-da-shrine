# Wot Da Shrine 🪔

When the servers are down, the team prays together. Open a shrine, send the
link to your teammates, and light incense, ring the bowl, bow, make offerings
and send prayers to the rack, all in real time on one shared altar.

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
  time. On the home page Customize is preferences only.
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
censer at 1000.

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

## Spreading the word

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
  with names: Vigil, Focus, Chant, Rain, Spa, Garden. Every slider to zero is
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
src/app/                 the shrine
  context.js             where we are (room, TV, home page), settings, shared state, records
  engines.js             builds the drawing engines (room, burner, smoke, fog, petals…)
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
  quiet.js               the TV when nothing is down: how long it has been quiet, the sound mix
  vigilStart.js          saying something is down: the button, the question on lighting
  etaPicker.js           the Back at picker, in the heading and the builder
  openShrine.js          name fields and the Open sheet
src/landing/             the home page's sections (pulse, showcase, steps, builder, TV…) and its world line
src/scene/               what is drawn
  burner.js              inline-SVG incense burner (burn-down, embers, offerings)
  serverRoom.js          procedural SVG server room with blinking LEDs
  smoke.js               incense smoke particles (runtime sprite)
  fog.js, petals.js, motes.js   ambient fog, falling petals, dust and sparks
  lanterns.js            prayer lanterns
  ema.js                 prayers hung on the altar as plaques
  congregation.js        teammates kneeling at the altar
  vitals.js              prod's heart monitor
  palette.js             theme colours for the canvas layers
src/audio/
  index.js               Web Audio sound kit (one-shot effects)
  music.js               generative ambient sound: six layers, mixed by the room
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
shared/                  used by the page and the Worker: the rules (burn time, karma, vigils), ready-made prayers, room names, link previews
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
