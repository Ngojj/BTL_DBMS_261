// TODO [events.controller] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './events.service.js';

// Chỉ đọc request → gọi service → trả JSON. Không có SQL / nghiệp vụ ở đây.
const input = (req) => ({ user: req.user, params: req.params, query: req.query, body: req.body });

export const listGenres = asyncHandler(async (req, res) => {
  res.json(await service.listGenres(input(req)));
});

export const listAllEvents = asyncHandler(async (req, res) => {
  res.json(await service.listAllEvents(input(req)));
});

export const listVenues = asyncHandler(async (_req, res) => {
  res.json(await service.listVenues());
});

export const listEvents = asyncHandler(async (req, res) => {
  res.json(await service.listEvents(input(req)));
});

export const getEvent = asyncHandler(async (req, res) => {
  res.json(await service.getEvent(input(req)));
});

export const createEvent = asyncHandler(async (req, res) => {
  res.json(await service.createEvent(input(req)));
});

export const updateEvent = asyncHandler(async (req, res) => {
  res.json(await service.updateEvent(input(req)));
});

export const deleteEvent = asyncHandler(async (req, res) => {
  res.json(await service.deleteEvent(input(req)));
});
