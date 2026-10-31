import { Link } from 'react-router-dom';

const LABS = [
  {
    path: '/lab/data-storage',
    title: '1. Data Storage & Management',
    tag: 'Chuẩn hóa vs Denormalize',
    color: 'border-blue-200 hover:border-blue-400 bg-blue-50/20',
    badgeColor: 'bg-blue-100 text-blue-800',
    desc: 'So sánh kích thước bảng lưu trữ và số lần đọc (document reads vs SQL JOIN 6 bảng) khi hiển thị vé của người dùng.',
  },
  {
    path: '/lab/indexing',
    title: '2. Indexing & Optimization',
    tag: 'B-Tree Scan vs Composite Index',
    color: 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/20',
    badgeColor: 'bg-indigo-100 text-indigo-800',
    desc: 'Thực nghiệm EXPLAIN ANALYZE với B-Tree index scan trên PostgreSQL và cơ chế Single-field / Composite index trên Firestore.',
  },
  {
    path: '/lab/query-processing',
    title: '3. Query Processing & Reports',
    tag: 'Engine Group By vs App Aggregation',
    color: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/20',
    badgeColor: 'bg-emerald-100 text-emerald-800',
    desc: 'Báo cáo doanh thu theo khu vực (JOIN + GROUP BY + HAVING): so sánh xử lý tại Database Engine với tính toán in-memory tại Node.js.',
  },
  {
    path: '/lab/transaction',
    title: '4. Transaction Management & ACID',
    tag: 'Commit vs Rollback',
    color: 'border-purple-200 hover:border-purple-400 bg-purple-50/20',
    badgeColor: 'bg-purple-100 text-purple-800',
    desc: 'Kiểm chứng tính chất Nguyên tử (Atomicity) khi hoàn thành thanh toán hoặc giả lập phát sinh sự cố thẻ để quan sát ROLLBACK.',
  },
  {
    path: '/lab/concurrency-control',
    title: '5. Concurrency Control (Giờ G)',
    tag: 'Race Condition vs Locking',
    color: 'border-rose-200 hover:border-rose-400 bg-rose-50/20',
    badgeColor: 'bg-rose-100 text-rose-800',
    desc: 'Mô phỏng N người tranh mua M vé đồng thời: quan sát lỗi bán trùng ghế (Overbooking) khi không khóa vs giải pháp FOR UPDATE và OCC.',
  },
  {
    path: '/lab/backup-recovery',
    title: '6. Backup & Recovery',
    tag: 'Disaster Recovery & PITR',
    color: 'border-cyan-200 hover:border-cyan-400 bg-cyan-50/20',
    badgeColor: 'bg-cyan-100 text-cyan-800',
    desc: 'Quy trình tạo bản snapshot, giả lập sự cố xóa nhầm sự kiện và khôi phục nguyên trạng. Đo lường chỉ số RTO và RPO.',
  },
];

export default function LabHubPage() {
  return (
    <div className="space-y-8">
      <header>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-100 text-indigo-800 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            DBMS Lab Trung Tâm
          </span>
          <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-semibold">
            6 / 6 Thí Nghiệm
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-extrabold text-gray-950">
          Module Thí Nghiệm So Sánh PostgreSQL & Cloud Firestore
        </h1>
        <p className="mt-2 text-sm text-gray-600 max-w-3xl">
          Nền tảng thực nghiệm đối chiếu trực tiếp giữa Hệ quản trị CSDL Quan hệ (PostgreSQL 16) và CSDL NoSQL Document (Cloud Firestore) phục vụ báo cáo bài tập lớn.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {LABS.map((lab) => (
          <Link
            key={lab.path}
            to={lab.path}
            className={`group rounded-2xl border p-6 shadow-sm transition hover:shadow-md flex flex-col justify-between ${lab.color} bg-white`}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${lab.badgeColor}`}>
                  {lab.tag}
                </span>
                <span className="text-gray-400 group-hover:text-indigo-600 transition font-bold">→</span>
              </div>
              <h2 className="text-lg font-bold text-gray-900 group-hover:text-indigo-700 transition">
                {lab.title}
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                {lab.desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-gray-100 text-xs font-semibold text-indigo-600 group-hover:underline">
              Vào làm thí nghiệm &amp; xem biểu đồ
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

