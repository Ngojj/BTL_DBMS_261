// Phụ trách: TV3 – Query processing
// Kịch bản: Báo cáo doanh thu theo khu vực: một câu SQL JOIN + GROUP BY so với cách làm trên Firestore
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { runLab, listRuns } from '../labRunner.js';
import * as postgres from './postgres.js';
import * as firestore from './firestore.js';
import { roundMs, sameRows, validateParams } from './shared.js';

export const scenario = 'Query processing';
const router = Router();

export async function runComparison(input = {}) {
  const params = validateParams(input);
  const snapshot = await postgres.prepare(params);
  const ref = firestore.datasetRef(randomUUID());
  const preparation = { postgresMs: snapshot.preparationMs, firestoreMs: 0, documentsWritten: 0 };
  let firestoreResult;
  let cleanupStatus = 'not-needed';
  let wroteDataset = false;
  const setupStarted = performance.now();
  try {
    await firestore.checkEmulator();
    wroteDataset = true;
    preparation.documentsWritten = await firestore.prepare(ref, snapshot);
    preparation.firestoreMs = roundMs(performance.now() - setupStarted);
    firestoreResult = await firestore.run(params, ref);
  } catch (error) {
    firestoreResult = {
      ok: false, durationMs: null, metrics: {},
      error: error.status ? error.message : 'Không hoàn tất được truy vấn Firestore; kiểm tra Emulator và chạy lại.',
      details: { errorCode: error.code ?? 'FIRESTORE_ERROR' },
    };
  } finally {
    if (wroteDataset) {
      try {
        await firestore.cleanup(ref);
        cleanupStatus = 'deleted';
      } catch {
        cleanupStatus = 'failed';
      }
    }
  }
  const matched = firestoreResult.ok === false ? null
    : sameRows(snapshot.result.details.rows, firestoreResult.details.rows);
  const verification = matched === null ? 'NOT_COMPARED' : matched ? 'MATCH' : 'MISMATCH';
  const common = {
    verification,
    summary: matched === true
      ? `Khớp từng khu: ${snapshot.result.metrics.ticketsSold} vé, ${snapshot.result.metrics.revenue} VND.`
      : matched === false ? 'Kết quả hai DBMS không khớp; không dùng lần chạy này để kết luận hiệu năng.'
        : 'Chưa so sánh được vì Firestore chưa hoàn tất.',
    measurement: 'rowsRead là số dòng/document trả về backend, không phải số dòng quét hay số lượt đọc tính phí. durationMs chỉ đo truy vấn và gom kết quả.',
    snapshotAt: snapshot.snapshotAt,
    source: { eventId: params.eventId, zones: snapshot.zones.length, tickets: snapshot.tickets.length },
    preparation,
    cleanup: { status: cleanupStatus, ...(cleanupStatus === 'failed' ? { path: ref.path } : {}) },
    environment: 'PostgreSQL và Firestore Emulator; đo một lần, chạy PostgreSQL trước. Không suy ra hiệu năng hoặc chi phí cloud.',
  };
  snapshot.result.details = { ...common, ...snapshot.result.details };
  firestoreResult.details = { ...common, ...firestoreResult.details };
  // runLab giữ nguyên durationMs đã đo, lưu kết quả/kiểm chứng bằng JSON.
  // Chuẩn bị và dọn dữ liệu diễn ra ngoài khoảng đo của cả hai DBMS.
  return runLab({
    topic: 'query-processing', scenario, params,
    postgres: async () => snapshot.result,
    firestore: async () => firestoreResult,
  });
}

// POST body: { params: { ... } } – tham số riêng của thí nghiệm
router.post('/run', asyncHandler(async (req, res) => {
  res.json(await runComparison(req.body?.params));
}));

router.get('/runs', asyncHandler(async (_req, res) => {
  res.json(await listRuns('query-processing'));
}));

export default router;
