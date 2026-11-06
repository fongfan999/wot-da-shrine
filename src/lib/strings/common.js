/** Words every part of the page uses: how long something took, how long ago, who you are until you say. A part of STRINGS (src/lib/strings.js). */

export default {
  // How long (minutesText in src/app/context.js)
  durMin: '{n} min',
  durHm: '{h}h {m}m',
  durDh: '{d}d {h}h',
  // How long ago, in the feed's corner (ago in src/app/ui.js)
  agoNow: 'now',
  agoMin: '{n}m',
  agoHour: '{n}h',
  agoDay: '{n}d',
  copyThis: 'Copy this:',
  /** What someone is called until they say (src/app/join.js). */
  defaultNames: ['Sleepy sysadmin', 'On-call monk', 'Intern of the week', 'Senior YAML engineer', 'Database whisperer', 'Kubernetes pilgrim', 'Release shaman', 'Log reader'],
};
