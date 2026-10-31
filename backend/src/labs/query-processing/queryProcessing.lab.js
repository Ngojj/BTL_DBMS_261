import { pool } from '../../config/pg.js';
import { firestore } from '../../config/firebase.js';

/**
 * [Query Processing Lab]
 * So sánh xử lý truy vấn phức tạp (Báo cáo doanh thu theo khu vực: JOIN + GROUP BY + HAVING).
 * 
 * PostgreSQL: Thực thi tại Database Engine với Query Optimizer (Hash Join / HashAggregate).
 * Firestore: Không hỗ trợ JOIN/GROUP BY liên collection -> Client-side / App-level In-Memory Aggregation.
 */

export async function pgRevenueReport() {
  const client = await pool.connect();
  const start = performance.now();
  try {
    const explainRes = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
       SELECT z.zone_id, z.name AS zone_name, e.title AS event_title,
              COUNT(t.ticket_id)::int AS tickets_sold,
              COALESCE(SUM(t.price), 0)::numeric AS total_revenue,
              ROUND(COALESCE(AVG(t.price), 0), 0)::numeric AS avg_price
         FROM zones z
         JOIN events e ON e.event_id = z.event_id
         LEFT JOIN seats s ON s.zone_id = z.zone_id
         LEFT JOIN tickets t ON t.seat_id = s.seat_id AND t.status <> 'CANCELLED'
        GROUP BY z.zone_id, z.name, e.title
       HAVING COUNT(t.ticket_id) >= 0
        ORDER BY total_revenue DESC`
    );

    const queryRes = await client.query(
      `SELECT z.zone_id, z.name AS zone_name, e.title AS event_title,
              COUNT(t.ticket_id)::int AS tickets_sold,
              COALESCE(SUM(t.price), 0)::numeric AS total_revenue,
              ROUND(COALESCE(AVG(t.price), 0), 0)::numeric AS avg_price
         FROM zones z
         JOIN events e ON e.event_id = z.event_id
         LEFT JOIN seats s ON s.zone_id = z.zone_id
         LEFT JOIN tickets t ON t.seat_id = s.seat_id AND t.status <> 'CANCELLED'
        GROUP BY z.zone_id, z.name, e.title
       HAVING COUNT(t.ticket_id) >= 0
        ORDER BY total_revenue DESC`
    );

    const elapsedWallClockMs = +(performance.now() - start).toFixed(2);
    const plan = explainRes.rows[0]['QUERY PLAN'][0];

    return {
      dbms: 'postgresql',
      strategy: 'Database Engine Optimization (Hash Join + HashAggregate)',
      rowCount: queryRes.rowCount,
      executionTimeMs: plan['Execution Time'],
      planningTimeMs: plan['Planning Time'],
      elapsedWallClockMs,
      sharedHitBlocks: plan.Plan['Shared Hit Blocks'] || 0,
      sharedReadBlocks: plan.Plan['Shared Read Blocks'] || 0,
      queryPlanNodes: [
        plan.Plan['Node Type'],
        ...(plan.Plan.Plans?.map((p) => p['Node Type']) || []),
      ],
      data: queryRes.rows,
      characteristics: {
        pushdown: 'Phép lọc và gom nhóm được đẩy thẳng xuống tầng lưu trữ (Predicate Pushdown).',
        memory: 'Sử dụng work_mem tối ưu trên RAM của PostgreSQL server.',
        network: 'Chỉ truyền dữ liệu đã được tổng hợp (vài chục dòng) qua mạng về client.',
      },
    };
  } finally {
    client.release();
  }
}

export async function fsRevenueReport() {
  const start = performance.now();
  let documentReads = 0;

  // Mô phỏng Firestore: đọc collection events và validTickets để tính toán in-memory
  const eventsSnap = await firestore.collection('events').get();
  documentReads += eventsSnap.size;

  const validTicketsSnap = await firestore.collection('validTickets').get();
  documentReads += validTicketsSnap.size;

  // In-memory aggregation trong Node.js
  const tAggStart = performance.now();
  const eventMap = new Map();
  eventsSnap.forEach((doc) => {
    eventMap.set(doc.id, doc.data());
  });

  const zoneAggregation = {};

  validTicketsSnap.forEach((doc) => {
    const data = doc.data();
    const eventId = String(data.eventId);
    const event = eventMap.get(eventId) || { title: 'Unknown' };
    const zoneName = data.seatLabel ? data.seatLabel.split('-')[0] : 'Standard';
    const key = `${eventId}_${zoneName}`;

    if (!zoneAggregation[key]) {
      zoneAggregation[key] = {
        zoneName,
        eventTitle: event.title || `Event #${eventId}`,
        ticketsSold: 0,
        totalRevenue: 0,
      };
    }
    zoneAggregation[key].ticketsSold += 1;
    // Ước lượng giá vé theo zone
    const price = zoneName === 'VIP' ? 2500000 : 1200000;
    zoneAggregation[key].totalRevenue += price;
  });

  const inMemoryAggregationMs = +(performance.now() - tAggStart).toFixed(2);
  const elapsedWallClockMs = +(performance.now() - start).toFixed(2);

  const reportData = Object.values(zoneAggregation).sort(
    (a, b) => b.totalRevenue - a.totalRevenue
  );

  return {
    dbms: 'firestore',
    strategy: 'Application-level In-Memory Aggregation (No native JOIN/GROUP BY)',
    documentReads,
    inMemoryAggregationMs,
    elapsedWallClockMs,
    estimatedCostUsd: +(documentReads * 0.0000006).toFixed(6),
    data: reportData,
    characteristics: {
      pushdown: 'Không hỗ trợ: Phải kéo toàn bộ document thô về tầng ứng dụng (App server).',
      memory: 'Tốn RAM của Node.js để chứa hàng nghìn document và chạy vòng lặp gom nhóm.',
      network: 'Băng thông truyền tải rất lớn do phải download toàn bộ document thay vì chỉ tải kết quả tổng hợp.',
    },
    conclusion: 'PostgreSQL vượt trội trong các nghiệp vụ OLAP / Reporting nhờ Query Optimizer và Index Join. Firestore chỉ phù hợp cho OLTP / Realtime theo Key-Value hoặc Single Collection.',
  };
}

