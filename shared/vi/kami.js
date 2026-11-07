/**
 * Tiếng Việt cho shared/kami.js: kami (thần giữ server) canh gì, nói gì theo từng tâm trạng, và nói
 * lần cuối được ăn là khi nào. Cùng số món và cùng số câu mỗi tâm trạng, cùng thứ tự với tiếng Anh,
 * để hai người trong một miếu đọc cùng một câu. Câu nào cũng đọc xuôi với {when} là “sáng nay”,
 * “hôm qua”, “thứ Ba” hay “12/11”, vì thông báo đẩy gửi đúng những câu này tới điện thoại.
 */

/** Kami để mắt tới cái gì. {Thing} là chữ đầu viết hoa, khi nó đứng đầu câu. */
const THINGS = [
  'con Postgres của bạn', 'cái DNS', 'con máy chạy cron', 'cái load balancer', 'con Redis không ai dám restart',
  'cái cert sắp hết hạn', 'con server duy nhất không có runbook', 'con staging thật ra là prod',
  'cụm Kafka', 'cái NFS mount', 'cái message queue', 'vụ deploy chiều thứ Sáu', 'file config vô chủ',
  'cái VPN công ty', 'job backup chưa ai từng restore', 'con primary', 'con máy Jenkins từ thời tiền sử', 'cái rate limiter',
];

/** Kami nói gì theo tâm trạng. {thing} và {when} được điền vào; câu có thể mở đầu bằng {Thing}. */
const LINES = {
  new: [
    'Có kami (thần giữ server) mới dọn về. Chưa ai cho ăn miếng nào.',
    'Miếu này giờ có kami (thần giữ server). Nó đang chờ được cúng cơm.',
  ],
  pleased: [
    'Kami đang vui vẻ, nằm cuộn tròn trên {thing} kêu rừ rừ.',
    'No bụng, vui vẻ. Kami đang canh {thing} giùm bạn.',
    'Kami đang vui vẻ, lấy đuôi quấn quanh {thing} mà canh.',
  ],
  content: [
    'Kami yên ổn. Liếc {thing} một cái rồi quay đi.',
    'Kami yên ổn. {Thing} hôm nay được bình an.',
    'Kami yên ổn, đang ngủ gà ngủ gật cạnh {thing}.',
  ],
  peckish: [
    'Kami chưa được ăn gì từ {when}. Giờ đang ngó qua {thing}.',
    'Kami hơi đói. Cứ liếc {thing} hoài.',
    'Kami hơi đói, bắt đầu đi vòng vòng quanh {thing}.',
  ],
  hungry: [
    'Kami đói rồi. Nó ngồi nhìn chằm chằm {thing} từ {when} tới giờ.',
    'Chưa ai cho kami ăn từ {when}. Giờ nó ngồi sát bên {thing} rồi.',
    'Kami đói rồi, và đã ghi {thing} vào sổ đen.',
  ],
  starving: [
    'Kami đói lả. Nó đang ngậm dây cáp của {thing}.',
    'Chưa ai cho kami ăn từ {when}. Nó đang ngồi chễm chệ trên {thing}, mắt không thèm chớp.',
    'Kami đói lả. Nó thôi nhìn {thing} rồi, giờ đang nhìn bạn.',
  ],
  vigil: [
    'Kami chẳng bất ngờ chút nào.',
    'Kami đã bảo rồi mà.',
    'Kami thấy điềm từ phía {thing} lâu rồi.',
  ],
  // Server đã sống lại, mà bàn thờ chưa được tẩy uế
  unclean: [
    'Server sống lại rồi. Kami muốn bàn thờ được tẩy uế trước khi nói thêm câu nào.',
    'Kami đang hít hít bàn thờ. Vẫn còn mùi {thing}.',
    'Kami đang chờ có người tẩy uế bàn thờ. Chân gõ nhịp lộp cộp.',
  ],
  // Một đàn cầu gọi tên đúng service kami được nhờ canh
  pointed: [
    'Kami đã nhắc về {thing} rồi mà.',
    'Kami đang chỉ vào {thing}. Chỉ nãy giờ rồi đó.',
    'Kami canh {thing} cả ngày. {Thing} thì chẳng thèm canh lại.',
  ],
};

/** Mọi lời kami nói, bằng tiếng Việt. Thứ trong tuần bắt đầu từ Chủ Nhật, như getDay của JS. */
export const KAMI_WORDS = {
  things: THINGS,
  lines: LINES,
  days: ['Chủ Nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'],
  months: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  date: '{day}/{month}',
  thisMorning: 'sáng nay',
  yesterday: 'hôm qua',
  ever: 'thuở khai thiên lập địa',
};
