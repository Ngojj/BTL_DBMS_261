/**
 * scripts/load-test.js – Kiểm thử tải giả lập "Giờ G" (Tuần 45)
 * Chạy: node scripts/load-test.js --concurrency 30 --seats 5
 *
 * Kiểm tra:
 * - Khả năng chịu tải đồng thời của cơ chế khóa (FOR UPDATE) trong PostgreSQL
 * - Đo tỷ lệ thành công, từ chối an toàn
 * - Khẳng định: Số vé bán trùng (Overbooking) = 0
 * - Đo độ trễ (Latency P50, P90, P99, Throughput req/s)
 */

import { pool } from '../backend/src/config/pg.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a, i, arr) =>
    a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : []
  ).filter((x) => x.length)
);

const CONCURRENCY = Number(args.concurrency || args.users || 20);
const SEATS_COUNT = Number(args.seats || 4);
const EVENT_ID = Number(args.event || 1);

async function setupTestSeats(count) {
  const client = await pool.connect();
  try {
    const zoneRes = await client.query('SELECT zone_id FROM zones WHERE event_id = $1 LIMIT 1', [EVENT_ID]);
    if (zoneRes.rowCount === 0) {
      throw new Error(`Không tìm thấy zone nào cho event_id = ${EVENT_ID}`);
    }
    const zoneId = zoneRes.rows[0].zone_id;
    const seatIds = [];

    for (let i = 1; i <= count; i++) {
      const res = await client.query(
        `INSERT INTO seats (zone_id, row_label, seat_no, status)
         VALUES ($1, 'LT', $2, 'AVAILABLE')
         ON CONFLICT (zone_id, row_label, seat_no)
         DO UPDATE SET status = 'AVAILABLE', held_by = NULL, held_until = NULL
         RETURNING seat_id`,
        [zoneId, 8000 + i]
      );
      seatIds.push(res.rows[0].seat_id);
    }
    return { zoneId, seatIds };
  } finally {
    client.release();
  }
}

async function cleanupTestSeats(seatIds) {
  if (!seatIds?.length) return;
  await pool.query('DELETE FROM seats WHERE seat_id = ANY($1)', [seatIds]).catch(() => {});
}

async function simulateBookingAttempt(userId, seatIds) {
  const client = await pool.connect();
  const start = performance.now();
  try {
    await client.query('BEGIN');

    // Khóa dòng nghiêm ngặt bằng SELECT FOR UPDATE SKIP LOCKED
    const lockRes = await client.query(
      `SELECT seat_id, zone_id FROM seats
        WHERE seat_id = ANY($1) AND status = 'AVAILABLE'
        ORDER BY seat_id
        FOR UPDATE SKIP LOCKED
        LIMIT 1`,
      [seatIds]
    );

    if (lockRes.rowCount === 0) {
      await client.query('ROLLBACK');
      const elapsed = performance.now() - start;
      return { success: false, reason: 'SOLD_OUT', latencyMs: elapsed };
    }

    const seatId = lockRes.rows[0].seat_id;

    // Giả lập giữ ghế & chốt bán
    await client.query(
      `UPDATE seats SET status = 'SOLD', held_by = $1, held_until = NULL WHERE seat_id = $2`,
      [userId, seatId]
    );

    await client.query('COMMIT');
    const elapsed = performance.now() - start;
    return { success: true, seatId, latencyMs: elapsed };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    return { success: false, error: err.message, latencyMs: performance.now() - start };
  } finally {
    client.release();
  }
}

async function runLoadTest() {
  console.log(`\n======================================================`);
  console.log(`🚀 TICKETRUSH LOAD TEST – KIỂM THỬ TẢI GIỜ G (Tuần 45)`);
  console.log(`======================================================`);
  console.log(`- Số yêu cầu đồng thời (Concurrency): ${CONCURRENCY} luồng`);
  console.log(`- Số lượng ghế mở bán:                ${SEATS_COUNT} ghế`);
  console.log(`- Mã sự kiện (Event ID):               #${EVENT_ID}`);
  console.log(`- Khởi tạo dữ liệu kiểm thử...`);

  const { seatIds } = await setupTestSeats(SEATS_COUNT);
  console.log(`✓ Đã tạo ${seatIds.length} ghế AVAILABLE (ID: ${seatIds.join(', ')})`);
  console.log(`\n⚡ Bắt đầu bắn ${CONCURRENCY} requests đồng thời...\n`);

  const startTime = performance.now();
  const promises = Array.from({ length: CONCURRENCY }, (_, i) =>
    simulateBookingAttempt(1, seatIds)
  );

  const results = await Promise.all(promises);
  const totalDurationMs = performance.now() - startTime;

  // Thống kê kết quả
  const successful = results.filter((r) => r.success);
  const rejected = results.filter((r) => !r.success);

  // Kiểm tra bán trùng (Double booking check)
  const seatPurchases = {};
  successful.forEach((s) => {
    seatPurchases[s.seatId] = (seatPurchases[s.seatId] || 0) + 1;
  });

  const oversoldSeats = Object.entries(seatPurchases).filter(([, count]) => count > 1);

  // Latencies
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)]?.toFixed(1);
  const p90 = latencies[Math.floor(latencies.length * 0.9)]?.toFixed(1);
  const p99 = latencies[Math.floor(latencies.length * 0.99)]?.toFixed(1);
  const avg = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1);
  const rps = ((CONCURRENCY / totalDurationMs) * 1000).toFixed(1);

  console.log(`---------------- KẾT QUẢ KIỂM THỬ TẢI ----------------`);
  console.log(`Tổng thời gian thực thi: ${totalDurationMs.toFixed(1)} ms`);
  console.log(`Throughput:               ${rps} requests/second`);
  console.log(`Số yêu cầu thành công:   ${successful.length} / ${SEATS_COUNT} ghế`);
  console.log(`Số yêu cầu bị từ chối:   ${rejected.length} (hết vé an toàn)`);
  console.log(`Số vé bán trùng:          ${oversoldSeats.length} (KỲ VỌNG: 0)`);
  console.log(`\nĐộ trễ phản hồi (Latency):`);
  console.log(`- Trung bình: ${avg} ms`);
  console.log(`- P50:        ${p50} ms`);
  console.log(`- P90:        ${p90} ms`);
  console.log(`- P99:        ${p99} ms`);

  if (oversoldSeats.length === 0 && successful.length === SEATS_COUNT) {
    console.log(`\n✅ ĐẠT YÊU CẦU: Hệ thống hoạt động hoàn hảo dưới tải đồng thời cao! Không có ghế nào bị bán trùng.`);
  } else if (oversoldSeats.length > 0) {
    console.log(`\n❌ THẤT BẠI: Phát hiện bán trùng ghế!`, oversoldSeats);
  } else {
    console.log(`\n⚠️ Số vé bán ra (${successful.length}) khác với số ghế (${SEATS_COUNT}).`);
  }
  console.log(`======================================================\n`);

  await cleanupTestSeats(seatIds);
  await pool.end();
}

runLoadTest().catch((err) => {
  console.error('Lỗi chạy load-test:', err.message);
  process.exit(1);
});

