import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { parseParams, makeFixture, summarize, verify } from '../src/labs/backup-recovery/shared.js';

test('backup params refuse production IDs, paths, and invalid sizes', () => {
  assert.deepEqual(parseParams(), { seatCount: 50 });
  for (const seatCount of [1, 200]) assert.deepEqual(parseParams({ seatCount }), { seatCount });
  for (const params of [null, [], 'x', { eventId: 1 }, { path: '/tmp/x' },
    ...[null, 0, 201, -1, 1.5, '50', true, NaN].map((seatCount) => ({ seatCount }))]) {
    assert.throws(() => parseParams(params), { status: 400, code: 'VALIDATION' });
  }
});

test('restore verification detects same-count corruption and incomplete deletion', () => {
  const fixture = makeFixture('test', 2);
  const before = summarize(fixture);
  const empty = summarize({ events: [], zones: [], seats: [] });
  const reordered = structuredClone(fixture);
  reordered.seats.reverse();
  assert.doesNotThrow(() => verify(before, empty, summarize(reordered)));
  reordered.seats[0].status = 'SOLD';
  assert.throws(() => verify(before, empty, summarize(reordered)), /không khớp/);
  assert.throws(() => verify(before, before, before), /chưa loại bỏ/);
});

test('backup API: access, real dump/restore, JSON restore, evidence, cleanup and tool failure', {
  skip: process.env.RUN_BACKUP_LAB_INTEGRATION !== '1', timeout: 180000,
}, async (t) => {
  await import('dotenv/config');
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Integration test requires Firestore Emulator');
  const [{ app }, { env }, { pool }, { firestore }, { default: jwt }] = await Promise.all([
    import('../src/app.js'), import('../src/config/env.js'), import('../src/config/pg.js'),
    import('../src/config/firebase.js'), import('jsonwebtoken'),
  ]);
  const originalResultsDir = env.labResultsDir;
  const resultsDir = await mkdtemp(path.join(os.tmpdir(), 'ticketrush-backup-test-'));
  env.labResultsDir = resultsDir;
  let sentinel;
  t.after(async () => {
    env.labResultsDir = originalResultsDir;
    const topicDir = path.join(resultsDir, 'backup-recovery');
    for (const file of await readdir(topicDir).catch(() => [])) await rm(path.join(topicDir, file));
    await rmdir(topicDir).catch((e) => { if (e.code !== 'ENOENT') throw e; });
    await rmdir(resultsDir);
    if (sentinel) await sentinel.delete();
    await Promise.all([pool.end(), firestore.terminate()]);
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api/admin/labs/backup-recovery`;
  const token = (role) => jwt.sign({ userId: 'backup-test', role }, env.jwtSecret);
  async function request(suffix, body, credential = token('ADMIN')) {
    const res = await fetch(base + suffix, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(90000),
    });
    return { status: res.status, data: await res.json() };
  }
  assert.equal((await request('/run', { params: {} }, null)).status, 401);
  assert.equal((await request('/run', { params: {} }, token('CUSTOMER'))).status, 403);
  for (const params of [null, [], { eventId: 1 }, { seatCount: 0 }]) {
    assert.equal((await request('/run', { params })).status, 400);
  }

  const schemas = async () => (await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'backup_lab_%' ORDER BY nspname")).rows;
  const initialSchemas = await schemas();
  // An unrelated document must survive both cleanup and the simulated deletion.
  sentinel = firestore.collection('backupLabRuns').doc(`sentinel-${randomUUID()}`);
  await sentinel.set({ untouched: true });

  for (const seatCount of [1, 50, 200]) {
    const { status, data } = await request('/run', { params: { seatCount } });
    assert.equal(status, 200);
    for (const dbms of ['postgres', 'firestore']) {
      const r = data.results[dbms];
      assert.equal(r.ok, true, `${dbms}: ${r.error}`);
      assert.equal(r.metrics.recordsRestored, seatCount + 2);
      assert.equal(r.metrics.dataLoss, false);
      assert.ok(r.metrics.backupBytes > 0);
      assert.ok(r.metrics.backupMs >= 0 && r.metrics.restoreMs >= 0);
      assert.equal(r.details.afterDeletion.records, 0);
      assert.deepEqual(r.details.before, r.details.afterRestore);
      if (dbms === 'firestore') {
        const root = firestore.doc(r.details.collection);
        for (const name of ['events', 'zones', 'seats']) assert.equal((await root.collection(name).get()).size, 0);
      }
    }
    assert.deepEqual(await schemas(), initialSchemas);
    assert.equal((await sentinel.get()).get('untouched'), true);
    assert.deepEqual((await request('/runs')).data.find((item) => item.ranAt === data.ranAt), data);
  }
  // Failure before deletion (dump) and after committed deletion (restore).
  for (const [key, tool] of [['PG_DUMP_PATH', 'pg_dump'], ['PG_RESTORE_PATH', 'pg_restore']]) {
    const originalPath = process.env[key];
    try {
      process.env[key] = path.join(resultsDir, `missing-${tool}`);
      const { data } = await request('/run', { params: { seatCount: 1 } });
      assert.equal(data.results.postgres.ok, false);
      assert.ok(data.results.postgres.error.includes(tool));
      assert.equal(data.results.firestore.ok, true);
      assert.deepEqual(await schemas(), initialSchemas);
      assert.equal((await sentinel.get()).get('untouched'), true);
    } finally {
      if (originalPath === undefined) delete process.env[key];
      else process.env[key] = originalPath;
    }
  }
});
