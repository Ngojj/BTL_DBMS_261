// TV1: restore a dedicated event/zone/seat fixture from a real pg_dump archive.
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { stat } from 'node:fs/promises';
import { pool, withTransaction } from '../../config/pg.js';
import { env } from '../../config/env.js';
import { parseParams, makeFixture, summarize, verify, elapsed, withArtifact } from './shared.js';

const exec = promisify(execFile);

async function pgTool(tool, args) {
  const url = new URL(env.databaseUrl);
  const connection = {
    PGHOST: url.hostname, PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGCONNECT_TIMEOUT: '10',
  };
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'options']) {
    if (url.searchParams.has(key)) connection[`PG${key.toUpperCase()}`] = url.searchParams.get(key);
  }
  const executable = process.env[tool === 'pg_dump' ? 'PG_DUMP_PATH' : 'PG_RESTORE_PATH'] || tool;
  const container = process.env.PG_TOOLS_CONTAINER;
  try {
    const options = {
      env: { ...process.env, ...connection }, timeout: 120000, maxBuffer: 1024 * 1024,
      windowsHide: true,
    };
    if (container) {
      // Explicit opt-in: DATABASE_URL must target this container's database.
      // Host port 5433 maps to PostgreSQL's internal port 5432.
      options.env.PGHOST = '127.0.0.1';
      options.env.PGPORT = '5432';
      const archive = `/tmp/ticketrush-backup-${randomUUID()}.dump`;
      const file = args.at(-1);
      const containerArgs = [...args.slice(0, -1), archive];
      const docker = (arguments_) => exec('docker', arguments_, options);
      const environmentFlags = Object.keys(connection).flatMap((key) => ['--env', key]);
      try {
        if (tool === 'pg_restore') await docker(['cp', file, `${container}:${archive}`]);
        await docker(['exec', ...environmentFlags, container, executable,
          ...(tool === 'pg_restore' ? ['--dbname', connection.PGDATABASE] : []), ...containerArgs]);
        if (tool === 'pg_dump') await docker(['cp', `${container}:${archive}`, file]);
      } finally {
        await docker(['exec', container, 'rm', '-f', '--', archive]);
      }
    } else {
      await exec(executable, tool === 'pg_restore' ? ['--dbname', connection.PGDATABASE, ...args] : args, options);
    }
  } catch (error) {
    // Never expose command environments or credentials through the API.
    if (error.code === 'ENOENT' && !container) {
      throw new Error(`Không tìm thấy ${tool}. Cài PostgreSQL client hoặc đặt ${tool === 'pg_dump' ? 'PG_DUMP_PATH' : 'PG_RESTORE_PATH'} trong backend/.env`);
    }
    let detail = String(error.stderr ?? '').trim();
    for (const secret of [env.databaseUrl, connection.PGPASSWORD, url.password]) {
      if (secret) detail = detail.replaceAll(secret, '[redacted]');
    }
    throw new Error(`${tool} thất bại (mã ${error.code ?? 'timeout'}). ${detail.slice(0, 1500) || 'Kiểm tra kết nối, quyền và phiên bản PostgreSQL client.'}`);
  }
}

export async function run(params = {}) {
  const { seatCount } = parseParams(params);
  const runId = randomUUID();
  const schema = `backup_lab_${runId.replaceAll('-', '')}`;
  // Never derive SQL identifiers from request input.
  if (!/^backup_lab_[a-f0-9]{32}$/.test(schema)) throw new Error('Schema thử không hợp lệ');
  const fixture = makeFixture(runId, seatCount);
  async function readState() {
    const data = {};
    for (const table of ['events', 'zones', 'seats']) {
      data[table] = (await pool.query(`SELECT * FROM "${schema}".${table} ORDER BY id`)).rows;
    }
    return summarize(data);
  }
  try {
    await withTransaction(async (client) => {
      await client.query(`CREATE SCHEMA "${schema}"`);
      await client.query(`
        CREATE TABLE "${schema}".events (id text PRIMARY KEY, title text NOT NULL, status text NOT NULL);
        CREATE TABLE "${schema}".zones (
          id text PRIMARY KEY, event_id text NOT NULL REFERENCES "${schema}".events ON DELETE CASCADE,
          name text NOT NULL, price integer NOT NULL, capacity integer NOT NULL);
        CREATE TABLE "${schema}".seats (
          id text PRIMARY KEY, zone_id text NOT NULL REFERENCES "${schema}".zones ON DELETE CASCADE,
          row_label text NOT NULL, seat_no integer NOT NULL, status text NOT NULL);
      `);
      for (const [table, rows] of Object.entries(fixture)) {
        for (const row of rows) {
          const keys = Object.keys(row);
          await client.query(
            `INSERT INTO "${schema}".${table} (${keys.join(',')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(',')})`,
            Object.values(row),
          );
        }
      }
    });
    return await withArtifact('snapshot.dump', async (file) => {
      const before = await readState();
      const backupStart = performance.now();
      await pgTool('pg_dump', ['--format=custom', '--data-only', '--no-owner', '--no-privileges', '--schema', schema, '--file', file]);
      const backupMs = elapsed(backupStart);
      const backupBytes = (await stat(file)).size;
      // Autocommitted deletion: restore must read the backup, not roll back this DELETE.
      await pool.query(`DELETE FROM "${schema}".events WHERE id = $1`, ['event']);
      const afterDeletion = await readState();
      if (afterDeletion.records !== 0) throw new Error('Dữ liệu thử chưa được xóa hết');
      const restoreStart = performance.now();
      await pgTool('pg_restore', ['--data-only', '--no-owner', '--no-privileges', '--single-transaction', '--exit-on-error', file]);
      const restoreMs = elapsed(restoreStart);
      const afterRestore = await readState();
      verify(before, afterDeletion, afterRestore);
      return {
        metrics: { backupMs, restoreMs, backupBytes, recordsRestored: afterRestore.records, dataLoss: false },
        details: {
          runId, schema, method: 'pg_dump / pg_restore (custom, data-only)',
          toolLocation: process.env.PG_TOOLS_CONTAINER ? `Docker: ${process.env.PG_TOOLS_CONTAINER}` : 'Local PostgreSQL client',
          before, afterDeletion, afterRestore,
          note: 'Schema thử gồm sự kiện, khu vực và ghế; giữ cấu trúc bảng khi xóa. Kiểm tra toàn bộ trường bằng SHA-256 trước khi dọn dữ liệu và tệp tạm. Không sao lưu toàn bộ ứng dụng, không dùng PITR.',
        },
      };
    });
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  }
}
