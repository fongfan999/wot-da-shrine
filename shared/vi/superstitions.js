/**
 * Tiếng Việt cho shared/superstitions.js: những điều miếu tin, rút ra từ chính lịch sử của nó. Số liệu
 * là thật, kết luận là của kami. {of} là một trong of/ofAll/ofAllMid, {day} một thứ trong `days`,
 * {part} một buổi trong `parts`, {x} là `times` đã điền (“2 lần”).
 */
export const BELIEF_WORDS = {
  days: ['Chủ Nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'],
  /** Các buổi trong ngày (PARTS), đọc sau “bắt đầu …”. */
  parts: ['trong khoảng nửa đêm tới 6 giờ sáng', 'trước 12 giờ trưa', 'vào buổi chiều', 'sau 17:00'],
  times: '{x} lần',
  // "{of}": bao nhiêu trong số các sự cố gần nhất
  of: '{k} trong {n} sự cố gần nhất của bạn',
  ofAll: 'Cả {n} sự cố gần nhất của bạn',
  ofAllMid: 'cả {n} sự cố gần nhất của bạn',
  weekday: '{of} đều bắt đầu vào {day}. Kami đề nghị từ nay cả team nghỉ {day}.',
  hour: '{of} đều bắt đầu {part}. Prod có giờ đi ngủ riêng, và không trùng giờ của bạn.',
  unfed: '{of} đều nổ ra lúc kami đã nhịn đói từ một ngày trở lên. Tương quan không phải nhân quả. Kami không đồng ý.',
  fed: 'Trước cả {n} sự cố gần nhất của bạn, kami đều đã được cho ăn trong ngày. Kami đề nghị ghi vào biên bản: không phải lỗi của nó.',
  watch: 'Trong {n} sự cố gần nhất có người trực, {name} cầm ca {k} lần. Miếu không có ý gì đâu.',
  openerAlert: '{name} đã báo {of}. Alert thì không tin kami, nhìn là biết.',
  openerAll: 'Lần nào cũng là {name} hô sập đầu tiên. Coi chừng miệng ăn mắm ăn muối.',
  opener: '{name} là người hô sập đầu tiên {k} trên {n} lần. Coi chừng miệng ăn mắm ăn muối.',
  prayersLonger: 'Đàn cầu nào khấn nhiều thì kéo dài lâu gấp {x}. Có khi khấn mới là vấn đề.',
  prayersShorter: 'Đàn cầu nào khấn nhiều thì xong nhanh gấp {x}. Khấn tiếp đi.',
  blamesLonger: 'Đàn cầu có người đốt sớ thì kéo dài lâu gấp {x}. Nhận lỗi cũng tốn thời gian.',
  blamesShorter: 'Đàn cầu có người đốt sớ thì xong nhanh gấp {x}. Văn hóa không đổ lỗi có tác dụng thật.',
  fortunesLonger: 'Đàn cầu có người xin xăm thì kéo dài lâu gấp {x}. Thôi đừng xin nữa.',
  fortunesShorter: 'Đàn cầu có người xin xăm thì xong nhanh gấp {x}. Ông trời thích được hỏi han.',
  omensAll: 'Deploy nào làm sập prod ở đây cũng là deploy bất chấp điềm xấu. {n} trên {n}. Chịu khó đọc điềm giùm.',
  omensNone: '{n} deploy làm sập prod dù chẳng có điềm xấu nào. Mấy cái điềm cũng thấy quê.',
  bows: 'Deploy lên prod êm được trung bình {a} cái vái. Deploy làm sập prod chỉ được {b}. Vái mạnh tay vào.',
  brokeDayAll: 'Deploy nào làm sập prod cũng ra lò vào {day}. Gọi là trùng hợp thì hơi mạnh miệng.',
  brokeDay: '{k} trong {n} deploy làm sập prod đều ra lò vào {day}. Gọi là trùng hợp thì hơi mạnh miệng.',
};
