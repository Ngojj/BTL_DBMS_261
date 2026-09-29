// [auth] Đăng ký / đăng nhập / thông tin cá nhân / token Firebase
import { Router } from 'express';
import * as controller from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
router.get('/me', authenticate, controller.me);
// Firebase custom token (claim role) để frontend đăng nhập Firestore – dùng cho Security Rules
router.post('/firebase-token', authenticate, controller.firebaseToken);

export default router;
