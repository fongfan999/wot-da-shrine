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
  records and sharing only exist in a shrine (or a maintenance page), and
  nothing done on the demo is counted in the world totals. Below it: how a
  vigil works, the rituals, how the link travels through Slack, and the
  live world count.
- Give `/` a `title`, `subtitle` or `eta` in the URL and it becomes your
  maintenance page: the full solo shrine, with the landing sections gone.
  `?solo=1` does the same without a title. For planned downtime the landing
  page's builder makes a shrine of its own instead: `/r/<slug>?title=…&eta=…`,
  whose first visit gives the room that title and time. On the home page Customize is preferences only.
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
- `/r/:room?tv=1` is the war-room screen: it watches without kneeling (it is
  not counted as praying), shows the vigil timer big, and a QR code to join.
- Every shrine reports its actions to one `World` Durable Object, which keeps
  the site-wide totals the landing page shows.
- Durable Objects use the WebSocket Hibernation API, so idle shrines cost
  nothing. A shrine nobody visits for 30 days deletes itself.

## A vigil, not a visit

An incident is a *vigil*. It begins when the incense is lit in a shrine with
no open vigil, and ends when someone presses **They're back!** (or when it is
forgotten for six hours). While it is open the heading counts how long the
servers have been down, who is praying and how many prayers were said. When
it ends the shrine files it: minutes, people, prayers, karma. The **Shrine
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

## Spreading the word

The shrine is built to travel from one incident channel to the next:

- **Links that explain themselves**: a room link unfurls in Slack, Teams,
  Discord or X with a drawn preview card and a live line about the room
  ("3 praying · incense burning, 7 min left · 48 karma · last prayer: …").
  The Worker rewrites the room page's `<title>` and Open Graph tags on the
  way out, so every paste shows what is happening right now.
- **Invite**: the Invite button opens a sheet with the link, a ready-made
  Slack message ("🪔 The servers are down. The shrine is open, come pray
  with us: …"), a post for X, and the system share sheet on phones.
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
- **A badge for the README or status page**:
  `[![Wot Da Shrine](https://shrine.wotdafong.dev/api/rooms/serene-rack-42/badge.svg)](https://shrine.wotdafong.dev/r/serene-rack-42)`
  shows "shrine | 3 praying · burning" and links to the altar.

## Features

- **Shared altar**: everyone sees and hears every action, and the activity
  feed shows who did what (repeats fold into "rang the bowl ×3").
- **The congregation**: everyone in the room kneels in front of the altar with
  their name above them, in rows when the team is big. They bow when they
  bow, and their prayer lanterns rise from where they kneel.
- **Rack 42 vitals**: a heart monitor that flatlines while the incense is cold
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
- **Customizable**: title, subtitle, "back at" time, theme, toggles for
  music/effects/petals/fog. Open the settings panel or use URL params.
- **Keyboard**: `L` light · `B` bowl · `P` bow · `O` offer · `Space` breathe ·
  `M` mute · `T` theme.
- **Worker API**: `GET /api/status` (JSON), `GET /api/health` (`om`),
  `GET /api/world` (totals across every shrine), `GET /api/rooms/:room/status`
  (the room at a glance, including how long it has been down and how many
  vigils it survived), `GET /api/rooms/:room/badge.svg`,
  `GET /api/rooms/:room/ws` (WebSocket), `POST /api/pulse` (the solo page
  reporting a light, prayer, bow, offering or recovery to the world counter).

## URL parameters

| Param      | Values                                   | Example                        |
| ---------- | ---------------------------------------- | ------------------------------ |
| `title`    | any text                                 | `?title=Back+in+5+minutes`     |
| `subtitle` | any text                                 | `?subtitle=Deploying+v2.0`     |
| `eta`      | ISO 8601 date/time                       | `?eta=2026-10-14T18:30:00Z`    |
| `theme`    | `auto` `light` `dark`                    | `?theme=dark`                  |
| `music` `sfx` `petals` `fog` | `1` / `0`              | `?petals=0&fog=0`              |

They work on room pages too: `/r/serene-rack-42?theme=dark`.

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

- **Markup** lives in `src/partials/`. `index.html` is only the head and a list of
  `<include src="…">` lines, which a small Vite plugin (in `vite.config.js`) replaces
  with the partials at dev and build time.
- **Styles** live in `src/styles/`, one file per part of the page. `src/styles/index.css`
  imports them in cascade order, so a later file wins over an earlier one.
- **Behaviour** lives in `src/app/` for the shrine and `src/landing/` for the home page.
  Drawing engines are in `src/scene/`, sound in `src/audio/`, and plain helpers in `src/lib/`.
- **The Worker** is a Hono app: a route file per area in `worker/routes/`, shared middleware
  in `worker/middleware.js`, and the Durable Objects in `worker/objects/`.

A new part of the page usually means a partial, a stylesheet and a module with the same name.

```
index.html               page shell: head + includes
vite.config.js           Vite, the Cloudflare plugin and the partials plugin
src/main.js              entry: loads the modules, keyboard shortcuts, starts the show
src/partials/            the page's markup
  scene.html, bar.html, breath.html, tv.html, settings.html
  shrine/                the altar heading, the side cards, the dock
  sheets/                join, open a shrine, cast, blame, fortune, share
  landing/               the home page's sections, top to bottom, and the footer
src/styles/              the page's styles: index.css imports the rest in cascade order
  tokens.css             design tokens, light and dark themes
  landing/               the home page's sections
  modes.css, responsive.css   overrides by mode and by screen width
src/app/                 the shrine
  context.js             where we are (solo, room, TV, home page), settings, shared state
  engines.js             builds the drawing engines (room, burner, smoke, fog, petals…)
  stage.js               layout, split title, intro, parallax, mantras
  fx.js                  lite/full effects, frame budget, TV sleep
  settings.js            applying settings, the settings panel, sound toggle
  ui.js                  toasts, activity feed, shockwaves, copy
  stats.js               counters, rank, vigil strip, records, ETA
  incident.js            the title and ETA, edited in the heading
  vigil.js               the solo page's vigils and records
  altar.js               light, burn out, bowl + combos, bow, puff, breathing
  offerings.js, prayers.js, rituals.js   the offering tray, prayers, blame + fortune sheets
  shrine.js              shared-shrine client: join, connection, remote actions
  people.js              people card and presence stack
  resolve.js             "they're back"
  shareSheet.js          invite + share card sheet
  cast.js, screen.js     Cast to TV, and the TV's own screens
  world.js               the world line (every shrine)
  openShrine.js          name fields and the Open sheet
src/landing/             the home page's sections (pulse, showcase, steps, builder, TV, the ETA picker…)
src/scene/               what is drawn
  burner.js              inline-SVG incense burner (burn-down, embers, offerings)
  serverRoom.js          procedural SVG server room with blinking LEDs
  smoke.js               incense smoke particles (runtime sprite)
  fog.js, petals.js, motes.js   ambient fog, falling petals, dust and sparks
  lanterns.js            prayer lanterns
  ema.js                 prayers hung on the altar as plaques
  congregation.js        teammates kneeling at the altar
  vitals.js              rack 42 heart monitor
  palette.js             theme colours for the canvas layers
src/audio/
  index.js               Web Audio sound kit (one-shot effects)
  music.js               generative ambient music
src/lib/
  config.js              settings: URL params > localStorage > defaults
  strings.js             brand name, copy and mantras
  room.js                room URL, saved name, reconnecting WebSocket
  share.js               the share card: live altar + stats as SVG, rasterised to PNG
  omikuji.js             the fortunes: five levels, three lines each
  icons.js               line icons for the dock, tray and pings
public/favicon.svg       the mark
public/og.png            the link preview card (1200×630)
public/wotdafong-*.svg   the Wot Da Fong P?! mark for the credit line
shared/                  used by the page and the Worker: ready-made prayers, room names, link previews
worker/index.js          Cloudflare Worker: a Hono app that mounts the routes below
worker/middleware.js     security headers, API headers, rate limits, socket-only
worker/routes/api.js     /api/health, /api/status, /api/world, /api/pulse
worker/routes/rooms.js   /new, /r/:room (link previews), a room's socket, status and badge
worker/routes/tv.js      /api/tv/ws and casting to a paired TV
worker/views/            the room page's link preview rewrite, the README badge SVG
worker/objects/shrine.js   Shrine Durable Object: one per room
worker/objects/world.js    World Durable Object: totals across every shrine
worker/objects/pairing.js  Pairing Durable Object: one per TV code
wrangler.jsonc           Worker + Durable Object config
```
