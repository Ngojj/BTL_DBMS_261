// [#11] Phát hiện tài khoản gom vé: vượt giới hạn, nhiều tài khoản chung số điện thoại, mua đủ giới hạn ở nhiều sự kiện
// (loại g: subquery). Phụ trách: TV3
import { useMemo, useState } from 'react';
import { adminApi } from '../api/adminApi.js';
import { useAsync } from '../lib/useAsync.js';
import { ErrorBox, Loading, PageHeader, Pill } from '../components/ui.jsx';

const LEVELS = { HIGH: ['red', 'Cao'], MEDIUM: ['orange', 'Theo dõi'] };
const SIGNAL_LABEL = {
  OVER_LIMIT: 'Vượt giới hạn',
  GROUP_OVER_LIMIT: 'Nhóm vượt giới hạn',
  SHARED_PHONE: 'Chung số điện thoại',
  REPEAT_AT_LIMIT: 'Đủ giới hạn nhiều sự kiện',
};

export default function AdminSuspiciousPage() {
  const list = useAsync(() => adminApi.suspicious(), []);
  const [filter, setFilter] = useState('ALL'); // ALL | HIGH | MEDIUM

  const counts = useMemo(() => ({
    ALL: list.data?.length ?? 0,
    HIGH: list.data?.filter((u) => u.level === 'HIGH').length ?? 0,
    MEDIUM: list.data?.filter((u) => u.level === 'MEDIUM').length ?? 0,
  }), [list.data]);
  const rows = (list.data ?? []).filter((u) => filter === 'ALL' || u.level === filter);

  // Gom các tài khoản chung số điện thoại thành một nhóm để admin thấy chúng liên quan nhau
  const phoneGroups = useMemo(() => {
    const g = {};
    for (const u of list.data ?? []) if (u.sharedPhoneAccounts > 1) (g[u.phone] ??= []).push(u.email);
    return g;
  }, [list.data]);

  return (
    <div>
      <PageHeader
        title="Phát hiện gom vé"
        subtitle="Các dấu hiệu cần quản trị viên kiểm tra, không phải kết luận gian lận. Chỉ tính vé còn hiệu lực của đơn đã thanh toán."
        action={<button className="btn-ghost" disabled={list.loading} onClick={list.reload}>Làm mới</button>}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {[['ALL', 'Tất cả'], ['HIGH', 'Mức cao'], ['MEDIUM', 'Theo dõi']].map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={'rounded-full px-5 py-2 text-sm font-bold border ' + (filter === k ? 'bg-ink text-white border-ink' : 'bg-white border-black/15 hover:bg-black/5')}
          >
            {label} ({counts[k]})
          </button>
        ))}
      </div>

      <ErrorBox error={list.error} />
      {list.loading && !list.data && <Loading />}
      {list.data && rows.length === 0 && <p className="text-gray-500">Không phát hiện tài khoản đáng ngờ.</p>}

      {rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className="th">Mức</th><th className="th">Tài khoản</th><th className="th">Số điện thoại</th>
                <th className="th">Dấu hiệu</th><th className="th text-right">Vé</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.userId} className="align-top">
                  <td className="td"><Pill tone={LEVELS[u.level][0]}>{LEVELS[u.level][1]}</Pill></td>
                  <td className="td">
                    <p className="font-bold">{u.email}</p>
                    <p className="text-xs text-gray-500">{u.fullName}</p>
                  </td>
                  <td className="td">
                    <p className="font-mono">{u.phone}</p>
                    {phoneGroups[u.phone] && (
                      <p className="text-xs text-gray-500 mt-1">
                        Cùng nhóm: {phoneGroups[u.phone].filter((e) => e !== u.email).join(', ')}
                      </p>
                    )}
                  </td>
                  <td className="td">
                    <ul className="space-y-1.5">
                      {u.signals.map((s, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-bold">{SIGNAL_LABEL[s.type] ?? s.type}:</span> {s.text}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="td text-right font-bold">{u.ticketCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <details className="mt-6 text-sm text-gray-600">
        <summary className="cursor-pointer font-bold">Cách phát hiện</summary>
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li><b>Vượt giới hạn:</b> một tài khoản mua nhiều hơn số vé tối đa của sự kiện.</li>
          <li><b>Nhóm vượt giới hạn:</b> nhiều tài khoản chung số điện thoại mà tổng vé cho một sự kiện vượt giới hạn của một người (mức cao).</li>
          <li><b>Chung số điện thoại:</b> từ 2 tài khoản khách hàng trở lên dùng cùng số, chưa có bằng chứng mua vượt (theo dõi).</li>
          <li><b>Đủ giới hạn nhiều sự kiện:</b> mua đủ số vé tối đa ở từ 3 sự kiện trở lên (theo dõi).</li>
        </ul>
      </details>
    </div>
  );
}
