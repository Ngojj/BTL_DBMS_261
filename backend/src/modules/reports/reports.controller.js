// Phụ trách: TV3 (#10, #11)
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './reports.service.js';

// Chỉ đọc request → gọi service → trả JSON. Không có SQL / nghiệp vụ ở đây.
const input = (req) => ({ user: req.user, params: req.params, query: req.query, body: req.body });

export const revenueByZone = asyncHandler(async (req, res) => {
  res.json(await service.revenueByZone(input(req)));
});

export const occupancyByZone = asyncHandler(async (req, res) => {
  res.json(await service.occupancyByZone(input(req)));
});

export const suspiciousAccounts = asyncHandler(async (req, res) => {
  res.json(await service.suspiciousAccounts(input(req)));
});
