import pg from 'pg';
import { env } from './env.js';

// numeric (VND) trả về number thay vì string; BIGINT (id) giữ string để không mất chính xác
pg.types.setTypeParser(1700, (v) => Number(v));

export const pool = new pg.Pool({ connectionString: env.databaseUrl });

// Transaction dùng MỘT client lấy từ pool: BEGIN … COMMIT / ROLLBACK
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
