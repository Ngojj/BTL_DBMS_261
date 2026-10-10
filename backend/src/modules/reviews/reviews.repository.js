// TODO [reviews.repository] Phụ trách: TV1 (giả định – brief chưa phân công)
import { notImplemented } from '../../utils/AppError.js';
// import { pool, withTransaction } from '../../config/pg.js';

// SQL thuần, tham số $1,$2…; ghi chú loại truy vấn a–h trong comment.

// [d] Danh sách đánh giá của sự kiện
export async function listReviews(input) {
  throw notImplemented('reviews.listReviews');
}

// [h] Điểm trung bình + số lượt (AVG/COUNT)
export async function reviewSummary(input) {
  throw notImplemented('reviews.reviewSummary');
}

// [a] Thêm đánh giá (mỗi người 1 đánh giá / sự kiện)
export async function createReview(input) {
  throw notImplemented('reviews.createReview');
}
