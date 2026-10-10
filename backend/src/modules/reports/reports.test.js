import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { pool } from '../../config/pg.js';
import { env } from '../../config/env.js';
import routes from './reports.route.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { suspiciousAccounts } from './reports.service.js';

test('suspicious endpoint requires ADMIN and supplies actionable reasons', async (t) => {
  const query = t.mock.method(pool, 'query', async () => ({ rows: [{
    userId: '7', email: 'demo@example.com', phone: '0900000000', ticketCount: 5,
    sharedPhoneAccounts: 2, exceededEvents: [{ eventId: '1', eventTitle: 'Show', ticketCount: 5, limit: 4 }],
  }] }));
  const app = express();
  app.use('/reports', routes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/reports/suspicious-accounts`;
  for (const [role, expected] of [[null, 401], ['CUSTOMER', 403], ['STAFF', 403], ['ADMIN', 200]]) {
    const response = await fetch(url, { headers: role ? {
      Authorization: 'Bearer ' + jwt.sign({ userId: '1', role }, env.jwtSecret),
    } : {} });
    assert.equal(response.status, expected);
    const body = await response.json();
    if (role === 'ADMIN') {
      assert.equal(body[0].ticketCount, 5);
      assert.match(body[0].reason, /5\/4 vé/);
      assert.match(body[0].reason, /2 tài khoản/);
    }
  }
  assert.equal(query.mock.callCount(), 1);
});

test('SQL flags per-event violations and shared customer phones, excluding inactive tickets', {
  skip: process.env.RUN_TV3_DB_TESTS !== 'true',
}, async (t) => {
  const client = new pg.Client({ connectionString: env.databaseUrl, connectionTimeoutMillis: 5000 });
  await client.connect();
  t.after(() => client.end());
  // Bảng tạm riêng kết nối; không sửa dữ liệu nghiệp vụ hoặc trigger thật.
  await client.query(`
    CREATE TEMP TABLE users (user_id bigint, email text, phone text, role text);
    CREATE TEMP TABLE events (event_id bigint, title text, max_tickets_per_user int);
    CREATE TEMP TABLE orders (order_id bigint, user_id bigint, event_id bigint, status text);
    CREATE TEMP TABLE tickets (ticket_id bigint, order_id bigint, status text);
    INSERT INTO users VALUES
      (1, 'over@example.com', '0900000001', 'CUSTOMER'),
      (2, 'shared@example.com', '0900000001', 'CUSTOMER'),
      (3, 'allowed@example.com', '0900000003', 'CUSTOMER'),
      (4, 'inactive@example.com', '0900000004', 'CUSTOMER'),
      (5, 'admin@example.com', '0900000001', 'ADMIN'),
      (6, 'empty@example.com', '0900000006', 'CUSTOMER');
    INSERT INTO events VALUES (1, 'Show 1', 4), (2, 'Show 2', 4);
    INSERT INTO orders VALUES (1, 1, 1, 'PAID'), (2, 1, 2, 'PAID'),
      (3, 3, 1, 'PAID'), (4, 3, 2, 'PAID'), (5, 4, 1, 'PENDING'),
      (6, 4, 1, 'CANCELLED'), (7, 4, 1, 'EXPIRED'), (8, 4, 1, 'PAID');
    INSERT INTO tickets SELECT n, 1, CASE WHEN n = 1 THEN 'CHECKED_IN' ELSE 'VALID' END FROM generate_series(1, 5) n;
    INSERT INTO tickets SELECT n + 10, 2, 'VALID' FROM generate_series(1, 4) n;
    INSERT INTO tickets SELECT n + 20, 3, 'VALID' FROM generate_series(1, 4) n;
    INSERT INTO tickets SELECT n + 30, 4, 'VALID' FROM generate_series(1, 4) n;
    INSERT INTO tickets SELECT n + 40, 5, 'VALID' FROM generate_series(1, 6) n;
    INSERT INTO tickets SELECT n + 50, 6, 'VALID' FROM generate_series(1, 6) n;
    INSERT INTO tickets SELECT n + 60, 7, 'VALID' FROM generate_series(1, 6) n;
    INSERT INTO tickets SELECT n + 70, 8, 'CANCELLED' FROM generate_series(1, 6) n;
  `);
  t.mock.method(pool, 'query', (...args) => client.query(...args));
  let rows = await suspiciousAccounts();
  assert.deepEqual(rows.map((r) => r.userId), ['1', '2']);
  assert.equal(rows[0].ticketCount, 9);
  assert.deepEqual(rows[0].exceededEvents, [{ eventId: '1', eventTitle: 'Show 1', ticketCount: 5, limit: 4 }]);
  assert.equal(rows[0].sharedPhoneAccounts, 2);
  assert.equal(rows[1].ticketCount, 0);
  assert.deepEqual(rows[1].exceededEvents, []);
  // Cập nhật chỉ fixture: bỏ số chung và hủy vé vượt giới hạn -> không còn cảnh báo.
  await client.query("UPDATE pg_temp.users SET phone = '0900000002' WHERE user_id = 2");
  await client.query("UPDATE pg_temp.tickets SET status = 'CANCELLED' WHERE ticket_id = 5");
  rows = await suspiciousAccounts();
  assert.deepEqual(rows, []);
});
