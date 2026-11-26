// Kiểm thử lab Query processing (không cần kết nối CSDL): tham số và bộ dữ liệu / đáp án dùng chung cho hai DBMS.
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseParams, TICKET_OPTIONS } from '../src/labs/query-processing/params.js';
import { buildDataset, expectedRevenue, sameAsExpected, ZONES } from '../src/labs/query-processing/dataset.js';

test('query lab params: mặc định, chấp nhận chuỗi từ giao diện, từ chối giá trị lạ', () => {
  assert.deepEqual(parseParams(), { tickets: 1000, approach: 'C' });
  assert.deepEqual(parseParams({ tickets: '2000', approach: 'b' }), { tickets: 2000, approach: 'B' });
  for (const t of TICKET_OPTIONS) assert.equal(parseParams({ tickets: t }).tickets, t);
  for (const v of [null, [], 'x', 1]) assert.throws(() => parseParams(v), { status: 400, code: 'VALIDATION' });
  for (const t of [0, 1, 999, 5000, 'abc', -500, 1000.5]) assert.throws(() => parseParams({ tickets: t }), { status: 400 });
  for (const a of ['E', 'AA', 1, null]) assert.throws(() => parseParams({ approach: a }), { status: 400 });
});

test('query lab dataset: xác định, mỗi vé một ghế, có vé hủy, đáp án tính đúng', () => {
  const a = buildDataset(1000);
  assert.deepEqual(a, buildDataset(1000)); // không ngẫu nhiên: hai DBMS nạp cùng một dữ liệu
  assert.equal(a.tickets.length, 1000);
  assert.equal(new Set(a.tickets.map((t) => t.seatId)).size, 1000);
  const cancelled = a.tickets.filter((t) => !t.active).length;
  assert.ok(cancelled > 0 && cancelled < 100, 'khoảng 8% vé bị hủy, thực tế ' + cancelled);

  const exp = expectedRevenue(a);
  assert.deepEqual(Object.keys(exp).sort(), ZONES.map((z) => z.name).sort());
  assert.equal(Object.values(exp).reduce((s, g) => s + g.tickets, 0), 1000 - cancelled);
  for (const z of ZONES) assert.equal(exp[z.name].revenue, exp[z.name].tickets * z.price);
});

test('query lab: sameAsExpected phát hiện kết quả sai và bỏ qua khu không có vé', () => {
  const exp = expectedRevenue(buildDataset(500));
  const got = Object.fromEntries(Object.entries(exp).map(([k, v]) => [k, { ...v }]));
  assert.equal(sameAsExpected(got, exp), true);
  got.VIP.revenue += 1;
  assert.equal(sameAsExpected(got, exp), false);
  got.VIP.revenue -= 1;
  delete got['CAT 3'];
  assert.equal(sameAsExpected(got, exp), false); // thiếu một khu có vé
  assert.equal(sameAsExpected({}, { VIP: { tickets: 0, revenue: 0 } }), true);
});
