// [#11] Phát hiện tài khoản gom vé: vượt giới hạn, nhiều tài khoản chung số điện thoại (loại g: subquery). Phụ trách: TV3
import { adminApi } from '../api/adminApi.js';
import { useAsync } from '../lib/useAsync.js';
import { ErrorBox, Loading, PageHeader, Pill } from '../components/ui.jsx';

export default function AdminSuspiciousPage() {
  const list = useAsync(() => adminApi.suspicious(), []);
  return (
    <div>
      <PageHeader title="Phát hiện gom vé" subtitle="Tài khoản vượt giới hạn vé hoặc dùng chung số điện thoại." />
      <ErrorBox error={list.error} />
      {list.loading && <Loading />}
      {list.data && list.data.length === 0 && <p className="text-gray-500">Không phát hiện tài khoản đáng ngờ.</p>}
      {list.data && list.data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Tài khoản</th><th className="th">Số điện thoại</th><th className="th">Lý do</th><th className="th text-right">Số vé</th></tr></thead>
            <tbody>
              {list.data.map((u) => (
                <tr key={u.userId}>
                  <td className="td font-bold">{u.email}</td>
                  <td className="td font-mono">{u.phone}</td>
                  <td className="td"><Pill tone="orange">{u.reason}</Pill></td>
                  <td className="td text-right">{u.ticketCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
