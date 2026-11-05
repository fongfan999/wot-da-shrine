# Features

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
