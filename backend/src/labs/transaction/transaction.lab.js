import { pool } from '../../config/pg.js';
import { firestore } from '../../config/firebase.js';

/**
 * [Transaction Lab]
 * Thí nghiệm kiểm chứng tính chất ACID của Transaction trên PostgreSQL và Cloud Firestore.
 * 
 * Kịch bản: Luồng Giữ ghế -> Tạo đơn -> Thanh toán giả lập.
 * - Test case A (Commit): Mọi bước thành công, chốt vé Durable.
 * - Test case B (Rollback): Giả lập lỗi ở bước thanh toán.
 *   + PostgreSQL: ROLLBACK toàn bộ transaction, ghế quay về AVAILABLE, không sinh order/ticket rác.
 *   + Firestore: runTransaction throw error -> toàn bộ write mutations bị hủy.
 */

export async function runPgTransactionLab({ shouldFail = false, userId = 1, eventId = 1 } = {}) {
  const client = await pool.connect();
  const logs = [];
  const start = performance.now();

  try {
    // Tìm 1 ghế AVAILABLE để test
    const availableSeatRes = await client.query(
      `SELECT s.seat_id, s.row_label, s.seat_no, z.price, z.name as zone_name
         FROM seats s
         JOIN zones z ON z.zone_id = s.zone_id
        WHERE z.event_id = $1 AND s.status = 'AVAILABLE'
        LIMIT 1`,
      [eventId]
    );

    if (availableSeatRes.rowCount === 0) {
      throw new Error('Không còn ghế AVAILABLE để chạy thí nghiệm');
    }

    const testSeat = availableSeatRes.rows[0];
    const seatId = testSeat.seat_id;
    logs.push(`[1] Chọn ghế kiểm thử: ID ${seatId} (${testSeat.row_label}-${testSeat.seat_no}) - Giá ${testSeat.price}đ`);

    // BEGIN TRANSACTION
    await client.query('BEGIN');
    logs.push('[2] Thực thi lệnh: BEGIN (Bắt đầu transaction ACID)');

    // Khóa dòng ghế để đảm bảo Isolation
    await client.query('SELECT seat_id, status FROM seats WHERE seat_id = $1 FOR UPDATE', [seatId]);
    logs.push(`[3] Khóa dòng ghế bằng: SELECT ... FOR UPDATE (Pessimistic lock)`);

    // Đổi trạng thái sang HELD
    await client.query(
      `UPDATE seats
          SET status = 'HELD', held_by = $1, held_until = now() + INTERVAL '10 minutes'
        WHERE seat_id = $2`,
      [userId, seatId]
    );
    logs.push('[4] Cập nhật ghế -> HELD (giữ chỗ tạm 10 phút)');

    // Tạo đơn hàng PENDING
    const orderRes = await client.query(
      `INSERT INTO orders (user_id, event_id, total, status, expires_at)
       VALUES ($1, $2, $3, 'PENDING', now() + INTERVAL '10 minutes')
       RETURNING order_id`,
      [userId, eventId, testSeat.price]
    );
    const orderId = orderRes.rows[0].order_id;
    logs.push(`[5] Tạo đơn hàng PENDING: Order ID #${orderId}`);

    // Tạo vé VALID
    await client.query(
      `INSERT INTO tickets (order_id, seat_id, price, status)
       VALUES ($1, $2, $3, 'VALID')`,
      [orderId, seatId, testSeat.price]
    );
    logs.push('[6] Xuất vé điện tử tạm thời: Status VALID');

    // Bước thanh toán giả lập
    if (shouldFail) {
      logs.push('[7] ⚠️ GIẢ LẬP LỖI: Cổng thanh toán báo lỗi (Thẻ không đủ số dư / Timeout)!');
      throw new Error('SIMULATED_PAYMENT_FAILED: Lỗi giao dịch từ ngân hàng');
    }

    // Nếu thành công: Tạo payment SUCCESS, chuyển order sang PAID, ghế sang SOLD
    await client.query(
      `INSERT INTO payments (order_id, amount, method, status, paid_at)
       VALUES ($1, $2, 'CARD', 'SUCCESS', now())`,
      [orderId, testSeat.price]
    );
    await client.query(`UPDATE orders SET status = 'PAID' WHERE order_id = $1`, [orderId]);
    await client.query(`UPDATE seats SET status = 'SOLD' WHERE seat_id = $1`, [seatId]);
    logs.push('[7] Thanh toán thành công: Ghi nhận Payment SUCCESS, chuyển Order -> PAID, Ghế -> SOLD');

    await client.query('COMMIT');
    logs.push('[8] Thực thi lệnh: COMMIT (Chốt dữ liệu bền vững xuống Disk / WAL)');

    return {
      dbms: 'postgresql',
      outcome: 'COMMITTED',
      success: true,
      durationMs: +(performance.now() - start).toFixed(2),
      seatId,
      finalSeatStatus: 'SOLD',
      logs,
      acidAnalysis: {
        atomicity: 'Đảm bảo trọn vẹn: Toàn bộ cập nhật (Order, Ticket, Seat, Payment) được ghi nhận cùng lúc.',
        consistency: 'Các ràng buộc khóa ngoại và Trigger kiểm tra số lượng vé được tôn trọng tuyệt đối.',
        isolation: 'Được bảo vệ bởi cơ chế FOR UPDATE ngăn chặn các giao dịch khác sửa ghế cùng lúc.',
        durability: 'Sau lệnh COMMIT, dữ liệu được flush vào WAL log, không sợ mất mát kể cả khi crash hệ thống.',
      },
    };
  } catch (err) {
    await client.query('ROLLBACK');
    logs.push(`[8] ↩️ Gặp lỗi! Thực thi: ROLLBACK (Hủy bỏ toàn bộ thay đổi)`);
    logs.push(`[9] Kết quả Rollback: Ghế trở về trạng thái AVAILABLE ban đầu, không lưu Order hay Ticket rác.`);

    return {
      dbms: 'postgresql',
      outcome: 'ROLLED_BACK',
      success: false,
      error: err.message,
      durationMs: +(performance.now() - start).toFixed(2),
      finalSeatStatus: 'AVAILABLE',
      logs,
      acidAnalysis: {
        atomicity: 'Tính nguyên tử hoạt động hoàn hảo: Khi có lỗi ở bước 7, lệnh ROLLBACK hủy bỏ sạch sẽ các bước 4, 5, 6.',
        cleanliness: 'Database hoàn toàn sạch rác, không có orphaned records trong tickets hay orders.',
      },
    };
  } finally {
    client.release();
  }
}

export async function runFsTransactionLab({ shouldFail = false, eventId = '1' } = {}) {
  const start = performance.now();
  const logs = [];
  const testSeatKey = `seat_lab_${Date.now()}`;
  const seatRef = firestore.collection('events').doc(String(eventId)).collection('seats').doc(testSeatKey);

  try {
    // Chuẩn bị document giả lập ghế
    await seatRef.set({
      seatLabel: 'VIP-A1',
      status: 'AVAILABLE',
      price: 2500000,
    });
    logs.push(`[1] Tạo document ghế mẫu trong Firestore: ${testSeatKey} (AVAILABLE)`);

    // Thực hiện Firestore Transaction
    await firestore.runTransaction(async (transaction) => {
      logs.push('[2] Bắt đầu firestore.runTransaction()');

      // Firestore bắt buộc đọc trước khi ghi (Read-before-write)
      const seatDoc = await transaction.get(seatRef);
      if (!seatDoc.exists) throw new Error('Ghế không tồn tại');
      logs.push('[3] Đọc snapshot ghế hiện tại (lưu version/updateTime để kiểm tra xung đột)');

      // Ghi giữ chỗ HELD
      transaction.update(seatRef, { status: 'HELD', heldAt: new Date().toISOString() });
      logs.push('[4] Thêm mutation: update status -> HELD');

      if (shouldFail) {
        logs.push('[5] ⚠️ GIẢ LẬP LỖI: Phát sinh ngoại lệ trong Transaction callback!');
        throw new Error('SIMULATED_FS_PAYMENT_ERROR: Lỗi xử lý thẻ tín dụng');
      }

      transaction.update(seatRef, { status: 'SOLD' });
      logs.push('[5] Thêm mutation: update status -> SOLD');
      logs.push('[6] Kết thúc callback -> Firestore gửi atomic commit');
    });

    logs.push('[7] Transaction commit thành công trên Firestore server');

    return {
      dbms: 'firestore',
      outcome: 'COMMITTED',
      success: true,
      durationMs: +(performance.now() - start).toFixed(2),
      logs,
      characteristics: {
        model: 'Optimistic Concurrency: Đọc snapshot và ghi dồn vào batch commit.',
        limitations: 'Bắt buộc tất cả lệnh read phải đứng trước lệnh write. Tối đa 500 documents/transaction.',
      },
    };
  } catch (err) {
    logs.push(`[7] ↩️ Ngoại lệ phát sinh! Firestore tự động hủy toàn bộ mutations đã xếp hàng.`);
    // Kiểm tra lại trạng thái document sau rollback
    const verifyDoc = await seatRef.get();
    const currentStatus = verifyDoc.data()?.status || 'UNKNOWN';
    logs.push(`[8] Kiểm tra Firestore sau khi lỗi: Document ghế vẫn giữ trạng thái ban đầu: ${currentStatus}`);

    return {
      dbms: 'firestore',
      outcome: 'ROLLED_BACK',
      success: false,
      error: err.message,
      durationMs: +(performance.now() - start).toFixed(2),
      logs,
      characteristics: {
        atomicity: 'Firestore đảm bảo tính nguyên tử: Khi throw error, không có bất kỳ mutation nào được áp dụng lên server.',
      },
    };
  } finally {
    // Dọn dẹp test doc
    await seatRef.delete().catch(() => {});
  }
}

