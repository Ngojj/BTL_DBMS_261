import { Router } from 'express';
import * as controller from './events.controller.js';

const router = Router();

// Read-only catalog endpoints needed to select an event before purchase.
router.get('/', controller.listEvents);
router.get('/:eventId', controller.getEvent);

export default router;
