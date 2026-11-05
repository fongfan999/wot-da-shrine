/** Web Push: the browsers that asked to hear from this shrine, what they hear when, and the morning and evening reminders. A part of the Shrine (index.js). */
import { cleanSub, send as sendPush, topicOf } from '../../push.js';
import { kamiLine, kamiMood } from '../../../shared/kami.js';
import { cleanTz, dayOf, devoteeKey, KAMI_HUNGRY, MORNING_LATE, morningMinute } from '../../../shared/rules.js';

/**
 * Notifications: browsers that asked to hear from this shrine while nobody has it open. Each is kept
 * under its push endpoint, with whose it is (name and avatar, as the ledger knows them), what they
 * want to hear about and their clock, for the evening reminder.
 */
const MAX_SUBS = 100;
const PUSH_TOPICS = ['down', 'watch', 'morning', 'kami'];
const PUSH_COOLDOWN = 10 * 60 * 1000; // a flapping monitor opens vigil after vigil: phones hear the first
const REMIND_AT = 19 * 3600 * 1000; // a run waiting on today's bow is mentioned at 7 in the evening, their time
const DAY = 86400000;
const cleanTopics = (raw) => Object.fromEntries(PUSH_TOPICS.map((k) => [k, raw?.[k] !== false]));
/** The morning nudge for a run of `streak` mornings that today's bow would keep. */
const morningNudge = (streak, room) => (streak > 1
  ? { title: `Day ${streak + 1} of your run`, body: `Your ${streak}-morning run at ${room} is waiting on today's bow. The kami is up.`, tag: `${room}:morning`, url: `/r/${room}` }
  : { title: 'Day 2 starts with a bow', body: `You bowed at ${room} yesterday. One bow this morning makes it a run.`, tag: `${room}:morning`, url: `/r/${room}` });
const minutes = (m) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim() : `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`);

/** Methods of the Shrine: `this` is the shrine. */
export const methods = {
  async savePush() {
    await this.ctx.storage.put('push', this.subs);
    await this.touch();
    await this.schedule();
  },

  /**
   * Tell the browsers that asked, for one of:
   * 'down'   a vigil opened: everyone who wants to know and is not already kneeling here
   * 'back'   it closed, survived: the same people, if they heard it go down
   * 'unback' not back after all: the same again
   * 'watch'  the watch was handed to `to`: their browsers, wherever they are
   */
  notify(kind, { by, to, record } = {}) {
    if (this.demo || !this.env.VAPID_KEY) return;
    const room = this.ctx.id.name;
    const subs = Object.values(this.subs);
    if (!room || !subs.length) return;
    const s = this.state;
    const here = new Set(this.people().map(devoteeKey));
    const url = `/r/${room}`;
    const away = (sub) => sub.topics.down && !here.has(devoteeKey(sub)) && (!by || devoteeKey(sub) !== devoteeKey(by));
    const n = this.people().length;
    if (kind === 'down') {
      const now = Date.now();
      if (now - (s.pushedAt ?? 0) < PUSH_COOLDOWN) return;
      s.pushedAt = now;
      s.vigil.pushed = true;
      const alert = by?.id === 'hook';
      const kneeling = n ? `${n} praying.` : alert ? 'Nobody is kneeling yet.' : '';
      const body = `${by?.name ?? 'Someone'} ${alert ? 'raised the alarm' : 'opened the vigil'} in ${room}. ${kneeling} Come kneel.`.replace(/\s+/g, ' ');
      this.pushTo(subs.filter(away), { title: s.meta.title || 'Something is down', body, tag: `${room}:vigil`, url, urgent: true }, { urgency: 'high', topic: topicOf('vigil', room) });
    } else if (kind === 'back') {
      // The title is whatever the room called it ("Payments API", "Payments API is down"): quoted, it reads either way.
      const what = record?.title ? `The vigil for “${record.title}”` : 'The vigil';
      const who = by?.name ? ` ${by.id === 'hook' ? `${by.name} says it cleared.` : `${by.name} said so.`}` : '';
      this.pushTo(subs.filter(away), { title: "They're back!", body: `${what} ended after ${minutes(record?.minutes ?? 1)}.${who}`, tag: `${room}:vigil`, url }, { topic: topicOf('vigil', room) });
    } else if (kind === 'unback') {
      this.pushTo(subs.filter(away), { title: 'Not back after all', body: `${by?.name ?? 'Someone'} took it back: ${s.meta.title || 'the servers'} still down in ${room}.`, tag: `${room}:vigil`, url, urgent: true }, { urgency: 'high', topic: topicOf('vigil', room) });
    } else if (kind === 'watch') {
      const mine = subs.filter((sub) => sub.topics.watch && devoteeKey(sub) === devoteeKey(to));
      this.pushTo(mine, { title: 'You hold the watch', body: `${by.name} handed you the watch in ${room}. Sleep lightly.`, tag: `${room}:watch`, url }, { topic: topicOf('watch', room) });
    }
  },

  /** Send one message to these subscriptions, in the background, forgetting any the browser has dropped. */
  pushTo(list, msg, opts = {}) {
    if (!list.length) return;
    const ttl = opts.ttl ?? (msg.urgent ? 6 * 3600 : 12 * 3600);
    const p = Promise.all(list.map(async (sub) => [sub.endpoint, await sendPush(this.env, sub, msg, { ...opts, ttl })])).then(async (results) => {
      const gone = results.filter(([, r]) => r === 'gone');
      if (!gone.length) return;
      for (const [endpoint] of gone) delete this.subs[endpoint];
      await this.ctx.storage.put('push', this.subs);
    });
    this.ctx.waitUntil(p.catch(() => {}));
    return p;
  },

  /** The next time any subscriber's morning nudge or evening reminder could be due, after `now`. */
  nextReminder(now) {
    let next = Infinity;
    const after = (sub, offset) => {
      const shift = sub.tz * 60000;
      let at = Math.floor((now + shift) / DAY) * DAY + offset - shift;
      if (at <= now) at += DAY;
      next = Math.min(next, at);
    };
    for (const sub of Object.values(this.subs)) {
      if (!sub.topics?.morning && !sub.topics?.kami) continue;
      after(sub, REMIND_AT);
      const d = sub.topics.morning ? this.state.devotees[devoteeKey(sub)] : null;
      if (d?.at) after(sub, morningMinute(d.at, sub.tz) * 60000);
    }
    return next;
  },

  /**
   * The morning nudge, at about the time each subscriber last made their morning bow (morningMinute):
   * someone whose run is waiting on today's bow, the first day after their first bow included, hears
   * that today's keeps it going. Then the evening reminder, one a day at most, at 7 pm by their clock.
   * First the kami: once it has gone KAMI_HUNGRY unfed, everyone who asked hears so, once per hunger
   * (a meal starts it over). Else their run of morning bows: someone whose run (two or more) is still
   * waiting on today's hears that it ends at midnight. Nobody kneeling here is told any of it.
   */
  async remind(now) {
    const room = this.ctx.id.name;
    if (this.demo || !room) return;
    const here = new Set(this.people().map(devoteeKey));
    const k = this.state.kami;
    const hungry = k.fedAt && now - k.fedAt >= KAMI_HUNGRY;
    const due = [];
    for (const sub of Object.values(this.subs)) {
      if (!sub.topics?.morning && !sub.topics?.kami) continue;
      const shift = sub.tz * 60000;
      const day = dayOf(now, sub.tz);
      const d = this.state.devotees[devoteeKey(sub)];
      const away = !here.has(devoteeKey(sub));
      if (sub.topics.morning && d?.at && sub.morningTold !== day) {
        const at = day * DAY + morningMinute(d.at, sub.tz) * 60000 - shift;
        if (now + 1000 >= at) {
          sub.morningTold = day;
          if (away && d.day === day - 1 && now - at < MORNING_LATE) due.push([sub, morningNudge(d.streak, room), 'morning']);
        }
      }
      if (sub.reminded === day || now + 1000 < day * DAY + REMIND_AT - shift) continue;
      sub.reminded = day;
      if (!away) continue;
      if (sub.topics.kami && hungry && sub.kamiTold !== k.fedAt) {
        sub.kamiTold = k.fedAt;
        due.push([sub, { title: 'The kami is hungry', body: `${kamiLine(kamiMood(k, now), k, room, { now, tz: sub.tz, things: this.state.guarded.map((o) => o.name) })} One bow at ${room} will do.`, tag: `${room}:kami`, url: `/r/${room}` }, 'kami']);
        continue;
      }
      if (!sub.topics.morning) continue;
      if (!d || d.streak < 2 || d.day !== day - 1) continue;
      due.push([sub, { title: `Keep your ${d.streak}-morning run`, body: `You haven't bowed at ${room} today. One bow before midnight keeps it going.`, tag: `${room}:morning`, url: `/r/${room}` }, 'morning']);
    }
    await this.ctx.storage.put('push', this.subs);
    for (const [sub, msg, topic] of due) this.pushTo([sub], msg, { ttl: 4 * 3600, topic: topicOf(topic, room) });
  },
};

/** What a message from a socket does, by its `t` (see webSocketMessage in index.js). */
export const actions = {
  async push(act) {
    const { ws, msg, self } = act;
    // This browser wants to hear from the shrine (or no longer does). Its owner is whoever is
    // kneeling on this socket. Never in the demo, where nobody is anybody.
    if (this.demo) return;
    if (msg.off === true) {
      const endpoint = String(msg.endpoint ?? '');
      if (this.subs[endpoint]) { delete this.subs[endpoint]; await this.savePush(); }
      ws.send(JSON.stringify({ t: 'push', on: false }));
      return;
    }
    const sub = cleanSub(msg.sub);
    if (!sub) { ws.send(JSON.stringify({ t: 'push', error: 'bad-subscription' })); return; }
    const was = this.subs[sub.endpoint];
    this.subs[sub.endpoint] = { ...sub, name: self.name, avatar: self.avatar, tz: cleanTz(msg.tz), topics: cleanTopics(msg.topics), at: Date.now(), reminded: was?.reminded ?? 0 };
    // A full list lets go of whoever subscribed, or last came back, longest ago.
    const all = Object.values(this.subs);
    if (all.length > MAX_SUBS) delete this.subs[all.reduce((a, b) => (a.at <= b.at ? a : b)).endpoint];
    if (!this.stored) await this.save(); // a shrine nobody has used yet: it is in use now
    await this.savePush();
    ws.send(JSON.stringify({ t: 'push', on: true, topics: this.subs[sub.endpoint].topics }));
    // The first time: one right away, so they know it works.
    if (!was && msg.hello === true) this.pushTo([this.subs[sub.endpoint]], { title: 'Notifications are on', body: `You'll hear from ${this.ctx.id.name} when it needs you.`, tag: `${this.ctx.id.name}:hello`, url: `/r/${this.ctx.id.name}` });
  },
};
