# How it works

- `/` is the landing page. The altar on the first screen is a demo: light
  it, ring the bowl, say a prayer, and after a few actions it points you at
  the one thing to do here, open a shrine for your team. Rituals, vigils,
  records and sharing only exist in a shrine, and
  nothing done on the demo is counted in the world totals. Below it: a day
  at the shrine (the bow before standup, a blessed deploy, the watch handed
  over, the 7 pm reminder, the rare incident, a new week), the rituals (a
  deploy blessed against the omens, today's forecast, a fortune, a burned
  blame), the shrine growing through its six levels (its own copy of the
  temple and a team on its mats: raise a level, skip feeding the kami, hang
  your cloud's lantern), how the link and the alerts reach the incident
  channel, and the war-room TV.
- There is no solo page: praying alone is a shrine with one person in it.
  For planned downtime the landing page's builder makes a shrine of its own,
  `/r/<slug>?title=…&eta=…`, whose first visit gives the room that title and
  time. Settings has three tabs: This shrine (title, subtitle, sound, scene, alerts, README badge),
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
