/**
 * World: one Durable Object for the whole site. Every shrine reports its
 * actions here, and the landing page shows the totals ("12,480 prayers from
 * 1,203 shrines, 7 burning right now") with a ticker of what just happened.
 *
 * Nothing identifying is kept: room names only live in two short-lived maps
 * (who is burning, who was active lately) that never leave this object, and
 * the ticker only repeats the ready-made prayers, never free text.
 */
import { DurableObject } from 'cloudflare:workers';
import { QUICK_PRAYERS } from '../shared/prayers.js';

export const BURN_SECONDS = 600; // keep in sync with shrine.js
const ACTIVE_FOR = 10 * 60 * 1000; // a shrine counts as "praying now" for ten minutes after its last action
const RECENT_MAX = 12;
const KINDS = ['light', 'prayer', 'bow', 'bowl', 'offer', 'resolve', 'burnout', 'blame', 'omikuji'];
const COUNTED = { light: 'incense', prayer: 'prayers', bow: 'bows', bowl: 'bowls', offer: 'offerings', resolve: 'resolved', blame: 'blames', omikuji: 'fortunes' };
const PRESET = new Set(QUICK_PRAYERS);

const EMPTY = { shrines: 0, incense: 0, prayers: 0, bows: 0, bowls: 0, offerings: 0, resolved: 0, blames: 0, fortunes: 0, karma: 0, recent: [] };

export class World extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.totals = { ...EMPTY };
    this.burning = new Map(); // room → litAt
    this.active = new Map(); // room → last action
    this.dirty = false;
    this.flushTimer = 0;
    ctx.blockConcurrencyWhile(async () => {
      const [saved, live] = await Promise.all([ctx.storage.get('world'), ctx.storage.get('live')]);
      this.totals = { ...EMPTY, ...saved };
      this.burning = new Map(Object.entries(live?.burning ?? {}));
      this.active = new Map(Object.entries(live?.active ?? {}));
    });
  }

  /**
   * A shrine (or the solo page) did something. `room` is '' for the solo page,
   * whose actions count but never show as a shrine.
   */
  pulse({ room = '', kind, text = '', karma = 0, fresh = false, litAt = 0 } = {}) {
    if (!KINDS.includes(kind)) return;
    const now = Date.now();
    const t = this.totals;
    if (fresh) t.shrines += 1;
    if (COUNTED[kind]) t[COUNTED[kind]] += 1;
    t.karma += Math.max(0, Math.min(50, karma | 0));
    if (room) {
      this.active.set(room, now);
      if (kind === 'light') this.burning.set(room, litAt || now);
      if (kind === 'burnout' || kind === 'resolve') this.burning.delete(room);
    }
    if (kind !== 'bowl' && kind !== 'burnout') {
      const item = { kind, at: now };
      if (kind === 'prayer' && PRESET.has(text)) item.text = text;
      t.recent = [item, ...t.recent].slice(0, RECENT_MAX);
    }
    this.dirty = true;
    this.scheduleFlush();
  }

  /** What the landing page shows. */
  snapshot() {
    const now = Date.now();
    this.prune();
    const { recent, ...totals } = this.totals;
    return {
      ...totals,
      burningNow: this.burning.size,
      prayingNow: this.active.size,
      recent: recent.map((r) => ({ ...r, ago: Math.max(0, Math.round((now - r.at) / 1000)) })),
      now,
    };
  }

  /** Writes are coalesced: a busy minute across every shrine is one write per second, not one per ring. */
  scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => this.flush(), 1000);
  }

  async flush() {
    this.flushTimer = 0;
    if (!this.dirty) return;
    this.dirty = false;
    this.prune();
    await this.ctx.storage.put({
      world: this.totals,
      live: { burning: Object.fromEntries(this.burning), active: Object.fromEntries(this.active) },
    });
  }

  /** Forget shrines whose incense has burned down, or that have gone quiet. */
  prune() {
    const now = Date.now();
    for (const [room, at] of this.burning) if (now - at > BURN_SECONDS * 1000) this.burning.delete(room);
    for (const [room, at] of this.active) if (now - at > ACTIVE_FOR) this.active.delete(room);
  }
}
