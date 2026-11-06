/** The heading over the altar: what is down, the headlines a shrine gets until it names it, the days without an incident. A part of STRINGS (src/lib/strings.js). */

export default {
  eyebrow: 'Scheduled maintenance',
  title: 'The servers are meditating. Stop pinging',
  subtitle: 'The ops team is already praying. Light some incense, make an offering, and the rack will hum again shortly.',
  // A shrine that has not named what is down gets one of these, the same for everyone in it (see
  // headlineFor). The title's last word is set in italics, so each ends on the one worth leaning on.
  headlines: [
    ['The servers are meditating. Stop pinging', 'Every ping just comes back as a timeout. Light some incense and wait for them to open their eyes.'],
    ['Prod is napping. Your boss is not', 'Three missed calls already, and the fourth is dialing. Light the incense fast and think of an answer.'],
    ['The cloud is down, but still billing', 'The instances are off and the meter is still running. Keep the offering small; the budget has an invoice to pay.'],
    ['Five nines, minus four', 'The contract says 99.999%. The dashboard says 9%. Pray they come home before anyone rereads the SLA.'],
    ['The pods are finding themselves. Restart #47', 'CrashLoopBackOff sounds like a meditation school. Light incense, read the logs, and nobody delete a pod mid-retreat.'],
    ['The database is on retreat. The backups are untested', 'The latest backup is from when the company was three people. Pray it still restores.'],
    ['Prod took a vow of silence. So did the logs', 'No errors, no warnings, not one line. This kind of quiet is scarier than a stack trace. Pray softly.'],
    ['Shipped on a Friday. Light the incense', 'Someone said “it’s a one-line change”. Light a stick in its memory, then roll back while there’s still a weekend.'],
    ['Errors everywhere. Works on my machine', 'Sadly, the customers aren’t on your machine. Pray, or ship the laptop to production.'],
    ['The cache let go. The database is carrying the team', 'Every request goes straight to the database, CPU at 100% and still holding. Pray the cache remembers, so the database can breathe.'],
    ['Kubernetes is contemplating. The YAML is off by a space', 'Three hundred lines of YAML, one of them wrong, and nobody knows which. Light incense and count the spaces again.'],
    ['The packets went on a pilgrimage. Blame DNS', 'It’s always DNS, even when it isn’t DNS. Light a lantern to guide them home, and wait out the TTL.'],
    ['The pager has spoken. At 3 a.m.', 'Thirty alerts at once, every one of them critical. Get up, splash some water, and pray together.'],
    ['Latency reached nirvana. The spinner is on its next life', 'Users are on their tenth refresh. Pray the response lands before they switch to a competitor.'],
    ['The servers took PTO. No Jira ticket', 'No request, no handover, nobody covering. Offer a coffee; they may be back before standup.'],
    ['The status page is all green. Reddit disagrees', 'It still says All Systems Operational while the thread fills with screenshots. The team knows better and prays anyway.'],
  ],
  tagline: 'Pray for uptime, together.',
  madeBy: 'Made by',
  openSource: 'Open source on GitHub',
  feedback: 'Report a bug or ask for a feature',
  feedbackHint: 'Write to hey@wotdafong.dev',
  feedbackFoot: 'Report a bug, ask for a feature',

  // A shrine with nothing down: the heading counts the days, and the kami has its say
  quietEyebrow: 'Under the shrine’s protection',
  quietDays: '{n} days without an incident',
  quietDay: 'A whole day without an incident',
  quietHours: 'Quiet for {n} hours',
  quietHour: 'Quiet for an hour',
  quietMinutes: 'Quiet for {n} minutes',
  quietMinute: 'Quiet for a minute',
  quietNever: 'Nothing has gone down. Yet.',
  quietNeverSub: 'This screen keeps the shrine. When something goes down, press Something’s down on any phone in it.',
};
