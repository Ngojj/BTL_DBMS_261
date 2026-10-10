import { pool } from '../../config/pg.js';

// [d] truy vấn một điều kiện: tìm user theo email
export async function findByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0] ?? null;
}

export async function findById(userId) {
  const { rows } = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
  return rows[0] ?? null;
}

// [a] insert
export async function insertUser({ email, phone, fullName, passwordHash }) {
  const { rows } = await pool.query(
    'INSERT INTO users (email, phone, full_name, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
    [email, phone, fullName, passwordHash],
  );
  return rows[0];
}
