# Sharing

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
  celebration, any other the shrine's own card, which is also the home page's.
  In dev, `await __incense.previewCard('home' | 'down' | 'back')` draws them
  again from the live altar ('home' on the home page, in the light theme, for
  the head temple around it), at twice the size: scale them to 1200×630.
- **The share card**: a PNG of this shrine as it is right now, drawn from the
  live altar (every offering on the table), the team's avatars, how long
  you prayed, the karma and the last prayers. Share it, copy it or download
  it; it comes with a caption. Light or dark, to match the page.
- **They're back!**: when the servers come back, press the button. Bells, a
  shower of petals, +20 karma for the room, the heading becomes "The servers
  are back", and the share card is offered at the one moment people want to
  post it. Everyone in the room sees the celebration.
- **The world**: the landing page says what every shrine is doing, under its
  Open a shrine button and in its side card: prayers sent, shrines opened,
  how many are burning right now, and the last thing that happened (only the
  ready-made prayers are ever echoed, never free text, and no room name
  leaves the counter).
- **For the retro**: the share sheet also hands out the vigil as a few lines
  of Markdown (down for how long, people at the peak, prayers, blames,
  fortunes, karma, the link) for the postmortem doc.
- **A badge for the README or status page**, under Settings → **README badge**:
  `[![Wot Da Shrine](https://shrine.wotda.app/api/rooms/serene-rack-42/badge.svg)](https://shrine.wotda.app/r/serene-rack-42)`
  shows "shrine | down 12m · 3 praying" while a vigil is open, "back · 3
  praying" for the hour after, and otherwise who is there and whether the
  incense burns. It links to the altar.
