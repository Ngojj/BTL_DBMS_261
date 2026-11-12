// Trang thí nghiệm dùng chung cho 6 topic DBMS Lab (theo mockup):
// thanh tham số + nút chạy → hai thẻ PostgreSQL | Firestore → nhật ký chạy → kết luận, lưu/xuất CSV.
// Chỉnh nội dung từng topic ở pages/lab/labConfigs.js; logic thí nghiệm ở backend/src/labs/<topic>/.
import { useState } from 'react';
import { labsApi } from '../api/labsApi.js';
import { labConfigs } from '../pages/lab/labConfigs.js';

const NOTE_KEY = (t) => 'ticketrush_lab_' + t;
const time = () => new Date().toLocaleTimeString('vi-VN', { hour12: false });

function MetricCard({ name, dot, engine, cfg, run, params, dbms }) {
  const r = run?.results?.[dbms];
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <span className={'w-3 h-3 rounded-full ' + dot} /> {name}
        </h2>
        <span className="text-xs font-semibold text-gray-500 text-right">{engine}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cfg.metrics.map((m) => {
          const v = r?.ok ? m.value(r.metrics ?? {}, params, r) : null;
          return (
            <div key={m.label} className="rounded-xl bg-paper p-4">
              <p className="text-xs font-semibold text-gray-500 mb-1">{m.label}</p>
              <p className="text-2xl font-extrabold break-words">{v == null || v === '' ? '—' : String(v)}</p>
            </div>
          );
        })}
      </div>
      {r && !r.ok && <p className="text-sm text-red-600 mt-3">{r.error}</p>}
      {r?.ok && r.details && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold">Bằng chứng và trạng thái dữ liệu</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-paper p-3 text-xs whitespace-pre-wrap break-words">
            {JSON.stringify(r.details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

export default function LabPage({ topic }) {
  const cfg = labConfigs[topic];
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(NOTE_KEY(topic))) ?? {};
    } catch {
      return {};
    }
  })();
  const [params, setParams] = useState(Object.fromEntries(cfg.params.map((p) => [p.key, p.default])));
  const [run, setRun] = useState(saved.run ?? null);
  const [log, setLog] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(saved.note ?? '');
  const [msg, setMsg] = useState(null);

  const cast = () => Object.fromEntries(cfg.params.map((p) => [p.key, p.type === 'number' ? Number(params[p.key]) : params[p.key]]));
  const addLog = (line) => setLog((l) => [...l, '[' + time() + '] ' + line]);

  async function start() {
    const p = cast();
    setBusy(true);
    setMsg(null);
    setLog([]);
    addLog('Chạy thí nghiệm với ' + JSON.stringify(p));
    try {
      const result = await labsApi.run(topic, p);
      setRun({ ...result, params: p });
      for (const db of ['postgres', 'firestore']) {
        const r = result.results[db];
        addLog((db === 'postgres' ? 'PostgreSQL' : 'Firestore') + ': ' + (r.ok ? 'xong trong ' + r.durationMs + ' ms' : 'LỖI – ' + r.error));
        if (r.ok && r.details) addLog('  chi tiết: ' + JSON.stringify(r.details).slice(0, 400));
      }
    } catch (e) {
      addLog('LỖI: ' + (e.code === 'NOT_IMPLEMENTED' ? 'thí nghiệm này backend chưa hiện thực.' : e.message));
    } finally {
      setBusy(false);
    }
  }

  function saveRun() {
    localStorage.setItem(NOTE_KEY(topic), JSON.stringify({ run, note }));
    setMsg('Đã lưu trên trình duyệt. Mỗi lần chạy cũng được backend lưu thành file JSON trong backend/lab-results/.');
  }

  function exportCsv() {
    if (!run) return setMsg('Chưa có kết quả để xuất.');
    const p = run.params ?? {};
    const rows = [['Chỉ số', 'PostgreSQL', 'Firestore']];
    for (const m of cfg.metrics) {
      const cell = (db) => {
        const r = run.results[db];
        const v = r?.ok ? m.value(r.metrics ?? {}, p, r) : null;
        return v == null ? '' : String(v);
      };
      rows.push([m.label, cell('postgres'), cell('firestore')]);
    }
    rows.push(['Tham số', JSON.stringify(p), '']);
    rows.push(['Kết luận', note, '']);
    const csv = '﻿' + rows.map((r) => r.map((c) => '"' + c.replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'lab-' + topic + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="max-w-6xl">
      <p className="text-xs font-bold tracking-widest text-gray-500">{cfg.eyebrow ?? 'DBMS LAB · ' + topic.replace(/-/g, ' ').toUpperCase()}</p>
      <h1 className="text-3xl font-extrabold tracking-tight mt-1">{cfg.title}</h1>
      <p className="text-gray-500 mt-1 mb-5">{cfg.subtitle}</p>
      {cfg.note && <p className="text-sm text-gray-600 mb-5">{cfg.note}</p>}

      <div className="card p-4 flex flex-wrap gap-4 items-end mb-5">
        {cfg.params.map((p) => (
          <div key={p.key} className={p.wide ? 'flex-1 min-w-[260px]' : 'w-40'}>
            <label className="label">{p.label}</label>
            {p.type === 'select' ? (
              <select className="input" value={params[p.key]} onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}>
                {p.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : (
              <input type="number" className="input font-mono" value={params[p.key]} onChange={(e) => setParams({ ...params, [p.key]: e.target.value })} />
            )}
          </div>
        ))}
        <button className="btn-brand h-[38px] px-5" onClick={start} disabled={busy}>{busy ? 'Đang chạy…' : 'Chạy thí nghiệm'}</button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 mb-5">
        <MetricCard name="PostgreSQL" dot="bg-royal" engine={cfg.engines.postgres} cfg={cfg} run={run} params={run?.params ?? {}} dbms="postgres" />
        <MetricCard name="Cloud Firestore" dot="bg-orange-500" engine={cfg.engines.firestore} cfg={cfg} run={run} params={run?.params ?? {}} dbms="firestore" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-ink text-white p-5 min-h-[260px]">
          <h2 className="font-bold mb-2">Nhật ký chạy</h2>
          <pre className="font-mono text-sm text-white/70 whitespace-pre-wrap">{log.length ? log.join('\n') : 'Chưa chạy. Bấm "Chạy thí nghiệm" để bắt đầu.'}</pre>
        </div>
        <div className="card p-5 flex flex-col">
          <h2 className="font-bold mb-2">Kết luận cho ngữ cảnh TicketRush</h2>
          <textarea
            className="input flex-1 min-h-[160px] resize-y"
            placeholder="Ghi nhận xét sau khi chạy: DBMS nào phù hợp hơn, vì sao…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex flex-wrap gap-3 mt-3">
            <button className="btn-ghost" onClick={saveRun}>Lưu kết quả lần chạy</button>
            <button className="btn-ghost" onClick={exportCsv}>Xuất CSV cho báo cáo</button>
          </div>
          {msg && <p className="text-xs text-gray-500 mt-2">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
