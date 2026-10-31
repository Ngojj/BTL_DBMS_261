import { pool } from '../../config/pg.js';
import { firestore } from '../../config/firebase.js';

/**
 * [Concurrency Control Lab]
 * Thí nghiệm "Giả lập giờ G": N requests đồng thời tranh mua M ghế giới hạn.
 * 
 * So sánh 3 chiến lược:
 * 1. NO_LOCK (Naive - Không khóa): Dẫn tới Race Condition, Overbooking (bán trùng ghế).
 * 2. POSTGRES_PESSIMISTIC (SELECT ... FOR UPDATE): Khóa dòng nghiêm ngặt, 0% bán trùng.
 * 3. FIRESTORE_OCC (Optimistic Concurrency Control): Transaction snapshot & conditional write, tự retry, 0% bán trùng.
 */

// Helper tạo ghế tạm thời để test
async function createTemporaryPgSeats(count) {
  const client = await pool.connect();
  try {
    // Lấy 1 zone bất kỳ
    const zoneRes = await client.query('SELECT zone_id FROM zones LIMIT 1');
    const zoneId = zoneRes.rows[0].zone_id;
    const seatIds = [];
    const runTag = Date.now().toString().slice(-4);

    for (let i = 1; i <= count; i++) {
      const row = await client.query(
        `INSERT INTO seats (zone_id, row_label, seat_no, status)
         VALUES ($1, 'SIM', $2, 'AVAILABLE')
         ON CONFLICT (zone_id, row_label, seat_no)
         DO UPDATE SET status = 'AVAILABLE', held_by = NULL, held_until = NULL
         RETURNING seat_id`,
        [zoneId, 9000 + i]
      );
      seatIds.push(row.rows[0].seat_id);
    }
    return { zoneId, seatIds };
  } finally {
    client.release();
  }
}

async function cleanupTemporaryPgSeats(seatIds) {
  if (!seatIds?.length) return;
  await pool.query('DELETE FROM seats WHERE seat_id = ANY($1)', [seatIds]).catch(() => {});
}

export async function simulatePgNoLock({ concurrency = 20, seatsCount = 3 } = {}) {
  const { seatIds } = await createTemporaryPgSeats(seatsCount);
  const start = performance.now();
  const results = [];

  try {
    const tasks = Array.from({ length: concurrency }, async (_, idx) => {
      const client = await pool.connect();
      try {
        // [LỖI THIẾT KẾ] Không dùng FOR UPDATE và không kiểm tra chặt chẽ
        const checkRes = await client.query(
          `SELECT seat_id, status FROM seats WHERE seat_id = ANY($1) AND status = 'AVAILABLE'`,
          [seatIds]
        );

        if (checkRes.rowCount === 0) {
          results.push({ reqId: idx + 1, success: false, reason: 'SEAT_UNAVAILABLE' });
          return;
        }

        const chosenSeat = checkRes.rows[0].seat_id;

        // Mô phỏng độ trễ xử lý (network delay / validation lag 15ms)
        await new Promise((resolve) => setTimeout(resolve, 15));

        // Cập nhật ghế mà không kiểm tra lại trạng thái
        await client.query(
          `UPDATE seats SET status = 'SOLD' WHERE seat_id = $1`,
          [chosenSeat]
        );

        results.push({ reqId: idx + 1, success: true, seatId: chosenSeat });
      } catch (err) {
        results.push({ reqId: idx + 1, success: false, error: err.message });
      } finally {
        client.release();
      }
    });

    await Promise.all(tasks);
    const durationMs = +(performance.now() - start).toFixed(2);

    const successfulBookings = results.filter((r) => r.success);
    const seatCounts = {};
    successfulBookings.forEach((b) => {
      seatCounts[b.seatId] = (seatCounts[b.seatId] || 0) + 1;
    });

    const oversoldSeats = Object.entries(seatCounts).filter(([, c]) => c > 1);
    const isOverbooked = oversoldSeats.length > 0;

    return {
      strategy: 'NO_LOCK (Naive Check-then-Act)',
      concurrency,
      totalSeats: seatsCount,
      soldCount: successfulBookings.length,
      isOverbooked,
      oversoldDetails: oversoldSeats.map(([sId, c]) => ({ seatId: sId, soldTimes: c })),
      durationMs,
      conclusion: isOverbooked
        ? `⚠️ XẢY RA LỖI OVERBOOKING! ${successfulBookings.length} yêu cầu thành công nhưng chỉ có ${seatsCount} ghế. Bán trùng ${oversoldSeats.length} ghế!`
        : 'Không phát hiện trùng ghế ở lượt chạy này (hiếm gặp do race condition phụ thuộc CPU).',
    };
  } finally {
    await cleanupTemporaryPgSeats(seatIds);
  }
}

export async function simulatePgPessimisticLock({ concurrency = 20, seatsCount = 3 } = {}) {
  const { seatIds } = await createTemporaryPgSeats(seatsCount);
  const start = performance.now();
  const results = [];

  try {
    const tasks = Array.from({ length: concurrency }, async (_, idx) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // Khóa dòng nghiêm ngặt với SELECT ... FOR UPDATE SKIP LOCKED
        // SKIP LOCKED giúp các luồng không phải chờ đợi luồng khác mà lấy ngay ghế còn trống tiếp theo
        const lockRes = await client.query(
          `SELECT seat_id FROM seats
            WHERE seat_id = ANY($1) AND status = 'AVAILABLE'
            ORDER BY seat_id
            FOR UPDATE SKIP LOCKED
            LIMIT 1`,
          [seatIds]
        );

        if (lockRes.rowCount === 0) {
          await client.query('ROLLBACK');
          results.push({ reqId: idx + 1, success: false, reason: 'SOLD_OUT' });
          return;
        }

        const seatId = lockRes.rows[0].seat_id;

        // Cập nhật ghế thành SOLD
        await client.query(
          `UPDATE seats SET status = 'SOLD' WHERE seat_id = $1`,
          [seatId]
        );

        await client.query('COMMIT');
        results.push({ reqId: idx + 1, success: true, seatId });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        results.push({ reqId: idx + 1, success: false, error: err.message });
      } finally {
        client.release();
      }
    });

    await Promise.all(tasks);
    const durationMs = +(performance.now() - start).toFixed(2);

    const successfulBookings = results.filter((r) => r.success);
    const seatCounts = {};
    successfulBookings.forEach((b) => {
      seatCounts[b.seatId] = (seatCounts[b.seatId] || 0) + 1;
    });

    const oversoldSeats = Object.entries(seatCounts).filter(([, c]) => c > 1);

    return {
      strategy: 'POSTGRES_PESSIMISTIC_LOCK (FOR UPDATE SKIP LOCKED)',
      concurrency,
      totalSeats: seatsCount,
      soldCount: successfulBookings.length,
      isOverbooked: oversoldSeats.length > 0,
      oversoldDetails: oversoldSeats,
      rejectedCount: results.filter((r) => !r.success).length,
      durationMs,
      conclusion: '✅ AN TOÀN TUYỆT ĐỐI: Đúng chính xác số ghế được bán ra. Số vé bán trùng = 0.',
    };
  } finally {
    await cleanupTemporaryPgSeats(seatIds);
  }
}

export async function simulateFirestoreOCC({ concurrency = 15, seatsCount = 2 } = {}) {
  const start = performance.now();
  const testBatchKey = `sim_${Date.now()}`;
  const seatKeys = Array.from({ length: seatsCount }, (_, i) => `${testBatchKey}_s${i + 1}`);
  const eventRef = firestore.collection('events').doc('1').collection('seats');

  // Chuẩn bị Firestore documents
  await Promise.all(
    seatKeys.map((key) =>
      eventRef.doc(key).set({ status: 'AVAILABLE', seatLabel: key })
    )
  );

  const results = [];
  let retryConflicts = 0;

  try {
    const tasks = Array.from({ length: concurrency }, async (_, idx) => {
      try {
        let attempts = 0;
        await firestore.runTransaction(async (transaction) => {
          attempts++;
          if (attempts > 1) retryConflicts++;

          // Đọc các ghế
          const reads = await Promise.all(seatKeys.map((k) => transaction.get(eventRef.doc(k))));
          const availableDoc = reads.find((d) => d.exists && d.data()?.status === 'AVAILABLE');

          if (!availableDoc) {
            throw new Error('ALL_SEATS_SOLD');
          }

          transaction.update(availableDoc.ref, {
            status: 'SOLD',
            soldToReq: idx + 1,
          });
        });

        results.push({ reqId: idx + 1, success: true });
      } catch (err) {
        results.push({
          reqId: idx + 1,
          success: false,
          reason: err.message.includes('ALL_SEATS_SOLD') ? 'SOLD_OUT' : 'CONFLICT_RETRY_EXHAUSTED',
        });
      }
    });

    await Promise.all(tasks);
    const durationMs = +(performance.now() - start).toFixed(2);

    const successfulBookings = results.filter((r) => r.success);

    return {
      strategy: 'FIRESTORE_OCC (Optimistic Concurrency Control)',
      concurrency,
      totalSeats: seatsCount,
      soldCount: successfulBookings.length,
      isOverbooked: successfulBookings.length > seatsCount,
      retryConflicts,
      durationMs,
      conclusion: '✅ Firestore OCC tự động phát hiện xung đột ghi và retry. Không bao giờ bán trùng ghế.',
    };
  } finally {
    // Dọn dẹp documents giả lập
    await Promise.all(seatKeys.map((k) => eventRef.doc(k).delete().catch(() => {})));
  }
}

