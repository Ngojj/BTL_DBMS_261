import admin from 'firebase-admin';
import { env } from './env.js';

// Thứ tự chọn thông tin xác thực:
//  1) FIRESTORE_EMULATOR_HOST có đặt → Admin SDK tự nối Emulator, không cần khóa dịch vụ (dev).
//  2) FIREBASE_SERVICE_ACCOUNT_JSON → khóa dịch vụ nằm trong biến môi trường (Render, Railway…), KHÔNG commit.
//  3) GOOGLE_APPLICATION_CREDENTIALS → đường dẫn tới file serviceAccount.json (chạy trên máy cá nhân với Firebase thật).
function credentialFromEnv() {
  const raw = env.firebaseServiceAccountJson?.trim();
  if (!raw) return undefined;
  const text = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'); // chấp nhận cả base64
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON không phải JSON (hoặc base64 của JSON) hợp lệ');
  }
  return admin.credential.cert(json);
}

if (!admin.apps.length) {
  const credential = credentialFromEnv();
  admin.initializeApp({ projectId: env.firebaseProjectId, ...(credential && { credential }) });
}

export const firestore = admin.firestore();
export const firebaseAuth = () => admin.auth();
