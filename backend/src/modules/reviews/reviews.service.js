// TODO [reviews.service] Phụ trách: TV1 (giả định – brief chưa phân công)
import * as repo from './reviews.repository.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [d] Danh sách đánh giá của sự kiện
export async function listReviews(input) {
  return repo.listReviews(input);
}

// TODO [h] Điểm trung bình + số lượt (AVG/COUNT)
export async function reviewSummary(input) {
  return repo.reviewSummary(input);
}

// TODO [a] Thêm đánh giá (mỗi người 1 đánh giá / sự kiện)
export async function createReview(input) {
  return repo.createReview(input);
}
