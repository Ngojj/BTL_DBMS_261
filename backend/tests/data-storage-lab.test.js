import assert from 'node:assert/strict';
import test from 'node:test';
import { parseParams, makeFixture, docSize } from '../src/labs/data-storage/shared.js';

test('data-storage params: mặc định, ép kiểu từ form và từ chối giá trị sai', () => {
  assert.deepEqual(parseParams(), { tickets: 1000, myTickets: 4, model: 'current' });
  assert.deepEqual(parseParams({ tickets: '200', myTickets: '10', model: 'denormalized' }), { tickets: 200, myTickets: 10, model: 'denormalized' });
  for (const bad of [{ tickets: 5 }, { tickets: 5001 }, { tickets: 'abc' }, { tickets: 20, myTickets: 21 }, { myTickets: 0 }, { model: 'x' }]) {
    assert.throws(() => parseParams(bad), { status: 400, code: 'VALIDATION' });
  }
  for (const bad of [null, [], 'x']) assert.throws(() => parseParams(bad), { status: 400 });
});

test('data-storage fixture: ghế không trùng (khu, hàng, số), khách số 1 giữ đúng số vé', () => {
  for (const [n, k] of [[10, 10], [13, 4], [1000, 4], [5000, 50]]) {
    const f = makeFixture(n, k);
    assert.equal(f.seats.length, n);
    assert.equal(new Set(f.seats.map((s) => `${s.zoneId}|${s.row}|${s.no}`)).size, n);
    assert.ok(f.seats.every((s) => s.no >= 1 && s.no <= 30));
    assert.equal(f.tickets.filter((t) => t.userId === 1).length, k);
    assert.equal(new Set(f.tickets.map((t) => t.qr)).size, n);
  }
});

test('docSize theo ví dụ trong tài liệu Firestore', () => {
  // Ví dụ của Google: users/jeff/tasks/my_task_id với 4 trường = 147 byte
  const size = docSize('users/jeff/tasks/my_task_id', {
    type: 'Personal', done: false, priority: 1, description: 'Learn Cloud Firestore',
  });
  assert.equal(size, 147);
});
