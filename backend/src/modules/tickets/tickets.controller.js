// TODO [tickets.controller] Phụ trách: TV5 (#6)
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './tickets.service.js';

// Chỉ đọc request → gọi service → trả JSON. Không có SQL / nghiệp vụ ở đây.
const input = (req) => ({ user: req.user, params: req.params, query: req.query, body: req.body });

export const listMyTickets = asyncHandler(async (req, res) => {
  res.json(await service.listMyTickets(input(req)));
});
