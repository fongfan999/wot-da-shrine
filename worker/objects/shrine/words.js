/**
 * What a shrine says outside its page, in each language a page speaks (src/lib/locale.js): its
 * notifications, which each browser hears in the language it subscribed from. The kami's line in
 * them is shared/kami.js's, in the same language's words. A part of the Shrine (index.js).
 */
import { KAMI_WORDS } from '../../../shared/kami.js';
import { KAMI_WORDS as KAMI_VI } from '../../../shared/vi/kami.js';

export const WORDS = {
  en: {
    kami: KAMI_WORDS,
    min: '{n} min',
    h: '{h}h',
    hm: '{h}h {m}m',
    dh: '{d}d {h}h',
    someone: 'Someone',
    theServers: 'the servers',
    downTitle: 'Something is down',
    downPraying: '{n} praying.',
    downNobody: 'Nobody is kneeling yet.',
    downAlarm: '{name} raised the alarm in {room}. {kneeling} Come kneel.',
    downOpened: '{name} opened the vigil in {room}. {kneeling} Come kneel.',
    backTitle: 'They’re back!',
    backFor: 'The vigil for “{title}”',
    backPlain: 'The vigil',
    backBody: '{what} ended after {t}.',
    backHook: '{name} says it cleared.',
    backBy: '{name} said so.',
    unbackTitle: 'Not back after all',
    unbackBody: '{name} took it back: {what} still down in {room}.',
    watchTitle: 'You hold the watch',
    watchBody: '{name} handed you the watch in {room}. Sleep lightly.',
    runTitle: 'Day {next} of your run',
    runBody: 'Your {n}-morning run at {room} is waiting on today’s bow. The kami is up.',
    secondTitle: 'Day 2 starts with a bow',
    secondBody: 'You bowed at {room} yesterday. One bow this morning makes it a run.',
    kamiTitle: 'The kami is hungry',
    kamiBody: '{line} One bow at {room} will do.',
    eveningTitle: 'Keep your {n}-morning run',
    eveningBody: 'You haven’t bowed at {room} today. One bow before midnight keeps it going.',
    helloTitle: 'Notifications are on',
    helloBody: 'You’ll hear from {room} when it needs you.',
  },
  vi: {
    kami: KAMI_VI,
    min: '{n} phút',
    h: '{h} giờ',
    hm: '{h} giờ {m} phút',
    dh: '{d} ngày {h} giờ',
    someone: 'Ai đó',
    theServers: 'server',
    downTitle: 'Có gì đó toang rồi',
    downPraying: '{n} người đang khấn.',
    downNobody: 'Chưa ai quỳ cả.',
    downAlarm: '{name} vừa báo động ở {room}. {kneeling} Vào quỳ đi.',
    downOpened: '{name} vừa lập đàn ở {room}. {kneeling} Vào quỳ đi.',
    backTitle: 'Sống lại rồi!',
    backFor: 'Đàn cầu cho “{title}”',
    backPlain: 'Đàn cầu',
    backBody: '{what} đã xong sau {t}.',
    backHook: '{name} báo đã ổn.',
    backBy: '{name} xác nhận.',
    unbackTitle: 'Mừng hụt rồi',
    unbackBody: '{name} rút lại: {what} vẫn đang sập ở {room}.',
    watchTitle: 'Bạn đang giữ ca trực',
    watchBody: '{name} vừa bàn giao ca trực ở {room} cho bạn. Ngủ nhẹ thôi nhé.',
    runTitle: 'Ngày thứ {next} liên tiếp',
    runBody: 'Chuỗi {n} buổi sáng ở {room} đang chờ cái vái hôm nay. Kami dậy rồi đó.',
    secondTitle: 'Ngày thứ 2 bắt đầu bằng một cái vái',
    secondBody: 'Hôm qua bạn đã vái ở {room}. Vái thêm sáng nay là thành chuỗi.',
    kamiTitle: 'Kami đói rồi',
    kamiBody: '{line} Vào {room} vái một cái là được.',
    eveningTitle: 'Giữ chuỗi {n} buổi sáng',
    eveningBody: 'Hôm nay bạn chưa vái ở {room}. Vái một cái trước nửa đêm để giữ chuỗi.',
    helloTitle: 'Đã bật thông báo',
    helloBody: 'Khi {room} cần, bạn sẽ được gọi.',
  },
};

/** A language a browser may subscribe in: one we have words for, else English. */
export const cleanLang = (lang) => (Object.hasOwn(WORDS, lang) ? lang : 'en');

/** `key` in `lang`, with its {placeholders} filled. */
export const say = (lang, key, vars = {}) => Object.entries(vars).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), WORDS[cleanLang(lang)][key]);

/** How long, as a notification says it: "12 min", "2h 5m", "3h", "1d 4h". */
export function lasted(lang, m) {
  if (m < 60) return say(lang, 'min', { n: m });
  if (m < 1440) return m % 60 ? say(lang, 'hm', { h: Math.floor(m / 60), m: m % 60 }) : say(lang, 'h', { h: Math.floor(m / 60) });
  return say(lang, 'dh', { d: Math.floor(m / 1440), h: Math.floor((m % 1440) / 60) });
}
