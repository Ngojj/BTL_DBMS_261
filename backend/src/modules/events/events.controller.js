// TODO [events.controller] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './events.service.js';

// Chỉ đọc request → gọi service → trả JSON. Không có SQL / nghiệp vụ ở đây.
const input = (req) => ({ user: req.user, params: req.params, query: req.query, body: req.body });

export const listEvents = asyncHandler(async (req, res) => {
  res.json(await service.listEvents(input(req)));
});

export const getEvent = asyncHandler(async (req, res) => {
  res.json(await service.getEvent(input(req)));
});
