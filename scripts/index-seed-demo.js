/**
 * TicketRush - PostgreSQL Large Seed for the Indexing benchmark.
 *
 * IMPORTANT:
 * - Run this only against a dedicated database whose name contains "benchmark".
 * - It requires the base catalog created by scripts/seed.js --pg-only.
 * - It writes PostgreSQL only. It never connects to or modifies Firestore.
 * - It never edits or truncates the original seed data.
 *
 * Examples (from repository root):
 *   node scripts/large-seed.js --tickets 50000
 *   node scripts/large-seed.js --tickets 250000 --replace
 *   node scripts/large-seed.js --tickets 500000 --replace
 *
 * Operational safeguards:
 * - Prints each phase before running it and emits a 15-second heartbeat.
 * - Uses pg_try_advisory_xact_lock so a second seed fails immediately rather
 *   than waiting indefinitely behind another seed process.
 * - Before --replace, requires a valid, non-partial tickets(seat_id) index;
 *   this supports the FK check while benchmark seats are deleted.
 */
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const envPath = fileURLToPath(new URL("../backend/.env", import.meta.url));
process.loadEnvFile(envPath);
const { pool } = await import("../backend/src/config/pg.js");

const argv = process.argv.slice(2);
function getArg(name, fallback) {
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Thiếu giá trị cho --${name}.`);
  }
  return value;
}

const TOTAL_TICKETS = Number(getArg("tickets", "50000"));
const SEED = Number(getArg("seed", "20261115"));
const REPLACE = argv.includes("--replace");
const EVENT_COUNT = 25;
const BASE_EVENT_IDS = [1, 2, 3, 4, 5, 6, 7];
const EXTRA_EVENT_COUNT = EVENT_COUNT - BASE_EVENT_IDS.length;
const TICKETS_PER_ORDER = 10;
const TICKET_PRICE = 500000;
const BENCHMARK_EMAIL_PATTERN = "bench.%@benchmark.ticketrush.local";

if (
  !Number.isSafeInteger(TOTAL_TICKETS) ||
  TOTAL_TICKETS < EVENT_COUNT ||
  TOTAL_TICKETS > 1_000_000
) {
  throw new Error("--tickets phải là số nguyên từ 25 đến 1.000.000.");
}
if (!Number.isSafeInteger(SEED)) {
  throw new Error("--seed phải là số nguyên an toàn.");
}

const runTag = `run_${Date.now().toString(36)}`;
const roundMs = (value) => Number(value.toFixed(1));
const HEARTBEAT_MS = 15_000;
const runStartedAt = performance.now();
const phaseTimes = {};

function formatDuration(ms) {
  if (ms < 1000) return `${roundMs(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Run one visible step. The heartbeat is useful for long DELETE/INSERT/UPDATE
 * statements: node-postgres keeps the event loop available while awaiting SQL.
 */
async function phase(name, fn) {
  const started = performance.now();
  console.log(`\n▶ ${name}...`);
  const heartbeat = setInterval(() => {
    const elapsed = performance.now() - started;
    console.log(`  … ${name} vẫn đang chạy (${formatDuration(elapsed)}).`);
  }, HEARTBEAT_MS);
  heartbeat.unref?.();

  try {
    const result = await fn();
    const elapsed = performance.now() - started;
    phaseTimes[name] = roundMs(elapsed);
    const rowInfo =
      typeof result?.rowCount === "number"
        ? ` · ${result.rowCount.toLocaleString("en-US")} rows`
        : "";
    console.log(`  ✓ ${name}: ${formatDuration(elapsed)}${rowInfo}`);
    return result;
  } catch (error) {
    const elapsed = performance.now() - started;
    console.error(
      `  ✘ ${name} thất bại sau ${formatDuration(elapsed)}: ${error.message}`,
    );
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}

let client;
let transactionOpen = false;

try {
  console.log("TicketRush · PostgreSQL Large Seed");
  console.log(`Tổng vé benchmark: ${TOTAL_TICKETS.toLocaleString("en-US")}`);
  console.log(`Seed: ${SEED} · Replace: ${REPLACE ? "yes" : "no"}`);

  console.log("\nĐang kết nối PostgreSQL...");
  client = await pool.connect();
  const dbResult = await client.query(
    "SELECT current_database() AS database_name",
  );
  const databaseName = dbResult.rows[0].database_name;
  console.log(`Database hiện tại: ${databaseName}`);

  if (!databaseName.toLowerCase().includes("benchmark")) {
    throw new Error(
      `Từ chối ghi dữ liệu vào database "${databaseName}". Hãy dùng database riêng có tên chứa "benchmark" (ví dụ ticketrush_benchmark) và đổi DATABASE_URL tạm thời trong backend/.env.`,
    );
  }

  await client.query("BEGIN");
  transactionOpen = true;
  const advisory = await client.query(
    "SELECT pg_try_advisory_xact_lock(hashtext('ticketrush-large-seed')) AS acquired",
  );
  if (!advisory.rows[0]?.acquired) {
    const activeSeeds = await client.query(`
      SELECT a.pid, a.state, a.wait_event_type, a.wait_event,
             now() - a.xact_start AS transaction_age,
             left(a.query, 140) AS current_query
      FROM pg_locks l
      JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype = 'advisory'
        AND l.granted
        AND a.datname = current_database()
        AND a.pid <> pg_backend_pid()
      ORDER BY a.xact_start NULLS LAST
    `);
    const holders = activeSeeds.rows
      .map(
        (row) =>
          `PID ${row.pid} (${row.state}, ${row.wait_event_type ?? "no wait"}/${row.wait_event ?? "-"})`,
      )
      .join(", ");
    throw new Error(
      `Một tiến trình Large Seed khác đang giữ advisory lock. Script dừng ngay, không xếp hàng chờ.${holders ? ` Session đang giữ advisory lock: ${holders}.` : " Kiểm tra pg_stat_activity/pg_locks để tìm session giữ lock."} Hãy đợi tiến trình đó kết thúc hoặc kiểm tra session trước khi xử lý.`,
    );
  }
  console.log("  ✓ Đã lấy advisory lock; không có seed khác chạy đồng thời.");

  const baseCheck = await client.query(
    `
    SELECT
      (SELECT count(*)::int FROM events WHERE event_id = ANY($1::bigint[])) AS base_events,
      (SELECT count(*)::int FROM genres) AS genres,
      (SELECT count(*)::int FROM venues) AS venues,
      (SELECT count(*)::int FROM users WHERE email LIKE $2) AS old_benchmark_users,
      (SELECT count(*)::int FROM events WHERE title LIKE 'Index Benchmark Event %') AS old_benchmark_events,
      (SELECT count(*)::int FROM zones WHERE name = 'BENCHMARK') AS old_benchmark_zones
  `,
    [BASE_EVENT_IDS, BENCHMARK_EMAIL_PATTERN],
  );
  const check = baseCheck.rows[0];

  if (
    check.base_events !== BASE_EVENT_IDS.length ||
    check.genres < 1 ||
    check.venues < 1
  ) {
    throw new Error(
      "Database chưa có dữ liệu nền TicketRush. Hãy chạy schema.sql, sau đó node scripts/seed.js --pg-only trong database benchmark trước.",
    );
  }

  const existingBenchmarkData =
    check.old_benchmark_users +
    check.old_benchmark_events +
    check.old_benchmark_zones;
  if (existingBenchmarkData > 0 && !REPLACE) {
    throw new Error(
      "Đã phát hiện dữ liệu Large Seed trước đó. Dùng --replace để thay thế riêng dữ liệu benchmark; seed.js và dữ liệu demo gốc không bị xóa.",
    );
  }

  if (REPLACE) {
    // A full (non-partial) index is required to make FK checks from tickets
    // to seats efficient for every ticket status, including CANCELLED.
    const fkIndex = await client.query(`
      SELECT i.indisvalid,
             i.indpred IS NULL AS is_not_partial,
             pg_get_indexdef(i.indexrelid) AS index_definition
      FROM pg_index i
      JOIN pg_class idx ON idx.oid = i.indexrelid
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      WHERE ns.nspname = 'public'
        AND tbl.relname = 'tickets'
        AND idx.relname = 'idx_tickets_seat_id_fk'
      LIMIT 1
    `);
    const fkIndexReady =
      fkIndex.rows[0]?.indisvalid &&
      fkIndex.rows[0]?.is_not_partial &&
      /USING btree \(seat_id\)/.test(fkIndex.rows[0]?.index_definition ?? "");
    if (!fkIndexReady) {
      throw new Error(
        "Trước khi dùng --replace, cần tạo Index đầy đủ trên tickets(seat_id) để hỗ trợ kiểm tra Foreign Key khi xóa ghế. Chạy: CREATE INDEX IF NOT EXISTS idx_tickets_seat_id_fk ON public.tickets(seat_id); Sau đó chạy ANALYZE public.tickets; rồi thử lại.",
      );
    }
    console.log(
      "  ✓ Đã xác nhận idx_tickets_seat_id_fk là Index hợp lệ, không phải Partial Index.",
    );

    console.log("\nDọn dữ liệu benchmark cũ (từng bảng, có heartbeat):");
    await phase("Xóa payments benchmark", () =>
      client.query(
        `
      DELETE FROM payments p
      USING orders o, users u
      WHERE p.order_id = o.order_id
        AND o.user_id = u.user_id
        AND u.email LIKE $1
    `,
        [BENCHMARK_EMAIL_PATTERN],
      ),
    );

    await phase("Xóa tickets benchmark", () =>
      client.query(
        `
      DELETE FROM tickets t
      USING orders o, users u
      WHERE t.order_id = o.order_id
        AND o.user_id = u.user_id
        AND u.email LIKE $1
    `,
        [BENCHMARK_EMAIL_PATTERN],
      ),
    );

    await phase("Xóa orders benchmark", () =>
      client.query(
        `
      DELETE FROM orders o
      USING users u
      WHERE o.user_id = u.user_id
        AND u.email LIKE $1
    `,
        [BENCHMARK_EMAIL_PATTERN],
      ),
    );

    const remainingSeatTickets = await phase(
      "Kiểm tra vé còn tham chiếu đến ghế benchmark",
      () =>
        client.query(`
      SELECT count(*)::bigint AS remaining
      FROM tickets t
      JOIN seats s ON s.seat_id = t.seat_id
      JOIN zones z ON z.zone_id = s.zone_id
      WHERE z.name = 'BENCHMARK'
    `),
    );
    const remaining = Number(remainingSeatTickets.rows[0].remaining);
    if (remaining !== 0) {
      throw new Error(
        `Còn ${remaining.toLocaleString("en-US")} tickets tham chiếu đến ghế BENCHMARK sau bước xóa tickets. Dừng để bảo vệ Foreign Key; transaction sẽ rollback.`,
      );
    }

    // Delete seats explicitly so the potentially expensive FK-check step is
    // visible in the log instead of being hidden inside ON DELETE CASCADE.
    await phase("Xóa seats benchmark (FK check qua tickets.seat_id)", () =>
      client.query(`
      DELETE FROM seats s
      USING zones z
      WHERE s.zone_id = z.zone_id
        AND z.name = 'BENCHMARK'
    `),
    );

    await phase("Xóa zones benchmark", () =>
      client.query("DELETE FROM zones WHERE name = 'BENCHMARK'"),
    );

    await phase("Xóa events benchmark phụ", () =>
      client.query(
        "DELETE FROM events WHERE title LIKE 'Index Benchmark Event %'",
      ),
    );

    await phase("Xóa users benchmark", () =>
      client.query("DELETE FROM users WHERE email LIKE $1", [
        BENCHMARK_EMAIL_PATTERN,
      ]),
    );

    await phase("Khôi phục giới hạn vé cho 7 Event gốc", () =>
      client.query(
        "UPDATE events SET max_tickets_per_user = 4 WHERE event_id = ANY($1::bigint[])",
        [BASE_EVENT_IDS],
      ),
    );
  }

  await phase("Tạo 18 sự kiện benchmark phụ", async () => {
    await client.query(
      `
      INSERT INTO events (
        title, genre_id, venue_id, event_date, sale_open_at,
        max_tickets_per_user, status
      )
      SELECT
        'Index Benchmark Event ' || lpad(g.n::text, 2, '0'),
        (SELECT genre_id FROM genres ORDER BY genre_id
          OFFSET ((g.n - 1) % (SELECT count(*) FROM genres)) LIMIT 1),
        (SELECT venue_id FROM venues ORDER BY venue_id
          OFFSET ((g.n - 1) % (SELECT count(*) FROM venues)) LIMIT 1),
        now() + make_interval(days => 90 + g.n),
        now() - interval '30 days',
        10,
        'ON_SALE'::event_status
      FROM generate_series(1, $1::int) AS g(n)
    `,
      [EXTRA_EVENT_COUNT],
    );
  });

  const eventResult = await client.query(
    `
    SELECT event_id
    FROM events
    WHERE event_id = ANY($1::bigint[])
       OR title LIKE 'Index Benchmark Event %'
    ORDER BY event_id
  `,
    [BASE_EVENT_IDS],
  );
  const eventIds = eventResult.rows.map((row) => Number(row.event_id));
  if (
    eventIds.length !== EVENT_COUNT ||
    !eventIds.includes(2) ||
    !eventIds.includes(3)
  ) {
    throw new Error(
      `Không xác định được đúng ${EVENT_COUNT} sự kiện benchmark (có Event 2 và Event 3).`,
    );
  }

  const baseCount = Math.floor(TOTAL_TICKETS / EVENT_COUNT);
  const remainder = TOTAL_TICKETS % EVENT_COUNT;
  const ticketCounts = eventIds.map(
    (eventId, index) => baseCount + (index < remainder ? 1 : 0),
  );

  await phase("Chuẩn bị sự kiện và vùng ghế", async () => {
    await client.query(
      "UPDATE events SET max_tickets_per_user = 10 WHERE event_id = ANY($1::bigint[])",
      [eventIds],
    );
    await client.query(`
      CREATE TEMP TABLE benchmark_zone_map (
        event_id BIGINT PRIMARY KEY,
        zone_id BIGINT NOT NULL UNIQUE,
        ticket_count INTEGER NOT NULL
      ) ON COMMIT DROP
    `);
    await client.query(
      `
      WITH requested AS (
        SELECT event_id, ticket_count
        FROM unnest($1::bigint[], $2::int[]) AS x(event_id, ticket_count)
      ), inserted AS (
        INSERT INTO zones (event_id, name, price, capacity)
        SELECT event_id, 'BENCHMARK', $3, ticket_count
        FROM requested
        RETURNING event_id, zone_id
      )
      INSERT INTO benchmark_zone_map(event_id, zone_id, ticket_count)
      SELECT i.event_id, i.zone_id, r.ticket_count
      FROM inserted i
      JOIN requested r USING (event_id)
    `,
      [eventIds, ticketCounts, TICKET_PRICE],
    );
  });

  await phase("Tạo ghế benchmark", async () => {
    await client.query(`
      CREATE TEMP TABLE benchmark_seat_map (
        event_id BIGINT NOT NULL,
        seq INTEGER NOT NULL,
        seat_id BIGINT NOT NULL UNIQUE,
        PRIMARY KEY (event_id, seq)
      ) ON COMMIT DROP
    `);
    await client.query(`
      WITH source AS (
        SELECT z.event_id, z.zone_id, g.n
        FROM benchmark_zone_map z
        CROSS JOIN LATERAL generate_series(1, z.ticket_count) AS g(n)
      ), inserted AS (
        INSERT INTO seats (zone_id, row_label, seat_no)
        SELECT
          zone_id,
          lpad(((n - 1) / 100)::text, 5, '0'),
          (((n - 1) % 100) + 1)::smallint
        FROM source
        ORDER BY event_id, n
        RETURNING seat_id, zone_id, row_label, seat_no
      )
      INSERT INTO benchmark_seat_map(event_id, seq, seat_id)
      SELECT
        z.event_id,
        (i.row_label::integer * 100 + i.seat_no)::integer,
        i.seat_id
      FROM inserted i
      JOIN benchmark_zone_map z USING (zone_id)
    `);
  });

  await phase("Tạo người dùng benchmark", async () => {
    await client.query(`
      CREATE TEMP TABLE benchmark_user_map (
        event_id BIGINT NOT NULL,
        order_no INTEGER NOT NULL,
        user_id BIGINT NOT NULL UNIQUE,
        PRIMARY KEY (event_id, order_no)
      ) ON COMMIT DROP
    `);
    await client.query(
      `
      WITH raw_users AS MATERIALIZED (
        SELECT z.event_id, g.order_no
        FROM benchmark_zone_map z
        CROSS JOIN LATERAL generate_series(1, ((z.ticket_count + $2::int - 1) / $2::int)) AS g(order_no)
      ), source_users AS MATERIALIZED (
        SELECT
          event_id,
          order_no,
          row_number() OVER (ORDER BY event_id, order_no) AS user_seq,
          format('bench.%s.e%s.o%s@benchmark.ticketrush.local', $1::text, event_id, order_no) AS email
        FROM raw_users
      ), inserted AS (
        INSERT INTO users (email, phone, full_name, password_hash, role)
        SELECT
          email,
          '09' || lpad(user_seq::text, 8, '0'),
          'Benchmark Customer ' || user_seq::text,
          'benchmark-only-not-for-login',
          'CUSTOMER'::user_role
        FROM source_users
        ORDER BY event_id, order_no
        RETURNING user_id, email
      )
      INSERT INTO benchmark_user_map(event_id, order_no, user_id)
      SELECT s.event_id, s.order_no, i.user_id
      FROM source_users s
      JOIN inserted i USING (email)
    `,
      [runTag, TICKETS_PER_ORDER],
    );
  });

  await phase("Tạo orders benchmark", async () => {
    await client.query(`
      CREATE TEMP TABLE benchmark_order_map (
        event_id BIGINT NOT NULL,
        order_no INTEGER NOT NULL,
        order_id BIGINT NOT NULL UNIQUE,
        PRIMARY KEY (event_id, order_no)
      ) ON COMMIT DROP
    `);
    await client.query(`
      WITH inserted AS (
        INSERT INTO orders (user_id, event_id, total, status, created_at, expires_at)
        SELECT
          user_id,
          event_id,
          0,
          'PAID'::order_status,
          now() - interval '7 days',
          now() - interval '7 days' + interval '10 minutes'
        FROM benchmark_user_map
        RETURNING order_id, user_id, event_id
      )
      INSERT INTO benchmark_order_map(event_id, order_no, order_id)
      SELECT i.event_id, u.order_no, i.order_id
      FROM inserted i
      JOIN benchmark_user_map u USING (event_id, user_id)
    `);
  });

  await phase("Tạo tickets benchmark", async () => {
    await client.query(
      `
      INSERT INTO tickets (order_id, seat_id, price, status, checked_in_at)
      SELECT
        o.order_id,
        s.seat_id,
        $1,
        CASE
          WHEN ((s.seq * 37 + s.event_id * 13 + $2::bigint) % 100) < 90
            THEN 'VALID'::ticket_status
          ELSE 'CHECKED_IN'::ticket_status
        END,
        CASE
          WHEN ((s.seq * 37 + s.event_id * 13 + $2::bigint) % 100) < 90
            THEN NULL
          ELSE now() - make_interval(mins => ((s.seq * 7) % 1440) + 1)
        END
      FROM benchmark_seat_map s
      JOIN benchmark_order_map o
        ON o.event_id = s.event_id
       AND o.order_no = ((s.seq - 1) / $3) + 1
      ORDER BY s.event_id, s.seq
    `,
      [TICKET_PRICE, SEED, TICKETS_PER_ORDER],
    );
  });

  await phase("Cập nhật trạng thái ghế, tổng tiền và payment", async () => {
    await client.query(`
      UPDATE seats s
      SET status = 'SOLD'::seat_status
      FROM benchmark_seat_map m
      WHERE s.seat_id = m.seat_id
    `);
    await client.query(
      `
      UPDATE orders o
      SET total = t.ticket_count * $1
      FROM (
        SELECT t.order_id, count(*)::bigint AS ticket_count
        FROM tickets t
        JOIN benchmark_order_map m USING (order_id)
        GROUP BY t.order_id
      ) t
      WHERE o.order_id = t.order_id
    `,
      [TICKET_PRICE],
    );
    await client.query(`
      INSERT INTO payments (order_id, amount, method, status, paid_at)
      SELECT o.order_id, o.total, 'CARD'::payment_method,
             'SUCCESS'::payment_status, now() - interval '7 days'
      FROM orders o
      JOIN benchmark_order_map m USING (order_id)
    `);
  });

  await phase("Cập nhật thống kê PostgreSQL (ANALYZE)", async () => {
    await client.query("ANALYZE events");
    await client.query("ANALYZE zones");
    await client.query("ANALYZE seats");
    await client.query("ANALYZE users");
    await client.query("ANALYZE orders");
    await client.query("ANALYZE tickets");
    await client.query("ANALYZE payments");
  });

  const summary = await client.query(`
    SELECT
      count(*)::bigint AS tickets,
      count(*) FILTER (WHERE t.status = 'VALID')::bigint AS valid_tickets,
      count(*) FILTER (WHERE t.status = 'CHECKED_IN')::bigint AS checked_in_tickets,
      count(DISTINCT t.order_id)::bigint AS orders
    FROM tickets t
    JOIN benchmark_order_map m USING (order_id)
  `);
  const perEvent = await client.query(`
    SELECT
      m.event_id,
      e.title,
      count(*)::bigint AS tickets,
      count(*) FILTER (WHERE t.status = 'VALID')::bigint AS valid_tickets,
      count(*) FILTER (WHERE t.status = 'CHECKED_IN')::bigint AS checked_in_tickets
    FROM benchmark_order_map m
    JOIN orders o USING (order_id)
    JOIN events e ON e.event_id = m.event_id
    JOIN tickets t USING (order_id)
    GROUP BY m.event_id, e.title
    ORDER BY m.event_id
  `);

  await client.query("COMMIT");
  transactionOpen = false;

  const counts = summary.rows[0];
  console.log("\n✔ Large Seed hoàn tất.");
  console.log(
    `  Tổng thời gian: ${formatDuration(performance.now() - runStartedAt)}`,
  );
  console.log(`  Database: ${databaseName}`);
  console.log(
    `  Benchmark tickets: ${Number(counts.tickets).toLocaleString("en-US")}`,
  );
  console.log(
    `  VALID: ${Number(counts.valid_tickets).toLocaleString("en-US")}`,
  );
  console.log(
    `  CHECKED_IN: ${Number(counts.checked_in_tickets).toLocaleString("en-US")}`,
  );
  console.log(
    `  Benchmark orders: ${Number(counts.orders).toLocaleString("en-US")}`,
  );
  console.log(
    `  Số sự kiện phân bổ: ${perEvent.rows.length} (Event 2 và 3 nằm trong nhóm này)`,
  );
  console.log("\nSố vé theo sự kiện:");
  for (const row of perEvent.rows) {
    console.log(
      `  Event ${row.event_id} · ${row.title}: ${Number(row.tickets).toLocaleString("en-US")} vé (VALID ${Number(row.valid_tickets).toLocaleString("en-US")}, CHECKED_IN ${Number(row.checked_in_tickets).toLocaleString("en-US")})`,
    );
  }
} catch (error) {
  if (client && transactionOpen) {
    try {
      await client.query("ROLLBACK");
      console.log(
        "\n↩ Transaction đã ROLLBACK; các thay đổi trong lần chạy này không được commit.",
      );
    } catch (rollbackError) {
      console.error("\n✘ Không thể xác nhận ROLLBACK:", rollbackError.message);
    }
  }
  console.error("\n✘ Large Seed thất bại:", error.message);
  if (error.code) console.error(`  PostgreSQL code: ${error.code}`);
  if (error.detail) console.error(`  Detail: ${error.detail}`);
  if (error.hint) console.error(`  Hint: ${error.hint}`);
  process.exitCode = 1;
} finally {
  if (client) client.release();
  await pool.end().catch(() => {});
}
