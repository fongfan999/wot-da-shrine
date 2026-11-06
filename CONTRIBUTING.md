# Contributing

Thanks for wanting to make the shrine better. Bug fixes, new rituals, sounds, copy, another
alerting tool the webhook should read: all welcome. For something big, open an issue first
so we can agree on the shape of it before you build it.

[ARCHITECTURE.md](ARCHITECTURE.md) explains how the pieces fit together, and the
[guide](docs/README.md) what every part of a shrine does.

## Set up

You need Node 22.12 or newer (`.nvmrc` says 24).

```bash
npm install
npm run dev        # the pages, the Worker and its Durable Objects in workerd, http://localhost:5173
```

That is all a shrine needs locally. Notifications also need a key, which only matters if
you work on them:

```bash
npm run vapid --silent -- --dev >> .dev.vars
```

## Before you open a pull request

```bash
npm run check      # the size budget, the tests and the build: what CI runs on every pull request
npm run test:page  # the pages in a browser: CI runs these too, in a job of their own
```

- **Tests**: `npm test` takes a few seconds. It starts the real Worker and kneels in shrines
  over real sockets ([ARCHITECTURE.md § Tests](ARCHITECTURE.md#tests)). A change to what a
  shrine does gets a test; a new action gets one in `test/actions.test.js`.
- **Page tests**: `npm run test:page` takes about fifteen seconds. It opens the pages in
  headless Chromium (Playwright) against the same Worker: the join card, someone else's acts
  in the feed, renaming, a second tab, TV mode, the home page and a phone, and no tab may log an error.
  The first time, `npx playwright install chromium` fetches the browser. A change to one of
  those flows, or to what the page does with a shrine's messages, gets a test in `test/page/`.
- **The size budget**: no code file may grow past 400 lines or 24 KB (`npm run check:size`).
  When one would, split it by what it does, into a folder: that is how
  `worker/objects/shrine/` and `src/lib/strings/` came about. The few drawing files still
  over it are listed in `scripts/size-budget.json` and may not grow.
- **Look at it**: for anything on screen, try it in the browser, in both themes and on a
  phone-sized window, and put a screenshot in the pull request.

## Where things go

| You want to… | Do this |
| --- | --- |
| change some words | find the key in `src/lib/strings/` (one file per area: `dock.js`, `vigils.js`, `kami.js`, `landing.js`…). A key lives in one file only; the tests fail on a key said twice or a key the page asks for that does not exist. Markup uses `data-i18n="key"`, code `t('key')`. |
| add a part of the page | a partial in `src/partials/`, a stylesheet in `src/styles/` and a module in `src/app/` with the same name, and an `<include>` line where it goes. |
| add something a shrine does | the page sends it (`state.shrine.send('name', { … })`), the room handles it as an action in the part of `worker/objects/shrine/` it belongs to (return `true` when it is an act the room hears), and every page reacts to it in `src/app/messages.js`. Add a test for the action. |
| change a rule both sides play by | `shared/rules.js` (karma, timings, charms, what opens when). The Worker enforces it and the page plays by it, so change it in one place. |
| add a sound layer | a synth in `src/audio/layers/` extending `Layer`, a line in `SYNTHS` (`src/audio/music.js`), its key in `LAYERS` (and `UNLOCKS`, if a shrine opens it as it grows), a slider in `src/partials/settings.html`, and its name and hint in `src/lib/strings/settings.js`. |
| teach the webhook another tool | a reader in `READERS` in `worker/alerts.js`, and a test that posts its payload. |
| show something that changes with time | run it on `src/lib/clock.js`, never an interval of its own (the rules are at the top of that file). |

## House rules

- **No new cards.** The column beside the altar is full. Something new goes in a line of
  something that exists, a sheet, the kami, or the feed.
- **Names stay in the room.** Link previews, badges, the world counter and anything else a
  stranger can see never show a person's name, and only the ready-made prayers are ever
  echoed outside a room.
- **The demo shrine is safe for a wall.** `/r/demo` is public and streamed onto the home
  page: anything you add takes only what it can trust there, or is off in the demo.
- **The shrine is the source of truth.** The page may play an action at once, but the
  counters, the vigil and what anyone earned are what the shrine says.
- **Every frame costs, on the slowest phone.** What moves forever moves on the compositor
  (`transform` or `opacity` on an HTML element, with `will-change` if script moves it) or is
  drawn on a canvas. A loop on an SVG attribute, a box-shadow or anything else that repaints
  goes through `stepped()` (`src/scene/stepped.js`) or the clock, and lite mode stops it. A
  write that changes nothing still costs: compare first. Try a change with `?fx=lite` and the
  CPU throttled 6× in DevTools.

## Pull requests

Keep a pull request to one change, and say what it does and why. CI runs `npm run check`
on it. A maintainer merges it, and merging to `main` deploys to
[shrine.wotda.app](https://shrine.wotda.app).

By contributing you agree your work is shared under the project's
[license](LICENSE) (O'Saasy: MIT-style, without the right to sell it as a competing
hosted service).
