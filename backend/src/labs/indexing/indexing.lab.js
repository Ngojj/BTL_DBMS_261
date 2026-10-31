import { pool } from '../../config/pg.js';
import { firestore } from '../../config/firebase.js';

/**
 * [Indexing Lab]
 * So sánh cơ chế Indexing giữa PostgreSQL và Cloud Firestore.
 * 
 * Thí nghiệm 1: PostgreSQL Index Scan vs Sequential Scan
 * Chạy EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) khi bật index và khi ép tắt indexscan.
 * 
 * Thí nghiệm 2: Firestore Single-field Index vs Composite Index
 * Phân tích cơ chế tự động index của Firestore và chi phí lưu trữ/ghi (write amplification).
 */

export async function comparePostgresIndexing({ userId = 1, eventId = 1, status = 'PAID' } = {}) {
  const client = await pool.connect();
  try {
    // 1. Chạy với Index Scan thông thường (PostgreSQL query optimizer chọn phương án tối ưu)
    await client.query('SET enable_seqscan = off'); // Khuyến khích dùng Index
    const startIdx = performance.now();
    const indexedExplainRes = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT o.order_id, o.user_id, o.event_id, o.total, o.status, o.created_at
         FROM orders o
        WHERE o.user_id = $1 AND o.event_id = $2 AND o.status = $3`,
      [userId, eventId, status]
    );
    const elapsedIndexedMs = +(performance.now() - startIdx).toFixed(2);
    const indexedPlan = indexedExplainRes.rows[0]['QUERY PLAN'][0];

    // 2. Chạy với Sequential Scan (ép tắt indexscan / bitmapscan)
    await client.query('SET enable_seqscan = on');
    await client.query('SET enable_indexscan = off');
    await client.query('SET enable_bitmapscan = off');
    const startSeq = performance.now();
    const seqExplainRes = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT o.order_id, o.user_id, o.event_id, o.total, o.status, o.created_at
         FROM orders o
        WHERE o.user_id = $1 AND o.event_id = $2 AND o.status = $3`,
      [userId, eventId, status]
    );
    const elapsedSeqMs = +(performance.now() - startSeq).toFixed(2);
    const seqPlan = seqExplainRes.rows[0]['QUERY PLAN'][0];

    // Reset lại cấu hình planner
    await client.query('RESET enable_seqscan');
    await client.query('RESET enable_indexscan');
    await client.query('RESET enable_bitmapscan');

    // Lấy thông tin kích thước các index trên bảng orders
    const indexSizesRes = await client.query(
      `SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS size_pretty
         FROM pg_indexes i
         JOIN pg_class c ON c.relname = i.indexname
        WHERE tablename = 'orders'`
    );

    return {
      dbms: 'postgresql',
      scenario: 'Tìm đơn hàng theo user_id, event_id và status',
      withIndex: {
        scanType: indexedPlan.Plan['Node Type'], // vd: Index Scan / Bitmap Index Scan
        executionTimeMs: indexedPlan['Execution Time'],
        planningTimeMs: indexedPlan['Planning Time'],
        totalCost: indexedPlan.Plan['Total Cost'],
        actualRows: indexedPlan.Plan['Actual Rows'],
        sharedHitBlocks: indexedPlan.Plan['Shared Hit Blocks'] || 0,
        sharedReadBlocks: indexedPlan.Plan['Shared Read Blocks'] || 0,
        elapsedWallClockMs: elapsedIndexedMs,
        planDetail: indexedPlan.Plan,
      },
      withoutIndex: {
        scanType: seqPlan.Plan['Node Type'], // Seq Scan
        executionTimeMs: seqPlan['Execution Time'],
        planningTimeMs: seqPlan['Planning Time'],
        totalCost: seqPlan.Plan['Total Cost'],
        actualRows: seqPlan.Plan['Actual Rows'],
        sharedHitBlocks: seqPlan.Plan['Shared Hit Blocks'] || 0,
        sharedReadBlocks: seqPlan.Plan['Shared Read Blocks'] || 0,
        elapsedWallClockMs: elapsedSeqMs,
        planDetail: seqPlan.Plan,
      },
      indexesOnTable: indexSizesRes.rows,
      conclusion: 'Index Scan trực tiếp trỏ đến blocks dữ liệu cần thiết qua B-Tree (idx_orders_user_event), giảm mạnh I/O và Execution Time so với Seq Scan (phải duyệt toàn bộ bảng).',
    };
  } finally {
    client.release();
  }
}

export async function compareFirestoreIndexing({ eventId = '1' } = {}) {
  const start = performance.now();
  let readsCount = 0;
  let docsFound = 0;

  try {
    // 1. Single-field query (Firestore tự động tạo index cho mọi trường đơn)
    const snapshot = await firestore
      .collection('validTickets')
      .where('eventId', '==', String(eventId))
      .limit(50)
      .get();

    readsCount += snapshot.size;
    docsFound = snapshot.size;
    const elapsedMs = +(performance.now() - start).toFixed(2);

    return {
      dbms: 'firestore',
      scenario: 'Truy vấn validTickets theo eventId (Single-field index)',
      readsCount,
      docsFound,
      elapsedMs,
      indexMechanism: {
        singleFieldIndex: 'Mặc định: Tự động đánh index 2 chiều (Ascending & Descending) cho TẤT CẢ các trường trong document.',
        compositeIndex: 'Yêu cầu: Bắt buộc khai báo thủ công trong firestore.indexes.json khi query kết hợp nhiều điều kiện (Equality + Range / Sort).',
        writeCost: 'Write Amplification: Mỗi lần ghi/sửa document, Firestore phải cập nhật N index tương ứng, làm tăng chi phí ghi và độ trễ ghi.',
      },
      conclusion: 'Firestore tối ưu hóa cho reads bằng cách bắt buộc đánh index trước (No full-collection scan cho phép chạy trên quy mô lớn mà không suy giảm tốc độ). Tuy nhiên, thiếu index composite sẽ bị REJECT ngay ở compile-time.',
    };
  } catch (err) {
    return {
      dbms: 'firestore',
      error: err.message,
      elapsedMs: +(performance.now() - start).toFixed(2),
      note: 'Nếu thiếu composite index, Firestore sẽ báo lỗi FAILED_PRECONDITION kèm link tạo index.',
    };
  }
}

