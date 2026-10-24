import { pool, withTransaction } from '../../config/pg.js';
import { AppError } from '../../utils/AppError.js';

// [a] Insert review (mỗi người một đánh giá cho một sự kiện – UNIQUE constraint trên DB)
export async function createReview(input = {}) {
  const userId = Number(input?.user?.userId);
  const eventId = Number(input?.params?.eventId ?? input?.body?.eventId);
  const { rating, comment } = input?.body ?? {};
  if (!Number.isSafeInteger(userId) || userId <= 0)
    throw new AppError(400, 'VALIDATION', 'userId không hợp lệ');
  if (!Number.isSafeInteger(eventId) || eventId <= 0)
    throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    throw new AppError(400, 'VALIDATION', 'rating phải từ 1 đến 5');

  // Kiểm tra user đã mua vé hợp lệ cho sự kiện chưa (subquery)
  const eligible = await pool.query(
    // [g] subquery: phát hiện user có vé hợp lệ cho sự kiện
    `SELECT 1 FROM tickets t
       JOIN orders o ON o.order_id = t.order_id
      WHERE o.user_id = $1 AND o.event_id = $2
        AND t.status IN ('VALID', 'CHECKED_IN')
      LIMIT 1`,
    [userId, eventId],
  );
  if (!eligible.rows.length)
    throw new AppError(403, 'NOT_ELIGIBLE', 'Bạn cần mua vé sự kiện trước khi đánh giá');

  try {
    const { rows } = await pool.query(
      `INSERT INTO reviews (user_id, event_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, event_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
       RETURNING review_id, rating, comment, created_at`,
      [userId, eventId, rating, comment ?? null],
    );
    return { reviewId: String(rows[0].review_id), rating: rows[0].rating, comment: rows[0].comment };
  } catch (err) {
    throw new AppError(409, 'REVIEW_EXISTS', 'Bạn đã đánh giá sự kiện này');
  }
}

// [h] Aggregate: trung bình rating + số lượng đánh giá cho một sự kiện
export async function getEventReviews(input = {}) {
  const eventId = Number(input?.params?.eventId);
  if (!Number.isSafeInteger(eventId) || eventId <= 0)
    throw new AppError(400, 'VALIDATION', 'eventId không hợp lệ');

  const { rows } = await pool.query(
    `SELECT r.review_id, r.rating, r.comment, r.created_at,
            u.full_name AS reviewer_name
       FROM reviews r
       JOIN users u ON u.user_id = r.user_id
      WHERE r.event_id = $1
      ORDER BY r.created_at DESC`,
    [eventId],
  );
  // [h] hàm tổng hợp: AVG, COUNT
  const agg = await pool.query(
    `SELECT ROUND(AVG(rating), 1) AS avg_rating, COUNT(*)::int AS total
       FROM reviews WHERE event_id = $1`,
    [eventId],
  );
  return {
    avgRating: Number(agg.rows[0]?.avg_rating ?? 0),
    total: agg.rows[0]?.total ?? 0,
    reviews: rows.map((row) => ({
      reviewId:     String(row.review_id),
      rating:       row.rating,
      comment:      row.comment,
      createdAt:    row.created_at,
      reviewerName: row.reviewer_name,
    })),
  };
}
