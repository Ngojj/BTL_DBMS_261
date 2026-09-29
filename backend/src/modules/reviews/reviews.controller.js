// TODO [reviews.controller] Phụ trách: TV1 (giả định – brief chưa phân công)
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './reviews.service.js';

// Chỉ đọc request → gọi service → trả JSON. Không có SQL / nghiệp vụ ở đây.
const input = (req) => ({ user: req.user, params: req.params, query: req.query, body: req.body });

export const listReviews = asyncHandler(async (req, res) => {
  res.json(await service.listReviews(input(req)));
});

export const reviewSummary = asyncHandler(async (req, res) => {
  res.json(await service.reviewSummary(input(req)));
});

export const createReview = asyncHandler(async (req, res) => {
  res.json(await service.createReview(input(req)));
});
