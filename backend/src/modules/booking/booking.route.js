// TODO [booking.route] Phụ trách: TV4 (#4, #5)
import { Router } from 'express';
import * as controller from './booking.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

// [a] #4 – giữ ghế (SELECT … FOR UPDATE) → tạo đơn + vé PENDING. Khóa users FOR UPDATE trước khi đếm giới hạn vé
router.post('/', authenticate, controller.createOrder);
// [a,c] #4 – thanh toán giả lập: insert payments, update orders/seats/tickets; sau COMMIT gọi sync
router.post('/:orderId/pay', authenticate, controller.payOrder);
// [c] #5 – hủy đơn, hoàn vé, trả ghế về AVAILABLE
router.post('/:orderId/cancel', authenticate, controller.cancelOrder);
// [d] Đơn hàng của tôi
router.get('/', authenticate, controller.listMyOrders);

// [f] join: chi tiết một đơn (trang thanh toán) – trả { orderId, eventId, eventTitle, eventDate, venueName, city, status, total, expiresAt, items: [{ seatId, seatLabel, zone, price }] }
router.get('/:orderId', authenticate, controller.getOrder);

export default router;
