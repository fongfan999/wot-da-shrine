# Straight from your alerting

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
