/**
 * Tiếng Việt cho shared/preview.js: những chữ một link miếu bung ra khi dán vào Slack, Zalo hay
 * Messenger (Worker đặt vào thẻ Open Graph; trang chủ cho xem trước), với các lời khấn soạn sẵn
 * bằng tiếng Việt, cùng thứ tự với QUICK_PRAYERS.
 */
import { QUICK_PRAYERS } from './prayers.js';

/** Mọi chữ của bản xem trước, bằng tiếng Việt. */
export const PREVIEW_WORDS = {
  quietDays: '{n} ngày không sập',
  quietDay: 'trọn một ngày không sập',
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
  titleQuietDays: '{n} ngày không sập · {room}',
  titleQuietDay: 'Trọn một ngày không sập · {room}',
  titleDown: '{title} · vào {room} khấn cùng',
  titleBack: '{title} · sống lại rồi · {room}',
  titleQuiet: '{title} · {room}',
  plainDown: 'Server sập rồi · vào {room} khấn cùng',
  plainBack: 'Server sống lại rồi · {room}',
  plain: 'Cả team cùng lạy, server lại chạy · {room}',
  /** Trang của một miếu nói gì khi chưa ai làm gì ở đó, hoặc khi đã quá giới hạn đọc. */
  idle: 'Team bạn đang cầu cho server. Thắp nhang, thỉnh chuông và gửi một lời khấn tới dàn rack.',
  altDown: 'Server đang sập. Tranh mực vẽ bàn thờ, nhang đã thắp, cả team đang khấn.',
  altBack: 'Server sống lại rồi. Tranh mực vẽ bàn thờ sau đàn cầu.',
  alt: 'Tranh mực vẽ bát nhang trên bàn thờ trong miếu, kèm dòng chữ: Cả team cùng lạy, server lại chạy. Vái mỗi ngày. Cầu an deploy. Nhớ cho kami ăn.',
  demoTitle: 'Dàn rack demo sập rồi',
  quickPrayers: QUICK_PRAYERS,
};
