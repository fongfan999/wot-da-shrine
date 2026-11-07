# URL parameters

| Param      | Values                                   | Example                        |
| ---------- | ---------------------------------------- | ------------------------------ |
| `title`    | any text (rooms only)                    | `?title=Back+in+5+minutes`     |
| `subtitle` | any text (rooms only)                    | `?subtitle=Deploying+v2.0`     |
| `eta`      | ISO 8601 date/time (rooms only)          | `?eta=2026-10-14T18:30:00Z`    |
| `track`    | a preset: `vigil` `focus` `chant` `rain` `spa` `garden` (rooms only) | `?track=focus` |
| `mix`      | layers and levels, `layer:0-100,…` (rooms only) | `?mix=garden:70,noise:30`  |
| `theme`    | `auto` `light` `dark`                    | `?theme=dark`                  |
| `music` `sfx` `petals` `fog` | `1` / `0`              | `?petals=0&fog=0`              |
| `lang`     | `en` `vi`                                | `?lang=vi`                     |

`title`, `subtitle`, `eta`, `track` and `mix` seed a room that has none yet, e.g.
`/r/serene-rack-42?title=Payments+API`. The rest work everywhere.

`lang` is for that visit only. Without it the page speaks what was chosen in Settings (Just for
you → Language), or else guesses: Vietnamese for a browser whose first language of ours is
Vietnamese, or whose clock is set to Vietnam, and English for everyone else.
