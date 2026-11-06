/**
 * The shared shrine at /r/:room: entering it, kneeling (or renaming), and the live connection.
 * The join card is join.js; what the room says over the connection, and what the page does about
 * it, is messages.js.
 */
import gsap from 'gsap';
import { sound } from '../audio/index.js';
import { AVATARS, connectRoom, saveMe } from '../lib/room.js';
import { t } from '../lib/strings.js';
import { $, body, fmt, roomName, state, tv, urlParams } from './context.js';
import { art } from './engines.js';
import { kneelNow, presence } from './people.js';
import { wishInput } from './prayers.js';
import { arrivedFromTv } from './screen.js';
import { toast } from './ui.js';
import { closeJoin, DEFAULT_NAMES, joinName, joinOpen, openJoin, picked } from './join.js';
import { onShrineMessage } from './messages.js';
import { holdHeadingAtMost } from './stage.js';

const roomStatus = $('#room-status');

export function enterRoom() {
  body.dataset.mode = 'room';
  art.setOpsTeam(false);
  $('#btn-together').hidden = true;
  $('#btn-invite').hidden = false;
  $('#room-chip').hidden = false;
  $('#room-name').textContent = roomName;
  $('#menu-rename').hidden = false;
  presence.hidden = false;
  $('#join-room').textContent = fmt('roomEyebrow', { room: roomName });
  if (tv) { state.me = { name: t('tvWatch'), avatar: '🤖' }; connect(); return; }
  if (roomName === 'demo') { // the public demo names you itself and takes only the ready-made prayers
    state.me = state.me ?? { name: gsap.utils.random(DEFAULT_NAMES), avatar: gsap.utils.random(AVATARS) };
    $('#menu-rename').hidden = true;
    wishInput.disabled = true;
    wishInput.placeholder = t('demoPrayers');
    connect();
    return;
  }
  if (state.me) connect();
  else openJoin();
}

$('#join-form').addEventListener('submit', (e) => {
  e.preventDefault();
  sound.unlock();
  const name = joinName.value.trim().slice(0, 24);
  if (!name) return;
  const { avatar, role, tone } = picked();
  state.me = { name, avatar, role, tone };
  saveMe(state.me);
  closeJoin();
  sound.bowl(220);
  if (state.shrine) state.shrine.rename(state.me);
  else connect();
});

/**
 * This browser knelt in a newer tab, at this shrine or at `where`, and that one kneels now: one body,
 * one altar. This one goes still
 * and silent (no sound, no animation, no reconnecting) until you ask to pray here, which reloads
 * it and so sends the other tab aside in turn.
 */
function stepAside(where) {
  body.dataset.conn = 'closed';
  roomStatus.dataset.status = 'closed';
  $('#room-state').textContent = t('statusOffline');
  if (joinOpen()) closeJoin();
  $('#elsewhere-room').textContent = fmt('roomEyebrow', { room: roomName });
  const moved = where && where !== roomName; // walked over to another shrine, not this one in another tab
  $('#elsewhere-lead').textContent = t(moved ? 'elsewhereMovedTitle' : 'elsewhereTitle');
  $('#elsewhere-where').textContent = moved ? where : t('elsewhereTitleAccent');
  $('#elsewhere-hint').textContent = moved ? fmt('elsewhereMovedHint', { room: where }) : t('elsewhereHint');
  $('#btn-elsewhere').textContent = t(moved ? 'elsewhereMovedBtn' : 'elsewhereBtn');
  $('#elsewhere').hidden = false;
  sound.ctx?.suspend().catch(() => {});
  gsap.ticker.sleep();
}
$('#btn-elsewhere').addEventListener('click', () => location.reload());

function connect() {
  // You kneel at once; the shrine confirms when the socket opens. The demo names you itself, and a TV is nobody.
  if (!tv && roomName !== 'demo') kneelNow(state.me);
  holdHeadingAtMost(); // the heading waits for the room's first word, but not for ever
  state.shrine = connectRoom(roomName, state.me, {
    watch: tv,
    arrival: arrivedFromTv() ? { via: 'tv', hello: urlParams.get('hello') } : null,
    onMessage: onShrineMessage,
    onStatus(status, where) {
      if (status === 'elsewhere') { stepAside(where); return; }
      body.dataset.conn = status;
      roomStatus.dataset.status = status;
      $('#room-state').textContent = t(status === 'open' ? 'statusLive' : status === 'closed' ? 'statusOffline' : 'statusConnecting');
      if (status === 'closed' && state.greeted) toast(t('offline'));
    },
  });
}
