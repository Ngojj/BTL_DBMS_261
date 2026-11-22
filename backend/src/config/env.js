import 'dotenv/config';

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error('Thiếu biến môi trường ' + name + ' (xem .env.example)');
  return v;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  // Nhiều địa chỉ frontend, ngăn cách bằng dấu phẩy (VD: https://x.web.app,https://x.firebaseapp.com)
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  databaseUrl: required('DATABASE_URL'),
  // true khi PostgreSQL ở trên mạng (Neon, Supabase, Render…) và bắt buộc SSL
  databaseSsl: process.env.DATABASE_SSL === 'true',
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? 'ticketrush-dev',
  // Có FIRESTORE_EMULATOR_HOST thì Admin SDK tự trỏ vào Emulator
  firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS, // chỉ khi dùng Firebase thật, trỏ tới file serviceAccount.json
  // Khóa dịch vụ dạng chuỗi JSON (hoặc base64 của JSON) cho máy chủ không có file, như Render. KHÔNG commit.
  firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
  labResultsDir: process.env.LAB_RESULTS_DIR ?? './lab-results',
  holdMinutes: Number(process.env.SEAT_HOLD_MINUTES ?? 10),
};
