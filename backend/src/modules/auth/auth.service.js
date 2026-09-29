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
