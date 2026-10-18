import 'dotenv/config';

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error('Thiếu biến môi trường ' + name + ' (xem .env.example)');
  return v;
};

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID ?? 'ticketrush-dev',
  // Có FIRESTORE_EMULATOR_HOST thì Admin SDK tự trỏ vào Emulator
  firestoreEmulatorHost: process.env.FIRESTORE_EMULATOR_HOST,
  googleApplicationCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS, // chỉ khi dùng Firebase thật
  holdMinutes: Number(process.env.SEAT_HOLD_MINUTES ?? 10),
};
