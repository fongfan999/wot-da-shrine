/**
 * What an alert says: something is down, or it is back. A shrine's webhook takes whatever the team's
 * alerting already sends (Alertmanager, Grafana, PagerDuty, Opsgenie, Statuspage, Better Stack,
 * Datadog, UptimeRobot) or a plain { "status": "down" | "up", "title": "…" }, and reads it here.
 *
 * readAlert returns { state: 'down' | 'up' | 'ignore', title, source }, or null when it can't tell.
 * 'ignore' is an event that is neither (acknowledged, a note added): answered, and nothing happens.
 */

const DOWN = new Set(['down', 'firing', 'triggered', 'trigger', 're-triggered', 'retriggered', 'open', 'opened', 'reopened', 'critical', 'alert', 'alerting', 'error', 'outage', 'major_outage', 'partial_outage', 'degraded', 'degraded_performance', 'problem', 'started', 'create', 'created', 'investigating', 'identified', 'monitoring', 'fail', 'failed', 'failing']);
const UP = new Set(['up', 'resolved', 'resolve', 'ok', 'recovered', 'recovery', 'closed', 'close', 'operational', 'normal', 'back', 'completed', 'postmortem', 'success', 'succeeded']);
const QUIET = new Set(['acknowledged', 'acknowledge', 'ack', 'snoozed', 'pending', 'no data', 'nodata', 'warn', 'warning', 'under_maintenance', 'scheduled', 'in_progress', 'verifying']);

/** 'down', 'up', 'ignore', or null for a word that means none of these. */
function word(value) {
  const w = String(value ?? '').trim().toLowerCase();
  if (!w) return null;
  if (DOWN.has(w)) return 'down';
  if (UP.has(w)) return 'up';
  if (QUIET.has(w)) return 'ignore';
  return null;
}

const text = (...values) => values.find((v) => typeof v === 'string' && v.trim())?.trim() ?? '';
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : null);

/** Each reader knows one tool's payload: null when the payload is not that tool's. */
const READERS = [
  // PagerDuty, webhooks v3: { event: { event_type: 'incident.triggered', data: { title } } }
  (b) => {
    const e = obj(b.event);
    if (typeof e?.event_type !== 'string' || !e.event_type.startsWith('incident.')) return null;
    const kind = e.event_type.slice('incident.'.length);
    const state = kind === 'triggered' || kind === 'reopened' ? 'down' : kind === 'resolved' ? 'up' : 'ignore';
    return { state, title: text(obj(e.data)?.title), source: 'PagerDuty' };
  },
  // Opsgenie: { action: 'Create' | 'Close' | …, alert: { message } }
  (b) => {
    if (typeof b.action !== 'string' || !obj(b.alert)) return null;
    const a = b.action.toLowerCase();
    return { state: a === 'create' ? 'down' : a === 'close' ? 'up' : 'ignore', title: text(b.alert.message), source: 'Opsgenie' };
  },
  // Atlassian Statuspage: { incident: { name, status } }, or { component_update: { new_status }, component: { name } }
  (b) => {
    const i = obj(b.incident);
    if (i && typeof i.status === 'string') return { state: UP.has(i.status) ? 'up' : 'down', title: text(i.name), source: 'Statuspage' };
    const u = obj(b.component_update);
    if (u && typeof u.new_status === 'string') {
      const state = u.new_status === 'operational' ? 'up' : /outage/.test(u.new_status) ? 'down' : 'ignore';
      const name = text(obj(b.component)?.name);
      return { state, title: name && state === 'down' ? `${name} is down` : name, source: 'Statuspage' };
    }
    return null;
  },
  // Better Stack Uptime: { data: { type: 'incident', attributes: { status: 'Started' | 'Acknowledged' | 'Resolved', name, url } } }
  (b) => {
    const a = obj(obj(b.data)?.attributes);
    if (typeof a?.status !== 'string') return null;
    return { state: word(a.status) ?? 'ignore', title: text(a.name, a.cause, a.url), source: 'Better Stack' };
  },
  // Prometheus Alertmanager and Grafana: { status: 'firing' | 'resolved', alerts: [...], commonLabels, commonAnnotations, title? }
  (b) => {
    if (!Array.isArray(b.alerts) || typeof b.status !== 'string') return null;
    const labels = obj(b.commonLabels) ?? obj(b.alerts[0]?.labels) ?? {};
    const notes = obj(b.commonAnnotations) ?? obj(b.alerts[0]?.annotations) ?? {};
    // Grafana's title reads "[FIRING:1] HighErrorRate …": the bracket is the status, already known.
    const title = text(notes.summary, labels.alertname, String(b.title ?? '').replace(/^\[[^\]]*\]\s*/, ''));
    return { state: word(b.status) ?? 'ignore', title, source: 'orgId' in b || 'ruleUrl' in b || 'title' in b ? 'Grafana' : 'Alertmanager' };
  },
  // Datadog, with the payload's $ALERT_TRANSITION: { alert_transition: 'Triggered' | 'Recovered', title }
  (b) => {
    const t = b.alert_transition ?? b.transition;
    if (typeof t !== 'string') return null;
    return { state: word(t) ?? 'ignore', title: text(b.title, b.alert_title, b.event_title), source: 'Datadog' };
  },
  // UptimeRobot: alertType 1 is down, 2 is up; JSON, a form, or the query string.
  (b) => {
    if (b.alertType === undefined || (b.monitorFriendlyName === undefined && b.monitorURL === undefined)) return null;
    const t = String(b.alertType);
    return { state: t === '1' ? 'down' : t === '2' ? 'up' : 'ignore', title: text(b.monitorFriendlyName, b.monitorURL), source: 'UptimeRobot' };
  },
  // Anything else that says it plainly: { status | state: 'down' | 'up' | 'firing' | 'resolved' | …, title | name | message | summary }
  (b) => {
    const state = word(b.status) ?? word(b.state);
    if (!state) return null;
    return { state, title: text(b.title, b.name, b.message, b.summary, b.text), source: text(b.source, b.from) };
  },
];

/**
 * Reads an alert. `body` is the request's text, `type` its Content-Type, `query` its URL's search
 * params, where ?status= says what happened outright, ?title= names it and ?from= names the sender.
 * An empty body says something is down: a bare `curl -X POST` is the simplest alarm there is.
 */
export function readAlert(body, type, query) {
  const raw = String(body ?? '').trim();
  const json = /json/i.test(type ?? '') || /^[[{]/.test(raw);
  const form = !json && /x-www-form-urlencoded/i.test(type ?? '');
  let fields = null;
  if (json) {
    try { fields = JSON.parse(raw); } catch { return null; }
    if (Array.isArray(fields)) fields = fields[0]; // a few tools send a list of one
    if (!obj(fields)) return null;
  } else if (form) {
    fields = Object.fromEntries(new URLSearchParams(raw));
  }
  // The query string counts as fields too (UptimeRobot can send its alerts there), under whatever the body says.
  const q = Object.fromEntries(query);
  fields = { ...q, ...fields };
  let alert = null;
  for (const read of READERS) if ((alert = read(fields))) break;
  // An empty body, or plain words: something is down, and the words (if any) say what. curl -d sends
  // its words as a form, so a "form" with no field in it is words too.
  if (!alert && !json && !(form && raw.includes('='))) alert = { state: 'down', title: form ? new URLSearchParams(`w=${raw}`).get('w') : raw, source: '' };
  // ?status= has the last word, then ?title= and ?from=.
  const said = word(q.status);
  if (said) alert = { title: '', source: '', ...alert, state: said };
  if (!alert) return null;
  if (q.title) alert.title = q.title;
  if (q.from) alert.source = q.from;
  return alert;
}
