import { createHash } from 'node:crypto';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { AppError } from '../../utils/AppError.js';

export function parseParams(params = {}) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    throw new AppError(400, 'VALIDATION', 'params phải là một object');
  }
  if (Object.keys(params).some((key) => key !== 'seatCount')) {
    throw new AppError(400, 'VALIDATION', 'Chỉ nhận seatCount; thí nghiệm tự tạo sự kiện riêng');
  }
  const seatCount = params.seatCount === undefined ? 50 : params.seatCount;
  if (typeof seatCount !== 'number' || !Number.isInteger(seatCount) || seatCount < 1 || seatCount > 200) {
    throw new AppError(400, 'VALIDATION', 'seatCount phải là số nguyên từ 1 đến 200');
  }
  return { seatCount };
}

export function makeFixture(runId, seatCount) {
  return {
    events: [{ id: 'event', title: `Backup Lab ${runId}`, status: 'DRAFT' }],
    zones: [{ id: 'zone', event_id: 'event', name: 'LAB', price: 200000, capacity: seatCount }],
    seats: Array.from({ length: seatCount }, (_, i) => ({
      id: `seat-${String(i + 1).padStart(3, '0')}`, zone_id: 'zone',
      row_label: 'A', seat_no: i + 1, status: 'AVAILABLE',
    })),
  };
}

const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
};

export function summarize(data) {
  const sorted = Object.fromEntries(['events', 'zones', 'seats'].map((table) => [
    table, [...data[table]].sort((a, b) => a.id.localeCompare(b.id)),
  ]));
  return {
    counts: Object.fromEntries(Object.entries(sorted).map(([table, rows]) => [table, rows.length])),
    records: Object.values(sorted).reduce((total, rows) => total + rows.length, 0),
    checksum: createHash('sha256').update(JSON.stringify(canonical(sorted))).digest('hex'),
    sample: { event: sorted.events[0] ?? null, seat: sorted.seats[0] ?? null },
  };
}

export function verify(before, afterDeletion, afterRestore) {
  if (afterDeletion.records !== 0) throw new Error('Giả lập xóa chưa loại bỏ hết dữ liệu thử');
  if (before.checksum !== afterRestore.checksum || before.records !== afterRestore.records) {
    throw new Error('Khôi phục không khớp dữ liệu trước sao lưu');
  }
}

export const elapsed = (start) => Math.round((performance.now() - start) * 100) / 100;

export async function withArtifact(filename, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ticketrush-backup-'));
  const file = path.join(dir, filename);
  try {
    return await fn(file);
  } finally {
    // Only internally generated files; no recursive filesystem deletion.
    await rm(file, { force: true });
    await rmdir(dir);
  }
}
