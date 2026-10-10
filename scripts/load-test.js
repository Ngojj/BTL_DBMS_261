// TODO [load-test] Phụ trách: TV5 (Concurrency control) – giả lập "giờ G"
// Chạy: node scripts/load-test.js --users 500 --seats 50 --event 1 [--no-lock]
//
// Ý tưởng: tạo N người dùng (login lấy JWT), cùng lúc gọi POST /api/orders giành M ghế,
// đếm: vé bán ra, bán trùng (phải = 0), xung đột/thử lại, tổng thời gian.
// Có thể dùng k6 thay thế: đặt script trong scripts/k6/.
// Backend module labs/concurrency-control có thể dùng lại logic này qua hàm nội bộ.
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1] ?? true] : []).filter((x) => x.length));
const API = process.env.API_URL ?? 'http://localhost:4000/api';

console.log('TODO: chưa hiện thực load-test', { API, ...args });
