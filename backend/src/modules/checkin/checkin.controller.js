// TODO [checkin.controller] Phụ trách: TV5 (#7)
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './checkin.service.js';

// Chỉ đọc request → gọi service → trả JSON. Không có SQL / nghiệp vụ ở đây.
const input = (req) => ({ user: req.user, params: req.params, query: req.query, body: req.body });

export const listValidTickets = asyncHandler(async (req, res) => {
  res.json(await service.listValidTickets(input(req)));
});

export const syncCheckins = asyncHandler(async (req, res) => {
  res.json(await service.syncCheckins(input(req)));
});
