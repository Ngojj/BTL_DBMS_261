import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import * as ctrl from './admin.controller.js';

const router = Router();
const admin  = [authenticate, authorize('ADMIN')];

// ── Lookup helpers ───────────────────────────────────────────────────────────
router.get('/genres', ...admin, ctrl.getGenres);
router.get('/venues', ...admin, ctrl.getVenues);

// ── Events ───────────────────────────────────────────────────────────────────
router.get   ('/events',            ...admin, ctrl.listEvents);
router.post  ('/events',            ...admin, ctrl.createEvent);
router.patch ('/events/:eventId',   ...admin, ctrl.updateEvent);
router.delete('/events/:eventId',   ...admin, ctrl.deleteEvent);

// ── Zones (nested under event) ───────────────────────────────────────────────
router.post  ('/events/:eventId/zones',  ...admin, ctrl.createZone);
router.patch ('/zones/:zoneId',          ...admin, ctrl.updateZone);
router.delete('/zones/:zoneId',          ...admin, ctrl.deleteZone);

export default router;
