import { asyncHandler } from '../../utils/asyncHandler.js';
import * as service from './queue.service.js';

export const joinQueue = asyncHandler(async (req, res) => {
  const result = await service.joinQueue({
    eventId: req.params.eventId,
    user: req.user,
  });
  res.json(result);
});

export const getQueueStatus = asyncHandler(async (req, res) => {
  const result = await service.getQueueStatus({
    eventId: req.params.eventId,
    user: req.user,
  });
  res.json(result);
});

export const admitUsers = asyncHandler(async (req, res) => {
  const result = await service.admitUsers({
    eventId: req.params.eventId,
    count: req.body?.count,
    user: req.user,
  });
  res.json(result);
});

export const leaveQueue = asyncHandler(async (req, res) => {
  const result = await service.leaveQueue({
    eventId: req.params.eventId,
    user: req.user,
  });
  res.json(result);
});

