/** Web Push: the browsers that asked to hear from this shrine, what they hear when, and the morning and evening reminders. A part of the Shrine (index.js). */
import { cleanSub, send as sendPush, topicOf } from '../../push.js';
import { kamiLine, kamiMood } from '../../../shared/kami.js';
import { cleanTz, dayOf, devoteeKey, KAMI_HUNGRY, MORNING_LATE, morningMinute } from '../../../shared/rules.js';
import { cleanLang, lasted, say, WORDS } from './words.js';

/**
 * Notifications: browsers that asked to hear from this shrine while nobody has it open. Each is kept
 * under its push endpoint, with whose it is (name and avatar, as the ledger knows them), what they
 * want to hear about, their clock, for the evening reminder, and their language (words.js): each
 * hears every message in the one their page spoke when it last said who it was.
 */
const MAX_SUBS = 100;
const PUSH_TOPICS = ['down', 'watch', 'morning', 'kami'];
const PUSH_COOLDOWN = 10 * 60 * 1000; // a flapping monitor opens vigil after vigil: phones hear the first
const REMIND_AT = 19 * 3600 * 1000; // a run waiting on today's bow is mentioned at 7 in the evening, their time
const DAY = 86400000;
const cleanTopics = (raw) => Object.fromEntries(PUSH_TOPICS.map((k) => [k, raw?.[k] !== false]));
/** The morning nudge for a run of `streak` mornings that today's bow would keep, in `lang`. */
const morningNudge = (lang, streak, room) => (streak > 1
  ? { title: say(lang, 'runTitle', { next: streak + 1 }), body: say(lang, 'runBody', { n: streak, room }), tag: `${room}:morning`, url: `/r/${room}` }
  : { title: say(lang, 'secondTitle'), body: say(lang, 'secondBody', { room }), tag: `${room}:morning`, url: `/r/${room}` });

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
      // Each browser hears it in its own language: a message is made for each (pushTo).
      this.pushTo(subs.filter(away), ({ lang }) => {
        const kneeling = n ? say(lang, 'downPraying', { n }) : alert ? say(lang, 'downNobody') : '';
        const body = say(lang, alert ? 'downAlarm' : 'downOpened', { name: by?.name ?? say(lang, 'someone'), room, kneeling }).replace(/\s+/g, ' ');
        return { title: s.meta.title || say(lang, 'downTitle'), body, tag: `${room}:vigil`, url, urgent: true };
      }, { urgency: 'high', topic: topicOf('vigil', room) });
    } else if (kind === 'back') {
      // The title is whatever the room called it ("Payments API", "Payments API is down"): quoted, it reads either way.
      this.pushTo(subs.filter(away), ({ lang }) => {
        const what = record?.title ? say(lang, 'backFor', { title: record.title }) : say(lang, 'backPlain');
        const who = by?.name ? ` ${say(lang, by.id === 'hook' ? 'backHook' : 'backBy', { name: by.name })}` : '';
        return { title: say(lang, 'backTitle'), body: `${say(lang, 'backBody', { what, t: lasted(lang, record?.minutes ?? 1) })}${who}`, tag: `${room}:vigil`, url };
      }, { topic: topicOf('vigil', room) });
    } else if (kind === 'unback') {
      this.pushTo(subs.filter(away), ({ lang }) => ({ title: say(lang, 'unbackTitle'), body: say(lang, 'unbackBody', { name: by?.name ?? say(lang, 'someone'), what: s.meta.title || say(lang, 'theServers'), room }), tag: `${room}:vigil`, url, urgent: true }), { urgency: 'high', topic: topicOf('vigil', room) });
    } else if (kind === 'watch') {
      const mine = subs.filter((sub) => sub.topics.watch && devoteeKey(sub) === devoteeKey(to));
      this.pushTo(mine, ({ lang }) => ({ title: say(lang, 'watchTitle'), body: say(lang, 'watchBody', { name: by.name, room }), tag: `${room}:watch`, url }), { topic: topicOf('watch', room) });
    }
  },

  /**
   * Send one message to these subscriptions, in the background, forgetting any the browser has dropped.
   * `msg` is the message, or makes each subscription's from it (in its language).
   */
  pushTo(list, msg, opts = {}) {
    if (!list.length) return;
    const p = Promise.all(list.map(async (sub) => {
      const m = typeof msg === 'function' ? msg(sub) : msg;
      return [sub.endpoint, await sendPush(this.env, sub, m, { ...opts, ttl: opts.ttl ?? (m.urgent ? 6 * 3600 : 12 * 3600) })];
    })).then(async (results) => {
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
          if (away && d.day === day - 1 && now - at < MORNING_LATE) due.push([sub, morningNudge(sub.lang, d.streak, room), 'morning']);
        }
      }
      if (sub.reminded === day || now + 1000 < day * DAY + REMIND_AT - shift) continue;
      sub.reminded = day;
      if (!away) continue;
      if (sub.topics.kami && hungry && sub.kamiTold !== k.fedAt) {
        sub.kamiTold = k.fedAt;
        const line = kamiLine(kamiMood(k, now), k, room, { now, tz: sub.tz, things: this.state.guarded.map((o) => o.name), words: WORDS[cleanLang(sub.lang)].kami });
        due.push([sub, { title: say(sub.lang, 'kamiTitle'), body: say(sub.lang, 'kamiBody', { line, room }), tag: `${room}:kami`, url: `/r/${room}` }, 'kami']);
        continue;
      }
      if (!sub.topics.morning) continue;
      if (!d || d.streak < 2 || d.day !== day - 1) continue;
      due.push([sub, { title: say(sub.lang, 'eveningTitle', { n: d.streak }), body: say(sub.lang, 'eveningBody', { room }), tag: `${room}:morning`, url: `/r/${room}` }, 'morning']);
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
    this.subs[sub.endpoint] = { ...sub, name: self.name, avatar: self.avatar, tz: cleanTz(msg.tz), lang: cleanLang(msg.lang), topics: cleanTopics(msg.topics), at: Date.now(), reminded: was?.reminded ?? 0 };
    // A full list lets go of whoever subscribed, or last came back, longest ago.
    const all = Object.values(this.subs);
    if (all.length > MAX_SUBS) delete this.subs[all.reduce((a, b) => (a.at <= b.at ? a : b)).endpoint];
    if (!this.stored) await this.save(); // a shrine nobody has used yet: it is in use now
    await this.savePush();
    ws.send(JSON.stringify({ t: 'push', on: true, topics: this.subs[sub.endpoint].topics }));
    // The first time: one right away, so they know it works.
    const room = this.ctx.id.name;
    if (!was && msg.hello === true) this.pushTo([this.subs[sub.endpoint]], ({ lang }) => ({ title: say(lang, 'helloTitle'), body: say(lang, 'helloBody', { room }), tag: `${room}:hello`, url: `/r/${room}` }));
  },
};
