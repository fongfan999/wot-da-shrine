/**
 * Tiếng Việt cho shared/preview.js: những chữ một link miếu bung ra khi dán vào Slack, Zalo hay
 * Messenger (Worker đặt vào thẻ Open Graph; trang chủ cho xem trước), với các lời khấn soạn sẵn
 * bằng tiếng Việt, cùng thứ tự với QUICK_PRAYERS.
 */
import { QUICK_PRAYERS } from './prayers.js';

/** Mọi chữ của bản xem trước, bằng tiếng Việt. */
export const PREVIEW_WORDS = {
  quietDays: '{n} ngày không sự cố',
  quietDay: 'trọn một ngày không sự cố',
  quietHours: 'yên ả được {n} tiếng',
  quietHour: 'yên ả được một tiếng',
  kami: 'kami đang {mood}',
  moods: { pleased: 'vui vẻ', content: 'yên ổn', peckish: 'hơi đói', hungry: 'đói', starving: 'đói lả' },
  downFor: 'đã sập {t}',
  min: '{n} phút',
  hm: '{h} giờ {m} phút',
  blessing: 'đang cầu an cho deploy',
  praying: '{n} người đang khấn',
  burning: 'nhang đang cháy, còn {n} phút',
  cold: 'nhang đã tàn',
  karma: '{n} công đức',
  prayer: '1 lời khấn',
  prayers: '{n} lời khấn',
  streak: '{n} lần deploy êm liên tiếp',
  guarded: 'kami canh 1 service',
  guardeds: 'kami canh {n} service',
  lastPrayer: 'Lời khấn mới nhất: “{text}”',
  titleQuietDays: '{n} ngày không sự cố · {room}',
  titleQuietDay: 'Trọn một ngày không sự cố · {room}',
  titleDown: '{title} · vào {room} khấn cùng',
  titleBack: '{title} · sống lại rồi · {room}',
  titleQuiet: '{title} · {room}',
  plainDown: 'Server toang rồi · vào {room} khấn cùng',
  plainBack: 'Server sống lại rồi · {room}',
  plain: 'Cầu cho server chạy ngon · {room}',
  /** Trang của một miếu nói gì khi chưa ai làm gì ở đó, hoặc khi đã quá giới hạn đọc. */
  idle: 'Team bạn đang cầu cho server. Thắp nhang, thỉnh chuông và gửi một lời khấn tới dàn rack.',
  altDown: 'Server đang sập. Tranh mực vẽ bàn thờ, nhang đã thắp, cả team đang khấn.',
  altBack: 'Server sống lại rồi. Tranh mực vẽ bàn thờ sau đàn cầu.',
  alt: 'Tranh mực vẽ bát nhang trên bàn thờ trong chùa, kèm dòng chữ: cùng nhau cầu uptime. Ngày vái một lần. Cầu an cho deploy. Nhớ cho kami ăn.',
  demoTitle: 'Dàn rack demo toang rồi',
  quickPrayers: QUICK_PRAYERS,
};
