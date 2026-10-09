// Các mảnh giao diện nhỏ dùng chung

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  const msg = error.code === 'NOT_IMPLEMENTED' ? 'Chức năng này backend chưa hiện thực (501).' : error.message ?? String(error);
  return <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3 border border-red-200">{msg}</div>;
}

export function Loading({ text = 'Đang tải…' }) {
  return <p className="text-gray-500 py-8 text-center">{text}</p>;
}

export function Field({ label, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export function Pill({ tone = 'gray', children }) {
  const tones = {
    gray: 'bg-gray-100 text-gray-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-700',
    orange: 'bg-orange-100 text-brand',
    blue: 'bg-indigo-100 text-royal',
  };
  return <span className={'inline-block rounded-full px-3 py-1 text-xs font-bold ' + tones[tone]}>{children}</span>;
}
