// TODO [booking.controller] Phụ trách: TV4 (#4, #5)
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './booking.service.js';

// Chỉ đọc request → gọi service → trả JSON. Không có SQL / nghiệp vụ ở đây.
const input = (req) => ({ user: req.user, params: req.params, query: req.query, body: req.body });

export const createOrder = asyncHandler(async (req, res) => {
  res.json(await service.createOrder(input(req)));
});

export const payOrder = asyncHandler(async (req, res) => {
  res.json(await service.payOrder(input(req)));
});

export const cancelOrder = asyncHandler(async (req, res) => {
  res.json(await service.cancelOrder(input(req)));
});

export const listMyOrders = asyncHandler(async (req, res) => {
  res.json(await service.listMyOrders(input(req)));
});
