import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { postReview, listReviews } from './reviews.controller.js';

const router = Router({ mergeParams: true });

// GET  /api/events/:eventId/reviews
// POST /api/events/:eventId/reviews  (CUSTOMER)
router.get('/',  listReviews);
router.post('/', authenticate, postReview);

export default router;
