// TODO [zones.controller] Phụ trách: TV2 (#9)
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './zones.service.js';

// Chỉ đọc request → gọi service → trả JSON. Không có SQL / nghiệp vụ ở đây.
const input = (req) => ({ user: req.user, params: req.params, query: req.query, body: req.body });

export const listZones = asyncHandler(async (req, res) => {
  res.json(await service.listZones(input(req)));
});

export const createZone = asyncHandler(async (req, res) => {
  res.json(await service.createZone(input(req)));
});

export const updateZone = asyncHandler(async (req, res) => {
  res.json(await service.updateZone(input(req)));
});

export const deleteZone = asyncHandler(async (req, res) => {
  res.json(await service.deleteZone(input(req)));
});

export const generateSeats = asyncHandler(async (req, res) => {
  res.json(await service.generateSeats(input(req)));
});
