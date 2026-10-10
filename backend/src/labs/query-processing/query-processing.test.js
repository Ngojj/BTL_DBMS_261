import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { validateParams, sameRows, totals } from './shared.js';
import { pool } from '../../config/pg.js';
import { env } from '../../config/env.js';
import { firestore as db } from '../../config/firebase.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import router, { runComparison } from './index.js';
import * as firestore from './firestore.js';
import * as postgres from './postgres.js';

test('lab validates event IDs without losing BIGINT precision', () => {
  assert.deepEqual(validateParams(), { eventId: '1' });
  assert.deepEqual(validateParams({ eventId: 2 }), { eventId: '2' });
  assert.deepEqual(validateParams({ eventId: '9007199254740993' }), { eventId: '9007199254740993' });
  for (const value of [null, [], '1']) assert.throws(() => validateParams(value), { code: 'VALIDATION' });
  for (const eventId of [null, 0, -1, 1.2, '', 'abc', '1 OR 1=1', [], {}, true, '9223372036854775808', 9007199254740992]) {
    assert.throws(() => validateParams({ eventId }), { code: 'VALIDATION' });
  }
});

test('verification compares each zone, not just the overall total', () => {
  const rows = [
    { eventId: '1', eventTitle: 'Show', zoneId: '2', zone: 'VIP', ticketsSold: 1, revenue: 100 },
    { eventId: '1', eventTitle: 'Show', zoneId: '10', zone: 'GA', ticketsSold: 1, revenue: 200 },
  ];
  assert.equal(sameRows(rows, [...rows].reverse()), true);
  assert.equal(sameRows(rows, rows.map((r, i) => ({ ...r, revenue: [200, 100][i] }))), false);
  assert.deepEqual(totals(rows), { ticketsSold: 2, revenue: 300 });
  assert.throws(() => totals([{ ticketsSold: 2, revenue: Number.MAX_SAFE_INTEGER + 1 }]), { code: 'UNSAFE_TOTAL' });
});

test('cleanup refuses application collections', async () => {
  await assert.rejects(firestore.cleanup(db.doc('events/1')), /Chỉ xóa/);
});

test('real PostgreSQL + Emulator: equality, empty data, failures, isolation, HTTP and history', {
  skip: process.env.RUN_TV3_DB_TESTS !== 'true', timeout: 60000,
}, async (t) => {
  await firestore.checkEmulator();
  const originalResultsDir = env.labResultsDir;
  const testResultsDir = await mkdtemp(path.join(tmpdir(), 'ticketrush-query-processing-'));
  env.labResultsDir = testResultsDir;
  t.after(async () => {
    env.labResultsDir = originalResultsDir;
    assert.equal(path.dirname(testResultsDir), path.resolve(tmpdir()));
    await rm(testResultsDir, { recursive: true, force: true });
  });
  const client = new pg.Client({ connectionString: env.databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  t.after(async () => { await client.end(); await db.terminate(); });
  await client.query(`
    CREATE TEMP TABLE events (event_id bigint PRIMARY KEY, title text);
    CREATE TEMP TABLE zones (zone_id bigint PRIMARY KEY, event_id bigint, name text);
    CREATE TEMP TABLE seats (seat_id bigint PRIMARY KEY, zone_id bigint);
    CREATE TEMP TABLE orders (order_id bigint PRIMARY KEY, event_id bigint, status text);
    CREATE TEMP TABLE tickets (ticket_id bigint PRIMARY KEY, order_id bigint, seat_id bigint, price numeric(12,0), status text);
    INSERT INTO events VALUES (1, 'Show'), (2, 'No zones'), (9007199254740993, 'Large ID');
    INSERT INTO zones VALUES (1, 1, 'VIP'), (2, 1, 'GA'), (3, 1, 'Empty'), (4, 9007199254740993, 'VIP');
    INSERT INTO seats VALUES (1, 1), (2, 1), (3, 2), (4, 2), (5, 2), (6, 2), (7, 2);
    INSERT INTO orders VALUES (1, 1, 'PAID'), (2, 1, 'PENDING'), (3, 1, 'CANCELLED'), (4, 1, 'EXPIRED');
    INSERT INTO tickets VALUES (1, 1, 1, 100000, 'VALID'), (2, 1, 2, 200000, 'CHECKED_IN'),
      (3, 1, 3, 0, 'VALID'), (4, 2, 4, 900000, 'VALID'), (5, 3, 5, 900000, 'VALID'),
      (6, 4, 6, 900000, 'VALID'), (7, 1, 7, 900000, 'CANCELLED');
  `);
  t.mock.method(pool, 'connect', async () => ({ query: (...args) => client.query(...args), release() {} }));
  const before = (await db.collection(firestore.LAB_COLLECTION).listDocuments()).map((doc) => doc.id).sort();

  await t.test('same snapshot includes checked-in/zero-price tickets and excludes unpaid/cancelled', async () => {
    const result = await runComparison({ eventId: 1 });
    const p = result.results.postgres;
    const f = result.results.firestore;
    assert.equal(p.ok, true);
    assert.equal(f.ok, true, f.error);
    assert.equal(p.details.verification, 'MATCH');
    assert.deepEqual(p.details.rows, f.details.rows);
    assert.deepEqual(p.metrics, { queries: 1, rowsRead: 3, groups: 3, ticketsSold: 3, revenue: 300000 });
    assert.deepEqual(f.metrics, { queries: 3, rowsRead: 8, groups: 3, ticketsSold: 3, revenue: 300000 });
    assert.equal(f.details.cleanup.status, 'deleted');
    assert.equal(f.details.preparation.documentsWritten, 11);
    assert.equal(p.details.rows[2].revenue, 0);
  });

  await t.test('no zones, zero sales and large IDs return honest zero metrics', async () => {
    for (const eventId of ['2', '9007199254740993']) {
      const result = await runComparison({ eventId });
      assert.equal(result.results.firestore.details.verification, 'MATCH');
      assert.equal(result.results.firestore.metrics.revenue, 0);
      assert.equal(result.results.postgres.metrics.groups, eventId === '2' ? 0 : 1);
    }
    await assert.rejects(runComparison({ eventId: '999' }), { status: 404, code: 'EVENT_NOT_FOUND' });
  });

  await t.test('separate Firestore snapshots survive cleanup of another run', async () => {
    const snapshot = await postgres.prepare({ eventId: '1' });
    const first = firestore.datasetRef(randomUUID());
    const second = firestore.datasetRef(randomUUID());
    try {
      await Promise.all([firestore.prepare(first, snapshot), firestore.prepare(second, snapshot)]);
      await firestore.cleanup(first);
      const result = await firestore.run({}, second);
      assert.equal(result.metrics.revenue, 300000);
    } finally { await Promise.all([firestore.cleanup(first), firestore.cleanup(second)]); }
  });

  await t.test('missing emulator is reported as failed, not as zero revenue', async () => {
    const original = env.firestoreEmulatorHost;
    try {
      env.firestoreEmulatorHost = '';
      const result = await runComparison({ eventId: '1' });
      assert.equal(result.results.postgres.ok, true);
      assert.equal(result.results.firestore.ok, false);
      assert.equal(result.results.firestore.durationMs, null);
      assert.equal(result.results.firestore.details.verification, 'NOT_COMPARED');
      assert.equal(result.results.firestore.details.errorCode, 'EMULATOR_REQUIRED');
    } finally { env.firestoreEmulatorHost = original; }
  });

  await t.test('HTTP validates input, enforces role and persists real results', async () => {
    const app = express();
    app.use(express.json());
    app.use('/lab', authenticate, authorize('ADMIN'), router);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const url = `http://127.0.0.1:${server.address().port}/lab`;
      const token = (role) => jwt.sign({ userId: '1', role }, env.jwtSecret);
      const request = (params, role = 'ADMIN') => fetch(url + '/run', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token(role) },
        body: JSON.stringify({ params }),
      });
      assert.equal((await request({ eventId: 1 }, 'CUSTOMER')).status, 403);
      assert.equal((await request({ eventId: 'bad' })).status, 400);
      const response = await request({ eventId: 1 });
      assert.equal(response.status, 200);
      const run = await response.json();
      assert.equal(run.results.firestore.details.verification, 'MATCH');
      const historyResponse = await fetch(url + '/runs', { headers: { Authorization: 'Bearer ' + token('ADMIN') } });
      const history = await historyResponse.json();
      const saved = history.find((entry) => entry.ranAt === run.ranAt);
      assert.deepEqual(saved, run);
    } finally { await new Promise((resolve) => server.close(resolve)); }
  });
  const after = (await db.collection(firestore.LAB_COLLECTION).listDocuments()).map((doc) => doc.id).sort();
  assert.deepEqual(after, before);
});
