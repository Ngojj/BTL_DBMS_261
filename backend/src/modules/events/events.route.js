// TODO [events.route] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import { Router } from 'express';
import * as controller from './events.controller.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = Router();

// [d] #1 – danh sách thể loại
router.get('/genres', controller.listGenres);
// [d,e] #1 lọc theo thể loại [d]; #2 lọc thành phố + khoảng ngày + khoảng giá [e]
router.get('/', controller.listEvents);
// [d] Chi tiết sự kiện + các khu vực
router.get('/:eventId', controller.getEvent);
// [a] #8 – thêm sự kiện
router.post('/', authenticate, authorize('ADMIN'), controller.createEvent);
// [c] #8 – sửa sự kiện
router.put('/:eventId', authenticate, authorize('ADMIN'), controller.updateEvent);
// [b] #8 – xóa sự kiện
router.delete('/:eventId', authenticate, authorize('ADMIN'), controller.deleteEvent);

export default router;
