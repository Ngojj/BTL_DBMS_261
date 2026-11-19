// [labs/query-processing/postgres] Q_DT trên PostgreSQL: MỘT câu SQL JOIN + GROUP BY; đo bằng EXPLAIN (ANALYZE, BUFFERS).
// Toàn bộ dữ liệu thử nằm trong MỘT transaction rồi ROLLBACK, nên không để lại gì kể cả khi lỗi giữa chừng và không chạm bảng thật.
import { randomBytes } from 'node:crypto';
import { pool } from '../../config/pg.js';
import { buildDataset, expectedRevenue, sameAsExpected, EVENT_ID } from './dataset.js';
import { parseParams } from './params.js';

const RUNS = 3; // lấy trung vị của 3 lần đo sau 1 lần chạy nóng

const qdt = (schema) => `
  SELECT z.name, COUNT(*)::int AS tickets, SUM(t.price)::bigint AS revenue
    FROM ${schema}.zones z
    JOIN ${schema}.seats s ON s.zone_id = z.zone_id
    JOIN ${schema}.tickets t ON t.seat_id = s.seat_id
   WHERE z.event_id = ${EVENT_ID} AND t.status <> 'CANCELLED'
   GROUP BY z.name`;

// Duyệt cây kế hoạch: gom các nút và số dòng đọc ở nút lá (Actual Rows + Rows Removed by Filter) × loops
function walk(node, acc = { nodes: [], rowsRead: 0 }) {
  const loops = node['Actual Loops'] ?? 1;
  const isScan = /Scan$/.test(node['Node Type']);
  acc.nodes.push({
    node: node['Node Type'],
    on: node['Relation Name'] ?? node['Index Name'] ?? null,
    actualRows: node['Actual Rows'],
    loops,
  });
  if (isScan) acc.rowsRead += ((node['Actual Rows'] ?? 0) + (node['Rows Removed by Filter'] ?? 0)) * loops;
  for (const child of node.Plans ?? []) walk(child, acc);
  return acc;
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

export async function run(params = {}) {
  const { tickets: n } = parseParams(params);
  const ds = buildDataset(n);
  const schema = 'lab_qp_' + randomBytes(4).toString('hex');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL max_parallel_workers_per_gather = 0'); // cùng điều kiện đo với báo cáo (tắt truy vấn song song)
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`CREATE TABLE ${schema}.zones (zone_id int PRIMARY KEY, event_id int NOT NULL, name text NOT NULL, price int NOT NULL)`);
    await client.query(`CREATE TABLE ${schema}.seats (seat_id int PRIMARY KEY, zone_id int NOT NULL)`);
    await client.query(`CREATE TABLE ${schema}.tickets (ticket_id int PRIMARY KEY, seat_id int NOT NULL, price int NOT NULL, status text NOT NULL)`);
    await client.query(
      `INSERT INTO ${schema}.zones SELECT * FROM unnest($1::int[], $2::int[], $3::text[], $4::int[])`,
      [ds.zones.map((z) => z.id), ds.zones.map(() => EVENT_ID), ds.zones.map((z) => z.name), ds.zones.map((z) => z.price)],
    );
    await client.query(`INSERT INTO ${schema}.seats SELECT * FROM unnest($1::int[], $2::int[])`, [ds.seats.map((s) => s.seatId), ds.seats.map((s) => s.zoneId)]);
    await client.query(`INSERT INTO ${schema}.tickets SELECT * FROM unnest($1::int[], $2::int[], $3::int[], $4::text[])`, [
      ds.tickets.map((t) => t.ticketId),
      ds.tickets.map((t) => t.seatId),
      ds.tickets.map((t) => t.price),
      ds.tickets.map((t) => (t.active ? 'VALID' : 'CANCELLED')),
    ]);
    await client.query(`CREATE INDEX ON ${schema}.seats (zone_id)`);
    await client.query(`CREATE INDEX ON ${schema}.tickets (seat_id)`);
    await client.query(`CREATE INDEX ON ${schema}.zones (event_id)`);
    for (const t of ['zones', 'seats', 'tickets']) await client.query(`ANALYZE ${schema}.${t}`);

    // Kết quả thật (để đối chiếu với đáp án tính bằng JavaScript)
    const { rows } = await client.query(qdt(schema));
    const got = Object.fromEntries(rows.map((r) => [r.name, { tickets: r.tickets, revenue: Number(r.revenue) }]));
    const expected = expectedRevenue(ds);

    // Đo bằng EXPLAIN: 1 lần chạy nóng + RUNS lần đo
    const explain = async () => (await client.query(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${qdt(schema)}`)).rows[0]['QUERY PLAN'][0];
    await explain();
    const plans = [];
    for (let i = 0; i < RUNS; i++) plans.push(await explain());
    const execMs = plans.map((p) => p['Execution Time']);
    const best = plans[execMs.indexOf(median(execMs))];
    const { nodes, rowsRead } = walk(best.Plan);
    const buffers = (best.Plan['Shared Hit Blocks'] ?? 0) + (best.Plan['Shared Read Blocks'] ?? 0);
    const joins = nodes.filter((x) => /Join|Nested Loop/.test(x.node)).map((x) => x.node);
    const scans = nodes.filter((x) => /Scan$/.test(x.node)).map((x) => `${x.node}${x.on ? ' (' + x.on + ')' : ''}`);

    return {
      metrics: {
        queries: 1,
        rowsRead,
        groups: rows.length,
        revenue: Object.values(got).reduce((s, g) => s + g.revenue, 0),
        matchesExpected: sameAsExpected(got, expected),
        queryMs: Number(median(execMs).toFixed(2)),
        plan: [...new Set(joins)].join(' + ') || nodes[0].node,
        buffers,
      },
      details: {
        sql: qdt('<lược đồ thử>').replace(/\s+/g, ' ').trim(),
        tickets: n,
        executionMsPerRun: execMs.map((x) => Number(x.toFixed(2))),
        planningMs: Number(best['Planning Time'].toFixed(2)),
        scans,
        nodes,
        result: got,
      },
    };
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    client.release();
  }
}
