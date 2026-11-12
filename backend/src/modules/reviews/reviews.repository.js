// TODO [reviews.repository] Phụ trách: TV1 (giả định – brief chưa phân công)
import { notImplemented } from '../../utils/AppError.js';
import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [d] Danh sách đánh giá của sự kiện
// [d,f] Danh sách đánh giá của sự kiện, kèm tên người đánh giá
export async function listReviews({ params }) {
  const { rows } = await pool.query(
    `
      SELECT
        r.review_id AS "reviewId",
        u.full_name AS "userName",
        r.rating,
        r.comment,
        r.created_at AS "createdAt"
      FROM reviews r
      JOIN users u ON r.user_id = u.user_id
      WHERE r.event_id = $1
      ORDER BY r.created_at DESC, r.review_id DESC
    `,
    [params.eventId],
  );

  return rows;
}

// [h] Điểm trung bình và số lượt đánh giá
export async function reviewSummary({ params }) {
  const { rows } = await pool.query(
    `
      SELECT
        COALESCE(AVG(rating), 0) AS average,
        COUNT(*)::int AS count
      FROM reviews
      WHERE event_id = $1
    `,
    [params.eventId],
  );

  return rows[0];
}

// [a] Thêm đánh giá (mỗi người 1 đánh giá / sự kiện)
export async function createReview({ user, params, body }) {
  const { rows } = await pool.query(
    `
      INSERT INTO reviews (
        user_id,
        event_id,
        rating,
        comment
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        review_id AS "reviewId",
        user_id AS "userId",
        event_id AS "eventId",
        rating,
        comment,
        created_at AS "createdAt"
    `,
    [user.userId, params.eventId, body.rating, body.comment],
  );

  return rows[0];
}
