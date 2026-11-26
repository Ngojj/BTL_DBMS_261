// [labs/concurrency-control/postgres] Giờ G trên PostgreSQL: N người cùng mua "ghế tốt nhất còn trống" trong M ghế.
// Dữ liệu thử nằm trong hai bảng lab_cc_seats / lab_cc_sales (gắn run_id), không đụng bảng seats/tickets của ứng dụng,
// và bị xóa ngay sau khi đo. cc_sales KHÔNG có UNIQUE(seat_id) để thấy bán trùng khi không kiểm soát.
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { env } from '../../config/env.js';
import { parseParams, runBuyers, sleep, p95 } from './params.js';

const DDL = `
CREATE UNLOGGED TABLE IF NOT EXISTS lab_cc_seats (
  run_id uuid NOT NULL, seat_id int NOT NULL, status text NOT NULL DEFAULT 'AVAILABLE', holder int, version int NOT NULL DEFAULT 0,
  PRIMARY KEY (run_id, seat_id));
CREATE UNLOGGED TABLE IF NOT EXISTS lab_cc_sales (run_id uuid NOT NULL, seat_id int NOT NULL, user_id int NOT NULL);
CREATE INDEX IF NOT EXISTS lab_cc_sales_run ON lab_cc_sales (run_id);`;

const PICK = `SELECT seat_id, version FROM lab_cc_seats WHERE run_id = $1 AND status = 'AVAILABLE' ORDER BY seat_id LIMIT 1`;
const RETRYABLE = new Set(['40001', '40P01']);

export async function run(params = {}) {
  const { users, seats, strategy, thinkMs, concurrency } = parseParams(params);
  const runId = randomUUID();
  // Pool riêng để thí nghiệm không chiếm kết nối của các API đang phục vụ người dùng
  const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 20, ...(env.databaseSsl && { ssl: { rejectUnauthorized: false } }) });
  const stats = { ok: 0, soldout: 0, refused: 0, conflicts: 0, errors: {} };
  const lat = [];
  try {
    await pool.query(DDL);
    await pool.query('INSERT INTO lab_cc_seats (run_id, seat_id) SELECT $1, g FROM generate_series(1, $2) g', [runId, seats]);

    const tx = async (fn) => {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const r = await fn(c); await c.query('COMMIT'); return r; }
      catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
      finally { c.release(); }
    };
    const sell = async (c, seat, uid) => {
      await c.query("UPDATE lab_cc_seats SET status = 'SOLD', holder = $3, version = version + 1 WHERE run_id = $1 AND seat_id = $2", [runId, seat, uid]);
      await c.query('INSERT INTO lab_cc_sales (run_id, seat_id, user_id) VALUES ($1, $2, $3)', [runId, seat, uid]);
    };

    const buy = {
      none: (uid) => tx(async (c) => {
        const r = await c.query(PICK, [runId]);
        if (!r.rowCount) return 'soldout';
        await sleep(thinkMs);
        await sell(c, r.rows[0].seat_id, uid);
        return 'ok';
      }),
      pessimistic: (uid) => tx(async (c) => {
        const r = await c.query(PICK + ' FOR UPDATE', [runId]);
        if (!r.rowCount) return 'soldout';
        await sleep(thinkMs);
        await sell(c, r.rows[0].seat_id, uid);
        return 'ok';
      }),
      skip: (uid) => tx(async (c) => {
        const r = await c.query(PICK + ' FOR UPDATE SKIP LOCKED', [runId]);
        if (!r.rowCount) return 'soldout';
        await sleep(thinkMs);
        await sell(c, r.rows[0].seat_id, uid);
        return 'ok';
      }),
      optimistic: async (uid) => {
        for (let attempt = 1; attempt <= 30; attempt++) {
          const r = await pool.query(PICK, [runId]);
          if (!r.rowCount) return 'soldout';
          await sleep(thinkMs);
          const { seat_id: seat, version } = r.rows[0];
          const won = await tx(async (c) => {
            const u = await c.query("UPDATE lab_cc_seats SET status = 'SOLD', holder = $3, version = version + 1 WHERE run_id = $1 AND seat_id = $2 AND version = $4",
              [runId, seat, uid, version]);
            if (!u.rowCount) return false; // có người ghi trước
            await c.query('INSERT INTO lab_cc_sales (run_id, seat_id, user_id) VALUES ($1, $2, $3)', [runId, seat, uid]);
            return true;
          });
          if (won) return 'ok';
          stats.conflicts++;
        }
        return 'refused';
      },
    }[strategy];

    const t0 = performance.now();
    await runBuyers(users, concurrency, async (uid) => {
      const s = performance.now();
      try { stats[await buy(uid)]++; }
      catch (e) { stats.refused++; stats.errors[e.code ?? 'app'] = (stats.errors[e.code ?? 'app'] ?? 0) + 1; if (RETRYABLE.has(e.code)) stats.conflicts++; }
      lat.push(performance.now() - s);
    });
    const elapsedMs = Math.round(performance.now() - t0);

    const f = (await pool.query(`SELECT
        (SELECT count(*) FROM lab_cc_sales WHERE run_id = $1)::int AS tickets,
        (SELECT count(DISTINCT seat_id) FROM lab_cc_sales WHERE run_id = $1)::int AS sold,
        (SELECT count(*) FROM lab_cc_seats WHERE run_id = $1 AND status = 'AVAILABLE')::int AS left,
        (SELECT count(*) FROM lab_cc_sales s JOIN lab_cc_seats t ON t.run_id = s.run_id AND t.seat_id = s.seat_id
          WHERE s.run_id = $1 AND s.user_id <> t.holder)::int AS lost`, [runId])).rows[0];
    return {
      metrics: {
        sold: f.sold, ticketsIssued: f.tickets, duplicates: f.tickets - f.sold, lostUpdates: f.lost,
        buyers: stats.ok, soldOut: stats.soldout, refused: stats.refused, seatsLeft: f.left,
        conflicts: stats.conflicts, elapsedMs, p95Ms: p95(lat),
        method: { none: 'Đọc rồi ghi, không khóa', pessimistic: 'SELECT … FOR UPDATE', optimistic: 'Cột version, thử lại tối đa 30 lần', skip: 'FOR UPDATE SKIP LOCKED' }[strategy],
      },
      details: { runId, users, seats, strategy, thinkMs, errors: stats.errors },
    };
  } finally {
    await pool.query('DELETE FROM lab_cc_sales WHERE run_id = $1', [runId]).catch(() => {});
    await pool.query('DELETE FROM lab_cc_seats WHERE run_id = $1', [runId]).catch(() => {});
    await pool.end();
  }
}
