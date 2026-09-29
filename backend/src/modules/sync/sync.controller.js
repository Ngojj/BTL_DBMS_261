// TODO [sync.controller] Phụ trách: TV5 (đồng bộ PostgreSQL → Firestore)
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './sync.service.js';

// Chỉ đọc request → gọi service → trả JSON. Không có SQL / nghiệp vụ ở đây.
const input = (req) => ({ user: req.user, params: req.params, query: req.query, body: req.body });

export const resyncEvent = asyncHandler(async (req, res) => {
  res.json(await service.resyncEvent(input(req)));
});

export const resyncAll = asyncHandler(async (req, res) => {
  res.json(await service.resyncAll(input(req)));
});
