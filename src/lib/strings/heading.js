/** The heading over the altar: what is down, the headlines a shrine gets until it names it, the days without an incident. A part of STRINGS (src/lib/strings.js). */

export default {
  eyebrow: 'Scheduled maintenance',
  title: 'The servers are meditating',
  subtitle: 'The ops team is already praying. Light some incense, make an offering, and the rack will hum again shortly.',
  // A shrine that has not named what is down gets one of these, the same for everyone in it (see
  // headlineFor). The title's last word is set in italics, so each ends on the one worth leaning on.
  headlines: [
    ['The servers are meditating', 'The ops team is already praying. Light some incense, make an offering, and the rack will hum again shortly.'],
    ['Production is taking a nap', 'Let it rest. Light the incense, keep your voice down, and it will wake up refreshed.'],
    ['The cloud is having a moment', 'Every cloud has one. Kneel, breathe, and offer it something warm.'],
    ['Our uptime has ascended', 'It left without a forwarding address. Pray it finds its way back down.'],
    ['The pods are finding themselves', 'Give them space. A little incense, a little patience, and they will be Ready.'],
    ['The database is on retreat', 'No connections, no queries, only silence. Invite it back gently, with an offering.'],
    ['Prod took a vow of silence', 'Every request gets the same answer: nothing. Ask nicely, and with incense.'],
    ['Rest in peace, deploy', 'It lived a short life in production. Light a stick in its memory, and roll back in peace.'],
    ['Errors are in full bloom', 'Spring came early to the logs. Pray the season passes quickly.'],
    ['The cache found detachment', 'It remembers nothing now, and every request is a fresh start. Help it recall with an offering.'],
    ['Kubernetes is contemplating', 'It is weighing every pod against its desired state. The team prays it reaches consensus.'],
    ['Packets are on a pilgrimage', 'They left the data center hours ago, seeking enlightenment. Light a lantern to guide them home.'],
    ['The pager has spoken', 'And it said everything at once. Kneel, breathe, and answer it together.'],
    ['Latency has reached nirvana', 'Every request is now timeless. Pray it comes back down to a few milliseconds.'],
    ['The servers are on sabbatical', 'They did not file the paperwork. Pray, offer coffee, and they may return early.'],
    ['The status page is optimistic', 'It still says All Systems Operational. The team knows better, and is praying anyway.'],
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
