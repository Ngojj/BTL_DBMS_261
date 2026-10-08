import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { firebaseAuth } from '../../config/firebase.js';
import { AppError } from '../../utils/AppError.js';
import * as repo from './auth.repository.js';

const sign = (u) =>
  jwt.sign({ userId: String(u.user_id), role: u.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

const publicUser = (u) => ({
  userId: String(u.user_id), email: u.email, phone: u.phone, fullName: u.full_name, role: u.role,
});

export async function register({ email, phone, fullName, password } = {}) {
  if (!email || !phone || !fullName || !password)
    throw new AppError(400, 'VALIDATION', 'Thiếu email, phone, fullName hoặc password');
  if (await repo.findByEmail(email)) throw new AppError(409, 'EMAIL_TAKEN', 'Email đã được sử dụng');
  const hash = await bcrypt.hash(password, 10);
  const user = await repo.insertUser({ email, phone, fullName, passwordHash: hash }); // CUSTOMER mặc định
  return { token: sign(user), user: publicUser(user) };
}

export async function login({ email, password } = {}) {
  const user = email && (await repo.findByEmail(email));
  if (!user || !(await bcrypt.compare(password ?? '', user.password_hash)))
    throw new AppError(401, 'BAD_CREDENTIALS', 'Sai email hoặc mật khẩu');
  return { token: sign(user), user: publicUser(user) };
}

export async function me(userId) {
  const user = await repo.findById(userId);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy người dùng');
  return publicUser(user);
}

export async function firebaseToken({ userId, role }) {
  return { token: await firebaseAuth().createCustomToken(String(userId), { role }) };
}

// Đăng nhập / đăng ký bằng Google.
// Frontend đăng nhập Google qua Firebase Auth rồi gửi Firebase ID token; ta xác minh chữ ký + nhà cung cấp + email đã xác minh.
// - Email đã có trong PostgreSQL: đăng nhập vào tài khoản đó (giữ nguyên role).
// - Email mới: tạo CUSTOMER. Bảng users bắt buộc có phone (cũng dùng để phát hiện gom vé) nên yêu cầu thêm phone,
//   thiếu thì trả 409 PHONE_REQUIRED để frontend hỏi rồi gọi lại. Mật khẩu là chuỗi ngẫu nhiên không ai biết
//   (tài khoản chỉ vào được bằng Google, hoặc đặt lại mật khẩu sau này).
export async function googleLogin({ idToken, phone } = {}) {
  if (!idToken) throw new AppError(400, 'VALIDATION', 'Thiếu idToken');
  let decoded;
  try {
    decoded = await firebaseAuth().verifyIdToken(idToken);
  } catch {
    throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Phiên đăng nhập Google không hợp lệ hoặc đã hết hạn');
  }
  if (decoded.firebase?.sign_in_provider !== 'google.com' || !decoded.email || !decoded.email_verified)
    throw new AppError(401, 'INVALID_GOOGLE_TOKEN', 'Tài khoản Google chưa xác minh email');

  const email = decoded.email.toLowerCase();
  let user = await repo.findByEmail(email);
  if (!user) {
    if (!phone) throw new AppError(409, 'PHONE_REQUIRED', 'Cần số điện thoại để hoàn tất đăng ký');
    if (!/^[0-9]{9,15}$/.test(phone)) throw new AppError(400, 'VALIDATION', 'Số điện thoại phải gồm 9–15 chữ số');
    user = await repo.insertUser({
      email,
      phone,
      fullName: decoded.name ?? email.split('@')[0],
      passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 10),
    });
  }
  return { token: sign(user), user: publicUser(user) };
}
