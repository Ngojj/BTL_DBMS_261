// [#11] Phát hiện tài khoản gom vé: vượt giới hạn, nhiều tài khoản chung số điện thoại (loại g: subquery). Phụ trách: TV3
import { api } from '../api/client.js';
import { useAsync } from '../lib/useAsync.js';
import { ErrorBox, Loading, PageHeader, Pill } from '../components/ui.jsx';

export default function AdminSuspiciousPage() {
  // Dữ liệu kiểm tra tài khoản phải lấy từ API thật, không thay bằng danh sách mẫu.
  const list = useAsync(() => api('/admin/reports/suspicious-accounts'), []);
  return (
    <div>
      <PageHeader
        title="Phát hiện gom vé"
        subtitle="Kiểm tra giới hạn vé theo từng sự kiện và số điện thoại dùng chung giữa các tài khoản khách hàng."
        action={<button className="btn-brand" disabled={list.loading} onClick={list.reload}>Làm mới</button>}
      />
      <p className="text-sm text-gray-500 mb-4">Các dấu hiệu cần quản trị viên kiểm tra, không phải kết luận gian lận. Số vé chỉ tính vé còn hiệu lực thuộc đơn đã thanh toán.</p>
      <ErrorBox error={list.error} />
      {list.loading && <Loading />}
      {!list.loading && list.data && list.data.length === 0 && <p className="text-gray-500">Không phát hiện tài khoản đáng ngờ.</p>}
      {!list.loading && list.data && list.data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full">
            <thead><tr><th className="th">Tài khoản</th><th className="th">Số điện thoại</th><th className="th">Lý do</th><th className="th text-right">Tổng vé còn hiệu lực</th></tr></thead>
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
