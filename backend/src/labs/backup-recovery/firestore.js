// TV1: application-level JSON snapshot for an isolated primitive-only fixture.
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, stat } from 'node:fs/promises';
import { firestore } from '../../config/firebase.js';
import { parseParams, makeFixture, summarize, verify, elapsed, withArtifact } from './shared.js';

export async function run(params = {}) {
  const { seatCount } = parseParams(params);
  const runId = randomUUID();
  const root = firestore.collection('backupLabRuns').doc(runId);
  const fixture = makeFixture(runId, seatCount);
  const tables = ['events', 'zones', 'seats'];
  const refs = tables.flatMap((table) => fixture[table].map((row) => root.collection(table).doc(row.id)));
  async function readData() {
    const data = {};
    for (const table of tables) {
      const snapshot = await root.collection(table).get();
      data[table] = snapshot.docs.map((doc) => ({ ...doc.data(), id: doc.id }));
    }
    return data;
  }
  async function writeData(data) {
    // At most 202 documents; one atomic batch.
    const batch = firestore.batch();
    for (const table of tables) {
      for (const { id, ...fields } of data[table]) batch.set(root.collection(table).doc(id), fields);
    }
    await batch.commit();
  }
  async function deleteData() {
    const batch = firestore.batch();
    // Deleting a parent document does not cascade in Firestore.
    for (const ref of refs) batch.delete(ref);
    batch.delete(root);
    await batch.commit();
  }
  try {
    await writeData(fixture);
    return await withArtifact('snapshot.json', async (file) => {
      const before = summarize(await readData());
      const backupStart = performance.now();
      const data = await readData();
      await writeFile(file, JSON.stringify({ version: 1, runId, data }), { encoding: 'utf8', flag: 'wx' });
      const backupMs = elapsed(backupStart);
      const backupBytes = (await stat(file)).size;
      const saved = JSON.parse(await readFile(file, 'utf8'));
      if (saved.runId !== runId || summarize(saved.data).checksum !== before.checksum) {
        throw new Error('Tệp sao lưu JSON không hợp lệ');
      }
      await deleteData();
      const afterDeletion = summarize(await readData());
      if (afterDeletion.records !== 0) throw new Error('Dữ liệu thử chưa được xóa hết');
      const restoreStart = performance.now();
      // Restore from disk, not the fixture or the in-memory backup variable.
      const backup = JSON.parse(await readFile(file, 'utf8'));
      await writeData(backup.data);
      const restoreMs = elapsed(restoreStart);
      const afterRestore = summarize(await readData());
      verify(before, afterDeletion, afterRestore);
      return {
        metrics: { backupMs, restoreMs, backupBytes, recordsRestored: afterRestore.records, dataLoss: false },
        details: {
          runId, collection: root.path, method: 'JSON snapshot / Admin SDK batch',
          before, afterDeletion, afterRestore,
          note: 'Sao lưu cấp ứng dụng với dữ liệu thử chỉ gồm chuỗi và số; không có ghi đồng thời. Không phải Managed Export/Import, Scheduled Backup hay PITR. Không sao lưu indexes/rules và không áp dụng cho mọi kiểu dữ liệu Firestore.',
        },
      };
    });
  } finally {
    await deleteData();
  }
}
