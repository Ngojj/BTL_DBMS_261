// TODO [reviews.route] Phụ trách: TV1 (giả định – brief chưa phân công)
import { Router } from 'express';
import * as controller from './reviews.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// [d] Danh sách đánh giá của sự kiện
router.get('/events/:eventId/reviews', controller.listReviews);
// [h] Điểm trung bình + số lượt (AVG/COUNT)
router.get('/events/:eventId/reviews/summary', controller.reviewSummary);
// [a] Thêm đánh giá (mỗi người 1 đánh giá / sự kiện)
router.post('/events/:eventId/reviews', authenticate, controller.createReview);

export default router;
