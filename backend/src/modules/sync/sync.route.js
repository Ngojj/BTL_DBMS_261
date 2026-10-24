import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import { syncEventSeats, syncValidTickets } from './sync.repository.js';

const router = Router();

// POST /api/sync/events/:eventId/seats  – admin kích hoạt đồng bộ lại ghế
router.post('/events/:eventId/seats', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const eventId = Number(req.params.eventId);
    await syncEventSeats(eventId);
    res.json({ synced: true, eventId: String(eventId) });
  } catch (err) {
    next(err);
  }
});

// POST /api/sync/events/:eventId/tickets – admin đồng bộ danh sách vé hợp lệ (offline checkin)
router.post('/events/:eventId/tickets', authenticate, authorize('ADMIN'), async (req, res, next) => {
  try {
    const eventId = Number(req.params.eventId);
    await syncValidTickets(eventId);
    res.json({ synced: true, eventId: String(eventId) });
  } catch (err) {
    next(err);
  }
});

export default router;
