// Khung chạy thí nghiệm: gọi cùng một kịch bản trên cả hai DBMS và trả về CÙNG một định dạng.
//
// Định dạng kết quả (frontend hiển thị bảng hai cột PostgreSQL | Firestore):
// {
//   topic, scenario, params, ranAt, note,
//   results: {
//     postgres:  { ok, durationMs, metrics: { <tên>: <giá trị> }, details?, error? },
//     firestore: { ok, durationMs, metrics: { <tên>: <giá trị> }, details?, error? }
//   }
// }
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env.js';

async function runOne(fn, params) {
  const t0 = performance.now();
  try {
    const out = await fn(params);
    return { ok: true, durationMs: Math.round(performance.now() - t0), ...out };
  } catch (err) {
    return { ok: false, durationMs: Math.round(performance.now() - t0), metrics: {}, error: err.message };
  }
}

export async function runLab({ topic, scenario, postgres, firestore, params = {} }) {
  const results = {
    postgres: await runOne(postgres, params),
    firestore: await runOne(firestore, params),
  };
  const run = { topic, scenario, params, ranAt: new Date().toISOString(), note: '', results };
  await saveRun(run);
  return run;
}

// Lưu mỗi lần chạy thành file JSON để đưa vào báo cáo (thay cho bảng lab_runs)
async function saveRun(run) {
  const dir = path.resolve(env.labResultsDir, run.topic);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, run.ranAt.replace(/[:.]/g, '-') + '.json'), JSON.stringify(run, null, 2));
}

export async function listRuns(topic) {
  const dir = path.resolve(env.labResultsDir, topic);
  try {
    const files = (await fs.readdir(dir)).sort().reverse().slice(0, 20);
    return Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))));
  } catch {
    return [];
  }
}
