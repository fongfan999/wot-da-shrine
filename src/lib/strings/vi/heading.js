/** Tiếng Việt cho strings/heading.js. */

export default {
  eyebrow: 'Bảo trì “định kỳ”',
  title: 'Server đang thiền, đừng ping',
  subtitle: 'Team ops đang khấn, sếp đang hỏi “bao giờ xong”. Thắp nén nhang phụ một tay.',
  // A shrine that has not named what is down gets one of these (headlineFor). The title's last word
  // (its last syllable, in Vietnamese) is set in italics, so each ends on the one worth leaning on.
  headlines: [
    ['Server đang thiền, đừng ping', 'Ping thêm cũng chỉ nhận về timeout. Thắp nén nhang, im lặng chờ nó xuất định.'],
    ['Prod ngủ nướng, sếp có ba cuộc gọi nhỡ', 'Cuộc thứ tư sắp tới rồi. Thắp nhang lẹ, và nghĩ sẵn câu trả lời.'],
    ['Cloud dỗi, nhưng hóa đơn vẫn tới', 'Instance thì tắt, đồng hồ tính tiền thì vẫn chạy. Dâng lễ nhẹ thôi, ngân sách còn phải trả hóa đơn.'],
    ['Năm số chín, bay mất bốn', 'Hợp đồng ghi 99,999%, dashboard ghi 9%. Khấn cho mấy số chín về trước khi khách đọc lại SLA.'],
    ['Pod đi tìm bản ngã, restart lần thứ 47', 'CrashLoopBackOff nghe như tên một pháp môn. Thắp nhang, đọc log, và đừng ai delete pod lúc nó đang tu.'],
    ['Database đi tu, backup chưa từng test', 'Bản backup gần nhất có từ hồi công ty còn ba người. Khấn cho nó còn restore được.'],
    ['Prod ngậm tăm, log cũng im re', 'Không error, không warning, không một dòng. Im lặng kiểu này đáng sợ hơn stack trace, khấn nhỏ nhẹ thôi.'],
    ['Deploy chiều thứ Sáu, giờ thắp nhang', 'Ai bảo “sửa một dòng thôi mà”. Thắp một nén tưởng niệm, rồi rollback cho cuối tuần còn kịp.'],
    ['Error nở rộ, mà máy em vẫn chạy ngon', 'Tiếc là khách hàng không xài máy em. Khấn đi, không thì ship luôn cái laptop lên production.'],
    ['Cache buông bỏ, database gánh team', 'Mọi request đổ thẳng xuống database, CPU 100% mà vẫn gồng. Cúng cho cache nhớ lại, cho database được thở.'],
    ['Kubernetes ngẫm sự đời, YAML lệch một dấu cách', 'Ba trăm dòng YAML, sai đúng một dòng, không ai biết dòng nào. Thắp nhang, rồi đếm lại dấu cách từ đầu.'],
    ['Packet đi hành hương, DNS chỉ sai đường', 'Lần nào cũng là DNS, kể cả lúc tưởng không phải DNS. Thắp đèn lồng soi đường, và chờ TTL hết hạn.'],
    ['Pager phán, đúng 3 giờ sáng', 'Ba chục alert nổ cùng lúc, cái nào cũng critical. Dậy đi, rửa mặt, rồi cả team cùng khấn.'],
    ['Latency siêu thoát, spinner quay tới kiếp sau', 'Người dùng đã refresh đến lần thứ mười. Khấn cho response về kịp trước khi họ qua app đối thủ.'],
    ['Server tự nghỉ phép, chưa tạo ticket Jira', 'Không xin phép, không bàn giao, không ai trực thay. Mời ly cà phê sữa đá, biết đâu nó quay lại trước standup.'],
    ['Status page vẫn xanh, Facebook đã réo', 'Status page ghi All Systems Operational, còn group thì đầy ảnh chụp màn hình lỗi. Cả team biết thừa, nhưng vẫn khấn.'],
  ],
  tagline: 'Cả team cùng lạy, server lại chạy.',
  madeBy: 'Làm bởi',
  openSource: 'Mã nguồn mở trên GitHub',
  feedback: 'Báo lỗi hay xin thêm tính năng',
  feedbackHint: 'Gửi thư tới hey@wotdafong.dev',
  feedbackFoot: 'Báo lỗi, xin tính năng',

  // A shrine with nothing down: the heading counts the days, and the kami has its say
  quietEyebrow: 'Có kami chống lưng',
  quietDays: '{n} ngày không sập',
  quietDay: 'Trọn một ngày không sập',
  quietHours: '{n} tiếng không sập',
  quietHour: 'Một tiếng không sập',
  quietMinutes: 'Yên được {n} phút, đừng nói gở',
  quietMinute: 'Mới yên được một phút, nín thở',
  quietNever: 'Chưa có gì sập. Còn sớm để kết luận.',
  quietNeverSub: 'Màn hình này canh miếu. Khi có gì đó sập, bấm “Có gì đó sập” trên bất kỳ điện thoại nào trong miếu.',
};
