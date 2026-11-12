import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseParams } from '../src/labs/transaction/params.js';

test('transaction params accept boolean/select values and reject malformed input', () => {
  assert.deepEqual(parseParams(), { simulateFailure: true });
  for (const value of [true, 'true']) {
    assert.equal(parseParams({ simulateFailure: value }).simulateFailure, true);
  }
  for (const value of [false, 'false']) {
    assert.equal(parseParams({ simulateFailure: value }).simulateFailure, false);
  }
  for (const value of [null, [], 'true', 1]) {
    assert.throws(() => parseParams(value), { status: 400, code: 'VALIDATION' });
  }
  for (const value of [null, 0, 1, '', 'FALSE', [], {}]) {
    assert.throws(() => parseParams({ simulateFailure: value }), { status: 400 });
  }
});

test('transaction API: access, commit, rollback, saved evidence and cleanup', {
  skip: process.env.RUN_TRANSACTION_LAB_INTEGRATION !== '1',
  timeout: 90000,
}, async (t) => {
  await import('dotenv/config');
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Integration tests require the Firestore emulator');
  const [{ app }, { env }, { pool }, { firestore }, { default: jwt }] = await Promise.all([
    import('../src/app.js'), import('../src/config/env.js'), import('../src/config/pg.js'),
    import('../src/config/firebase.js'), import('jsonwebtoken'),
  ]);
  const originalResultsDir = env.labResultsDir;
  const resultsDir = await mkdtemp(path.join(os.tmpdir(), 'ticketrush-transaction-test-'));
  env.labResultsDir = resultsDir;
  t.after(async () => {
    env.labResultsDir = originalResultsDir;
    await rm(resultsDir, { recursive: true, force: true });
    await Promise.all([pool.end(), firestore.terminate()]);
  });

  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/admin/labs/transaction`;
  const token = (role) => jwt.sign({ userId: 'transaction-lab-test', role }, env.jwtSecret);
  const adminToken = token('ADMIN');
  async function request(suffix, body, credential = adminToken) {
    const res = await fetch(base + suffix, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30000),
    });
    return { status: res.status, data: await res.json() };
  }

  assert.equal((await request('/run', { params: {} }, null)).status, 401);
  assert.equal((await request('/run', { params: {} }, token('CUSTOMER'))).status, 403);
  for (const params of [null, [], { simulateFailure: 'invalid' }]) {
    assert.equal((await request('/run', { params })).status, 400);
  }
  assert.deepEqual((await request('/runs')).data, []);

  async function checkCleanup(dbms, runId) {
    if (dbms === 'firestore') {
      const ref = firestore.collection('transactionLabRuns').doc(runId);
      assert.equal((await ref.get()).exists, false);
      assert.equal((await ref.collection('records').get()).size, 0);
    } else {
      const { rows } = await pool.query(`
        SELECT
          (SELECT COUNT(*)::int FROM users WHERE email = $1) AS users,
          (SELECT COUNT(*)::int FROM events WHERE title = $2) AS events,
          (SELECT COUNT(*)::int FROM genres WHERE name = $3) AS genres,
          (SELECT COUNT(*)::int FROM venues WHERE name = $3) AS venues
      `, [`lab-${runId}@example.invalid`, `Transaction Lab ${runId}`, `Lab-${runId}`]);
      assert.deepEqual(rows[0], { users: 0, events: 0, genres: 0, venues: 0 });
    }
  }

  for (const simulateFailure of ['false', 'true']) {
    await t.test(`simulateFailure=${simulateFailure}`, async () => {
      const failed = simulateFailure === 'true';
      const { status, data } = await request('/run', { params: { simulateFailure } });
      assert.equal(status, 200);
      assert.deepEqual(data.params, { simulateFailure: failed });
      for (const dbms of ['postgres', 'firestore']) {
        const result = data.results[dbms];
        assert.equal(result.ok, true, `${dbms}: ${result.error}`);
        assert.deepEqual(result.metrics, {
          committed: !failed, rolledBack: failed, leftoverRecords: 0,
        });
        const { before, after, runId } = result.details;
        assert.equal(before.seatStatus, 'AVAILABLE');
        assert.equal(before.orders + before.tickets + before.payments, 0);
        if (failed) {
          assert.deepEqual(after, before);
        } else {
          assert.equal(after.seatStatus, 'SOLD');
          assert.equal(after.paidOrders, 1);
          assert.equal(after.validTickets, 1);
          assert.equal(after.successfulPayments, 1);
          assert.equal(after.version, before.version + 2);
        }
        await checkCleanup(dbms, runId);
      }
      const history = await request('/runs');
      assert.equal(history.status, 200);
      assert.deepEqual(history.data.find((entry) => entry.ranAt === data.ranAt), data);
    });
  }
});
