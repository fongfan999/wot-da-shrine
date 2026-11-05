# Architecture

How Wot Da Shrine is put together: the pages, the Worker and the Durable Objects behind
them, what travels between them, and where each part lives. For using a shrine, see the
[guide](docs/README.md); for changing one, [CONTRIBUTING.md](CONTRIBUTING.md).

## The big picture

```
 browser                                  Cloudflare
┌──────────────────────────┐   static    ┌──────────────────────────────────────────────┐
│ index.html   / and /tv   │◀────────────│ asset store (dist/client, public/_headers)   │
│ r/index.html /r/:room    │             │                                              │
│                          │  /new /r/*  │ Worker: a Hono app (worker/index.js)         │
│ src/main.js + src/app/*  │────/api/*──▶│   routes/api.js  rooms.js  tv.js             │
│                          │             │        │            │        │               │
│ one WebSocket per tab ───┼─────────────┼──▶ Shrine  (one Durable Object per room)     │
│ the TV's code screen ────┼─────────────┼──▶ Pairing (one per six-letter TV code)      │
│                          │             │    World   (one: totals across every shrine) │
└──────────────────────────┘             └──────────────────────────────────────────────┘

- **Two pages, built by Vite.** `index.html` (the home page, `/` and `/tv`) and
  `r/index.html` (a shared shrine) are each a head and a list of `<include>` lines that a
  small plugin in `vite.config.js` fills from `src/partials/`. Every page runs
  `src/main.js`; `src/home.js` and `src/room.js` add what only one of them needs.
- **The Worker runs first only where it has to.** `wrangler.jsonc` sends `/api/*`, `/new`
  and `/r/*` to the Worker; everything else comes straight from the asset store. A room page
  goes through the Worker so its link preview can say what the room is doing right now.
- **A room is a Durable Object.** Each shrine is one `Shrine` object, named after the room.
  It holds the room's state, takes every person's socket (with the hibernation API, so an
  idle room costs nothing), and is the source of truth: the page plays an action at once,
  then takes the shrine's counters as they come back.
- **Rules both sides play by** live in `shared/`: burn time, karma, vigils, the kami, charms,
  what a shrine opens as it grows. The Worker enforces them; the page plays by them.

## The life of an action

What happens when someone presses **Bow** in a shared shrine:

1. **The page plays it.** `bow()` in `src/app/altar.js` bows their figure, rings the bowl,
   adds the karma and writes the feed line straight away, then sends `{ t: 'bow', tz }` over
   the room's socket (`state.shrine`, a reconnecting WebSocket from `src/lib/room.js`).
2. **The Worker hands the socket to the room.** `/api/rooms/:room/ws` (`worker/routes/rooms.js`)
   checks the room's name and the rate limit, and passes the upgrade to that room's `Shrine`.
3. **The shrine looks up the action.** `webSocketMessage` in `worker/objects/shrine/index.js`
   rate-limits the socket (8 at once, 4 a second after), finds `bow` in its actions (a `Map`,
   so a message's `t` can only ever name an action) and runs it: `altar.js` checks the chorus,
   the morning bow and the scaffolding.
4. **Every act ends the same way.** An action that returns `true` is an act the room hears:
   the end of `webSocketMessage` pays its karma, feeds the kami, counts it in the open vigil,
   hangs any charm it earned, saves, tells the `World` object, and broadcasts `{ t: 'act', kind: 'bow', by, … }` with
   the room's counters to every socket. An action that returns anything else has answered
   (or refused) on its own.
5. **Every page takes it in.** `onShrineMessage` in `src/app/messages.js` keeps the counters,
   the altar and the records in step with the shrine, and plays the act for everyone who did
   not do it (`remoteAct`).

## What travels over a room's socket

**Page → shrine**: `{ t, …fields }`, one of these actions (each in the file of
`worker/objects/shrine/` named after its part):

| Part | Actions |
| --- | --- |
| `altar.js` | `light` (`down`), `down`, `burnout`, `bowl` (`note`), `bow` (`tz`), `puff`, `blame`, `omikuji` (`level`), `offer` (`kind`), `prayer` (`text`) |
| `vigils.js` | `meta` (`title`, `subtitle`, `eta`, `mix`, `scene`, `cloud`, `screen`), `resolve`, `unresolve` |
| `deploys.js` | `bless` (`what`, `tz`), `ship`, `broke` |
| `watch.js` | `watch` (`to`), `unwatch` |
| `standing.js` | `thank` (`to`), `vow` (`kind`) |
| `kami.js` | `hang` (`name`), `unhang` (`id`), `purify` |
| `people.js` | `rename` (`name`, `avatar`, `role`, `tone`) |
| `webhook.js` | `hook` (`reset`) |
| `notifications.js` | `push` (`sub`, `tz`, `topics`, `hello`, or `off` and `endpoint`) |

**Shrine → page**:

| `t` | When | Who hears it |
| --- | --- | --- |
| `state` | on connecting: everything the room keeps, and who you are (`me`) | you |
| `act` | someone did something: `kind`, `by`, what it earned, and the room's counters | everyone |
| `sync` | the counters changed without an act (incense burned down, a vow or watch expired) | everyone, or you |
| `meta` | the room's title, ETA, sound, scene, cloud or TV settings changed | everyone |
| `join`, `leave`, `rename` | someone knelt, left (after a five-second grace), or renamed | everyone (a `join`: everyone else) |
| `elsewhere` | you opened the shrine in a newer tab; this one steps aside | you |
| `nope` | an action was refused, and why (`thanked`, `watched`, `full`, `purified`) | you |
| `hook` | the webhook's key (`key`), or that someone replaced it (`stale`) | you, or everyone else |
| `push` | your notifications are on (`topics`), off, or the subscription was bad | you |

A TV's code screen talks to its `Pairing` object instead: it hears `{ t: 'code' }` with the
code it holds, and `{ t: 'cast', room }` when someone casts a shrine to it.

## HTTP

| Route | What | In |
| --- | --- | --- |
| `GET /api/health` | `om` | `routes/api.js` |
| `GET /api/status` | the site's mood, as JSON | `routes/api.js` |
| `GET /api/world` | totals across every shrine | `routes/api.js` |
| `GET /api/push/key` | the key browsers subscribe with; 404 when notifications are off | `routes/api.js` |
| `GET /new` | open a new shrine (`?name=` to choose its name), and go there | `routes/rooms.js` |
| `POST /api/rooms` | the same, for a page that stays put: `{ name }` → `{ room }` | `routes/rooms.js` |
| `GET /r/:room` | the room page, its link preview rewritten for the room | `routes/rooms.js` |
| `GET /api/rooms/:room/ws` | the room's socket | `routes/rooms.js` |
| `GET /api/rooms/:room/status` | the room at a glance (names stay in the room) | `routes/rooms.js` |
| `GET /api/rooms/:room/badge.svg` | the README badge | `routes/rooms.js` |
| `POST /api/rooms/:room/hook/:key` | the alerts webhook ([docs/alerting.md](docs/alerting.md)) | `routes/rooms.js` |
| `GET /api/tv/ws` | a TV's code screen | `routes/tv.js` |
| `POST /api/tv/:code/cast` | send a shrine to the TV holding that code | `routes/tv.js` |

Each IP is rate-limited per Cloudflare location: opening shrines, sockets, pairing and each
room's webhook have their own limits (`ratelimits` in `wrangler.jsonc`).

## What a shrine keeps

A shrine writes nothing until the first act, so a drive-by connect leaves no trace. Its
storage holds `altar` (the room's state: `EMPTY` in `worker/objects/shrine/state.js` lists
every field and what it means), `claimed` (opened from `/new`, nobody in yet), `hook` (the
webhook's key), `push` (the browsers that asked for notifications) and `sweep` (when it is
forgotten). One alarm rings for whichever comes first: the next morning nudge or evening
reminder, or the shrine forgotten after 30 days nobody visited, when it deletes itself.
A shrine from an older version is brought up to date as it loads (see the constructor).

## Tests

`npm test` runs `test/` with Node's own test runner. `test/support/worker.js` starts the
Worker through Vite and the Cloudflare plugin, as `npm run dev` does but on a free port and
with nothing kept on disk, and `Devotee` kneels in a room over a real socket: it can send,
wait for the next message of a kind, and wait for the room to have handled what it sent
(`settled()`). `shrine.test.js` covers the routes and a room's life; `actions.test.js` has a
test for every action; `strings.test.js` checks the page's words.

`npm run test:page` runs `test/page/` in a real browser: Playwright, headless Chromium, two at a
time (`playwright.config.js`). Each Playwright worker starts the same Worker with
`startWorker({ pages: true })`, which also serves the pages through the partials plugin from
`vite.config.js`. `test/support/page.js` gives every test a room of its own, `kneel()` to put
people beside the page over sockets (`Devotee`), and fails a test on any error a tab logs or
throws, except the 404 from `/api/push/key` (there is no VAPID key locally). `join.spec.js`
covers the join card and kneeling; `acts.spec.js` another person's acts reaching the feed;
`rename.spec.js` renaming from the More menu; `tabs.spec.js` a second tab of the same browser
stepping the first aside; `screens.spec.js` TV mode's QR code and the home page. CI runs them in
a job of their own. The first time on your machine, `npx playwright install chromium` fetches
the browser.

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
  background tabs). The page keeps the shrine's clock as an offset (`state.clockSkew`), so
  everyone's vigil timer agrees. The rules are written out at the top of that file.
- **The Worker** is a Hono app: a route file per area in `worker/routes/`, shared middleware
  in `worker/middleware.js`, and the Durable Objects in `worker/objects/`. The Shrine, the one
  that keeps a room, is a folder: `index.js` loads it and takes each message, and every other file
  is one part of the room (the altar, vigils, deploys, the watch, the kami…) with its `methods`
  and the `actions` a socket's message can ask for. A new ritual is an action in the part it
  belongs to; `test/actions.test.js` has a test for each.

A new part of the page usually means a partial, a stylesheet and a module with the same name.

**Nothing very long** is checked: no code file may grow past 400 lines or 24 KB
(`npm run check:size`). A file that would is split by what it does, into a folder. The few
that were already longer are listed in `scripts/size-budget.json`, each with a ceiling it
may not grow past, until they are split and come off the list.

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
  shrine.js              a shared shrine: entering it, kneeling, the live connection
  join.js                the join card: name, avatar, what you do, colour; renaming
  messages.js            what the shrine says over the socket, and what the page does about it
  people.js              people card and presence stack
  resolve.js             "they're back"
  shareSheet.js          invite + share card sheet
  menus.js               the top bar's Share and More menus
  cast.js, screen.js     Cast to TV, and the TV's own screens (the code, the QR to kneel from a phone)
  quiet.js               nothing down: the days without an incident, and the TV's sound mix
  kami.js                the kami's mask, meter and line under the heading, and what it watches
  beliefs.js             what the shrine believes, in the This shrine sheet
  vigilStart.js          saying something is down: the button, the question on lighting
  etaPicker.js           the Back at picker, in the heading and the builder
  openShrine.js          name fields and the Open sheet
src/landing/             the home page's sections (steps, rituals, grow, showcase, builder, TV…) and its world line
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
  music.js               generative ambient sound: the mixer for the eleven layers
  layers/                one synth per file (sacred.js, rain.js, koto.js…), and layer.js, the scale and the Layer they extend
src/lib/
  clock.js               the page's one clock, and the rules for anything timed
  config.js              settings: URL params > localStorage > defaults
  strings.js             every word the page says, by key: t('bowed'), data-i18n="bowed"
  strings/               …kept by area: dock, heading, vigils, kami, landing, tv, settings… (a key in one file only)
  room.js                room URL, saved name, reconnecting WebSocket
  share.js               the share card: live altar + stats as SVG, rasterised to PNG
  omikuji.js             the fortunes: five levels, three lines each
  icons.js               line icons for the dock, tray and pings
public/favicon*.svg      the Gate on its tile; -down is the ember tile a tab wears while a vigil is open
public/logo.svg          the Gate, full size
public/og*.png           the link preview cards (1200×630): the shrine, a room that is down, one that is back
public/wotdafong-*.svg   the Wot Da Fong P?! mark for the credit line
shared/                  used by the page and the Worker: the rules (burn time, karma, vigils, the kami), the kami’s lines, ready-made prayers, room names, link previews
worker/index.js          Cloudflare Worker: a Hono app that mounts the routes below
worker/middleware.js     security headers, API headers, rate limits, socket-only
worker/routes/api.js     /api/health, /api/status, /api/world
worker/routes/rooms.js   /new, /r/:room (link previews), a room's socket, status and badge
worker/routes/tv.js      /api/tv/ws and casting to a paired TV
worker/views/            the room page (r/index.html) with its link preview rewritten, the README badge SVG
worker/objects/shrine/     Shrine Durable Object, one per room: index.js and a file per part
  state.js                 what a shrine keeps, its limits, the demo's rules
  people.js, altar.js      who is here; the incense, bowl, bows, offerings, prayers
  vigils.js, deploys.js, watch.js   incidents, blessed deploys, who holds the pager
  standing.js, together.js what each person earns; the board, levels, cast and charms
  kami.js, webhook.js, notifications.js   the kami, the alerts webhook, Web Push
worker/objects/world.js    World Durable Object: totals across every shrine
worker/objects/pairing.js  Pairing Durable Object: one per TV code
wrangler.jsonc           Worker + Durable Object config
test/                    node --test: the Worker run through Vite, shrines over real sockets; every string key used exists
test/page/               Playwright: the pages in a browser against that Worker (playwright.config.js)
scripts/check-size.js    the size budget; size-budget.json lists the files waiting to be split
.github/workflows/ci.yml size budget, tests and build, and the page tests, on every push and pull request
```
