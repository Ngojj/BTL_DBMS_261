// Bảng kết quả hai cột: PostgreSQL | Firestore. Hàng = khóa metrics (union của hai bên).
export default function LabResultTable({ run }) {
  const { postgres, firestore } = run.results;
  const keys = [...new Set([...Object.keys(postgres.metrics ?? {}), ...Object.keys(firestore.metrics ?? {})])];
  const cell = (r, k) => (r.ok ? String(r.metrics?.[k] ?? '—') : '—');

  return (
    <table className="w-full border text-sm">
      <thead className="bg-gray-100">
        <tr><th className="p-2 text-left">Chỉ số</th><th className="p-2 text-left">PostgreSQL</th><th className="p-2 text-left">Firestore</th></tr>
      </thead>
      <tbody>
        <tr className="border-t"><td className="p-2">Thời gian (ms)</td><td className="p-2">{postgres.durationMs}</td><td className="p-2">{firestore.durationMs}</td></tr>
        {keys.map((k) => (
          <tr key={k} className="border-t"><td className="p-2">{k}</td><td className="p-2">{cell(postgres, k)}</td><td className="p-2">{cell(firestore, k)}</td></tr>
        ))}
        {(postgres.error || firestore.error) && (
          <tr className="border-t text-red-600"><td className="p-2">Lỗi</td><td className="p-2">{postgres.error}</td><td className="p-2">{firestore.error}</td></tr>
        )}
      </tbody>
    </table>
  );
}
