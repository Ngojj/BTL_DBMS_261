// Kết nối dùng chung: PostgreSQL (database ticketrush_qp trong container của dự án) và Firestore Emulator của dự án.
// Đổi bằng biến môi trường nếu máy bạn khác: PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, FIRESTORE_EMULATOR_HOST, FIREBASE_PROJECT_ID
import pg from 'pg';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8085'; // cổng trong firebase/firebase.json
export const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'ticketrush-5a616';
initializeApp({ projectId: PROJECT_ID });
export const db = getFirestore();

// Mọi collection của demo có tiền tố qp_ để không đụng tới dữ liệu của ứng dụng (events, validTickets, queues…)
export const C = (name) => db.collection('qp_' + name);
export const COLLECTIONS = ['events', 'zones', 'seats', 'orders', 'users', 'tickets', 'ticketsD', 'eventStats'];

export async function pgClient() {
  const client = new pg.Client({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5433), // docker-compose.yml map 5433 -> 5432
    user: process.env.PGUSER || 'ticketrush',
    password: process.env.PGPASSWORD || 'ticketrush',
    database: process.env.PGDATABASE || 'ticketrush_qp',
  });
  await client.connect();
  await client.query('SET max_parallel_workers_per_gather = 0; SET jit = off');
  return client;
}
