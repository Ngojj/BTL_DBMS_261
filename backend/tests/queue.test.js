import test from 'node:test';
import assert from 'node:assert/strict';

import * as queueRepo from '../src/modules/queue/queue.repository.js';
import * as queueService from '../src/modules/queue/queue.service.js';

test('Queue module: joinQueue adds user to in-memory queue with valid position', async () => {
  const eventId = 999;
  const user1 = { userId: '101', fullName: 'User 101' };
  const user2 = { userId: '102', fullName: 'User 102' };

  const res1 = await queueRepo.joinQueue({ eventId, userId: user1.userId, fullName: user1.fullName });
  assert.equal(res1.userId, '101');
  assert.equal(res1.admitted, false);
  assert.ok(res1.position >= 1);

  const res2 = await queueRepo.joinQueue({ eventId, userId: user2.userId, fullName: user2.fullName });
  assert.equal(res2.userId, '102');
  assert.equal(res2.admitted, false);
  assert.ok(res2.position > res1.position);

  // Status check
  const status1 = await queueRepo.getQueueStatus({ eventId, userId: user1.userId });
  assert.equal(status1.inQueue, true);
  assert.equal(status1.admitted, false);

  // Admit user1
  const admitRes = await queueRepo.admitUsers({ eventId, count: 1 });
  assert.ok(admitRes.admittedCount >= 1);

  // Status after admit
  const statusAfter = await queueRepo.getQueueStatus({ eventId, userId: user1.userId });
  assert.equal(statusAfter.admitted, true);

  // Leave queue
  await queueRepo.leaveQueue({ eventId, userId: user1.userId });
  await queueRepo.leaveQueue({ eventId, userId: user2.userId });
});

test('Queue service: rejects unauthenticated user', async () => {
  await assert.rejects(async () => {
    await queueService.joinQueue({ eventId: 1, user: null });
  }, /Cần đăng nhập/);

  await assert.rejects(async () => {
    await queueService.admitUsers({ eventId: 1, count: 5, user: { role: 'CUSTOMER' } });
  }, /Chỉ Admin/);
});

// Thoát process sau khi tất cả test hoàn thành
// (cần thiết vì Firebase Admin SDK giữ gRPC connection mở)
setTimeout(() => process.exit(0), 500);

