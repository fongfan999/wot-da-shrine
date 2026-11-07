# Notifications

A shrine can call people back while it is closed. In a shrine, Settings →
Just for you → **Turn on notifications** subscribes this browser to this
shrine, and the shrine offers it once at the moments it matters: when you
take the watch, right after your morning bow (the very first one already,
since tomorrow's is the one that makes a habit: "Want a nudge tomorrow at
about 9:40 AM, so it becomes a run?"), and when a vigil you sat through ends.
It sends:

- **Something's down**: a vigil opened, by a person or an alert ("Grafana
  raised the alarm in payments-war-room. Come kneel."). Urgent, and it stays on
  screen until it is tapped. A flapping monitor is heard once in ten minutes.
- **They're back**: the same vigil ended, replacing the down message, to those
  who heard it go down. "Not back after all" if it is taken back.
- **You hold the watch**: someone handed it to you.
- **Bow before standup**: in the morning, if your run is waiting on today's
  bow, the day after your first bow included ("Day 2 starts with a bow").
  It comes at about the time of day you last made your morning bow, so it
  lands near your standup and follows you if that moves; kept between 7:00
  and 11:30, and 9:30 for a bow made outside them (`morningMinute` in
  `shared/rules.js`).
- **Keep your run**: at 7 pm on your clock, if your run of two or more morning
  bows is still waiting on today's.
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
