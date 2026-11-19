// E2E lab Query processing. Cần: backend đang chạy (API_URL, mặc định http://localhost:4000/api), Firestore Emulator, CSDL đã seed.
// Chạy: node backend/tests/e2e/query-lab.e2e.mjs
// Dùng Emulator vì mỗi lần chạy ghi hàng nghìn document; đừng trỏ vào Firestore thật nếu chưa cần.
const API = process.env.API_URL ?? 'http://localhost:4000/api';
const EMU = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8085';

let fail = 0;
const ok = (cond, name, extra = '') => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (cond || !extra ? '' : '  → ' + extra)); if (!cond) fail++; };
const call = async (path, token, method = 'GET', body) => {
  const r = await fetch(API + path, { method, headers: { 'content-type': 'application/json', ...(token && { authorization: 'Bearer ' + token }) }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const login = async (email, password) => (await call('/auth/login', null, 'POST', { email, password })).body.token;

const admin = await login('admin@ticketrush.vn', 'Admin@123');
const customer = await login('khach@example.com', '123456');
const run = (token, params) => call('/admin/labs/query-processing/run', token, 'POST', { params });

// ---- phân quyền và kiểm tra đầu vào (không chạm CSDL)
ok((await run(null, {})).status === 401, 'chưa đăng nhập → 401');
ok((await run(customer, {})).status === 403, 'khách không được chạy lab → 403');
ok((await run(admin, { tickets: 123 })).status === 400, 'tickets ngoài danh sách → 400');
ok((await run(admin, { approach: 'Z' })).status === 400, 'approach sai → 400');
ok((await run(admin, { tickets: 5000 })).status === 400, 'tickets 5000 bị từ chối (vượt trần) → 400');

// ---- chạy thật, mức 500 vé cho nhanh
const res = {};
for (const approach of ['A', 'B', 'C', 'D']) {
  const r = await run(admin, { tickets: 500, approach });
  ok(r.status === 200, `chạy cách ${approach}`, JSON.stringify(r.body).slice(0, 200));
  res[approach] = r.body;
}
const pg = res.C.results.postgres;
ok(pg.ok && pg.metrics.matchesExpected === true, 'PostgreSQL ra đúng đáp án', JSON.stringify(pg).slice(0, 200));
ok(pg.metrics.queries === 1, 'PostgreSQL chỉ cần 1 câu SQL');
ok(pg.metrics.groups === 4 && pg.metrics.rowsRead > 0, 'PostgreSQL gom đủ 4 khu');

for (const a of ['A', 'B', 'C', 'D']) {
  const f = res[a].results.firestore;
  ok(f.ok && f.metrics.matchesExpected === true, `Firestore cách ${a} ra đúng đáp án`, JSON.stringify(f).slice(0, 200));
  ok(f.metrics.revenue === pg.metrics.revenue, `cách ${a}: tổng doanh thu trùng PostgreSQL`);
}
const ap = res.C.results.firestore.details.approaches;
ok(ap.A.reads > ap.B.reads && ap.B.reads > ap.C.reads && ap.C.reads > ap.D.reads, 'số lượt đọc giảm dần A > B > C > D', JSON.stringify(Object.values(ap).map((x) => x.reads)));
ok(ap.D.queries === 1 && ap.D.reads === 1, 'cách D: 1 truy vấn, 1 lượt đọc');
ok(ap.C.queries === 4, 'cách C: mỗi khu một truy vấn gộp (4)');
ok(ap.A.reads >= 2 * 500 && ap.A.reads <= 2 * 500 + 10, 'cách A đọc khoảng 2N document (khu + ghế + vé)', String(ap.A.reads));

// ---- kết quả được lưu và dọn sạch
const runs = await call('/admin/labs/query-processing/runs', admin);
ok(runs.status === 200 && runs.body.length >= 4, 'lịch sử lần chạy được lưu');
const left = await fetch(`http://${EMU}/v1/projects/ticketrush-dev/databases/(default)/documents/queryLabRuns`, { headers: { authorization: 'Bearer owner' } });
const leftBody = await left.json();
ok(left.ok && !(leftBody.documents?.length), 'Firestore không còn dữ liệu thử sau khi chạy', JSON.stringify(leftBody).slice(0, 120));

console.log(fail ? `\n${fail} lỗi` : '\nTất cả đạt');
process.exit(fail ? 1 : 0);
