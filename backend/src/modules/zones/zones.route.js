// TODO [zones.route] Phụ trách: TV2 (#9)
import { Router } from 'express';
import * as controller from './zones.controller.js';

const router = Router();

router.get('/events/:eventId/zones', controller.listZones);
router.get('/zones/:zoneId/seats', controller.listSeats);

export default router;
