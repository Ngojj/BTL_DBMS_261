// [auth] Đăng ký / đăng nhập / đăng nhập Google / thông tin cá nhân / token Firebase
import { Router } from 'express';
import * as controller from './auth.controller.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router();

router.post('/register', controller.register);
router.post('/login', controller.login);
// Đăng nhập / đăng ký bằng Google: body { idToken, phone? } – idToken là Firebase ID token của tài khoản Google
router.post('/google', controller.google);
router.get('/me', authenticate, controller.me);
// Firebase custom token (claim role) để frontend đăng nhập Firestore – dùng cho Security Rules
router.post('/firebase-token', authenticate, controller.firebaseToken);

export default router;
