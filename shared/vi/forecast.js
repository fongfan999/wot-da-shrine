/**
 * Tiếng Việt cho shared/forecast.js: bản tin thời tiết của kami. Cùng số câu cho mỗi kiểu trời và
 * cùng số điều kiêng, cùng thứ tự với tiếng Anh, để cả miếu đọc chung một bản tin. `lucky` đọc sau
 * “Lễ vật hợp mệnh:”, `avoid` đọc sau “Kiêng:”.
 */

/** Mỗi kiểu trời nói gì. {thing} là thứ kami canh, hoặc 'prod'; câu có thể mở đầu bằng {Thing}. */
const CONDITIONS = {
  clear: [
    'Trời quang trên {thing}. Gió nhẹ 200 OK thổi từ hướng tây.',
    'Không một gợn mây quanh {thing}. Pager có khi quên luôn số bạn.',
    'Nắng đẹp, lặng gió. {Thing} đang phơi nắng.',
  ],
  fair: [
    'Phần lớn trời đẹp. Rải rác vài warning, không cái nào của bạn.',
    'Trời đẹp, gió retry nhẹ quanh {thing}. Một ly cà phê là xong.',
    'Có nắng từng đợt trên {thing}, lác đác vài test lúc xanh lúc đỏ.',
  ],
  cloudy: [
    'Nhiều mây trên {thing}, khả năng 30% có 502 sau giờ cơm trưa.',
    'Trời âm u. Mưa phùn latency quanh {thing} vào giữa buổi chiều.',
    'Trời nhiều mây, log nồm ẩm. Nhớ để mắt tới {thing}.',
  ],
  storm: [
    'Một dải retry đang di chuyển về phía {thing}. Cất runbook chỗ khô ráo.',
    'Cảnh báo dông cho {thing}. Chiều tối có sấm trong error budget.',
    'Dự báo alert nặng hạt gần {thing}. Chằng chống feature flag cho kỹ.',
  ],
  typhoon: [
    'Áp thấp quanh {thing} đang mạnh lên thành bão. Neo cron job cho chắc.',
    'Cảnh báo bão. {Thing} nằm trong vùng tâm bão. Tích trữ mì tôm.',
    'Khí áp kế đã bó tay với {thing}. Status page cũng vậy.',
  ],
};

/** Lễ vật hợp mệnh hôm nay, theo từng loại lễ vật bàn thờ biết (OFFERING_KINDS trong rules.js). */
const LUCKY = {
  coffee: 'cà phê sữa đá',
  noodles: 'mì tôm thêm trứng',
  duck: 'vịt cao su',
  energy: 'lon bò húc',
  keyboard: 'phím cơ gõ lạch cạch',
  usb: 'cái USB dự phòng',
  laptop: 'laptop dự bị',
};

/** Hôm nay kiêng gì. */
const AVOID = [
  'chạy migration', 'đụng vào DNS', 'force push', 'đổi tên biến', 'nâng cấp ORM',
  'buột miệng nói “sửa xíu là xong”', 'restart con primary', 'YAML thụt lề bằng tab', 'tin vào cache', 'regex',
  'deploy từ quán cà phê', 'cái config vô chủ', 'xả queue bằng tay', 'lên major version',
];

/** Mọi lời bản tin nói, bằng tiếng Việt. */
export const FORECAST_WORDS = { conditions: CONDITIONS, lucky: LUCKY, avoid: AVOID, production: 'prod' };
