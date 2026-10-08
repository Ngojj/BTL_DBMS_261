// Cấu hình giao diện của 6 trang DBMS Lab. Mỗi topic khai báo:
//   params  – ô nhập tham số, gửi lên POST /api/admin/labs/<topic>/run trong body.params
//   metrics – các ô số liệu; value(m, params, run) đọc từ results.<dbms>.metrics do backend trả về
// Khi làm thí nghiệm, người phụ trách topic đổi tên khóa metrics cho khớp với postgres.js / firestore.js
// (hai file đó PHẢI trả cùng khóa). value trả null/undefined → hiện "—".
const ms = (_m, _p, r) => (r.durationMs != null ? r.durationMs + ' ms' : null);

export const labConfigs = {
  'data-storage': {
    owner: 'TV4',
    title: 'Lưu trữ: cùng dữ liệu vé, hai mô hình',
    subtitle: 'So sánh dung lượng, số lần đọc để dựng trang "vé của tôi" và chi phí ước tính của Firestore.',
    engines: { postgres: 'Bảng quan hệ, chuẩn hóa', firestore: 'Document, phi chuẩn hóa' },
    params: [{ key: 'tickets', label: 'Số vé', type: 'number', default: 10000 }],
    metrics: [
      { label: 'Dung lượng dữ liệu', value: (m) => m.storageBytes != null ? (m.storageBytes / 1024).toFixed(1) + ' KB' : null },
      { label: 'Số lần đọc (vé của tôi)', value: (m) => m.readsForMyTickets },
      { label: 'Chi phí ước tính', value: (m) => m.estimatedCost },
      { label: 'Thời gian hoàn tất', value: ms },
    ],
  },
  indexing: {
    owner: 'TV2',
    title: 'Chỉ mục: tìm đơn hàng nhanh hay chậm',
    subtitle: 'Tìm đơn theo email, sự kiện, trạng thái; bật/tắt chỉ mục và xem kế hoạch truy vấn (EXPLAIN ANALYZE / Query Explain).',
    engines: { postgres: 'B-tree · EXPLAIN ANALYZE', firestore: 'Chỉ mục tự động · Query Explain' },
    params: [{ key: 'useIndex', label: 'Chỉ mục', type: 'select', default: 'true', options: [['true', 'Bật'], ['false', 'Tắt']] }],
    metrics: [
      { label: 'Kế hoạch truy vấn', value: (m) => m.plan },
      { label: 'Số dòng / document quét', value: (m) => m.rowsScanned },
      { label: 'Số kết quả', value: (m) => m.rowsReturned },
      { label: 'Thời gian hoàn tất', value: ms },
    ],
  },
  'query-processing': {
    owner: 'TV3',
    title: 'Xử lý truy vấn: báo cáo doanh thu theo khu vực',
    subtitle: 'Một câu SQL JOIN + GROUP BY so với cách gom dữ liệu phía ứng dụng trên Firestore.',
    engines: { postgres: 'Một câu SQL JOIN + GROUP BY', firestore: 'Nhiều truy vấn + gom phía client' },
    params: [{ key: 'eventId', label: 'Mã sự kiện', type: 'number', default: 1 }],
    metrics: [
      { label: 'Số truy vấn đã chạy', value: (m) => m.queries },
      { label: 'Số document / dòng đọc', value: (m) => m.rowsRead },
      { label: 'Số nhóm kết quả', value: (m) => m.groups },
      { label: 'Thời gian hoàn tất', value: ms },
    ],
  },
  transaction: {
    owner: 'TV1',
    title: 'Giao dịch: mua vé và giả lập lỗi thanh toán',
    subtitle: 'Kiểm tra rollback: khi thanh toán lỗi, ghế và đơn hàng có về đúng trạng thái ban đầu ở cả hai DBMS không.',
    engines: { postgres: 'ACID · BEGIN/COMMIT/ROLLBACK', firestore: 'Transaction / batched write' },
    params: [{ key: 'simulateFailure', label: 'Giả lập lỗi thanh toán', type: 'select', default: 'true', options: [['true', 'Có (phải rollback)'], ['false', 'Không (commit)']] }],
    metrics: [
      { label: 'Đã commit', value: (m) => (m.committed == null ? null : m.committed ? 'Có' : 'Không') },
      { label: 'Đã rollback', value: (m) => (m.rolledBack == null ? null : m.rolledBack ? 'Có' : 'Không') },
      { label: 'Bản ghi còn sót', value: (m) => m.leftoverRecords },
      { label: 'Thời gian hoàn tất', value: ms },
    ],
  },
  'concurrency-control': {
    owner: 'TV5',
    eyebrow: 'DBMS LAB · CONCURRENCY CONTROL',
    title: 'Giả lập giờ G: nhiều người giành cùng một số vé',
    subtitle: 'Cùng kịch bản, cùng dữ liệu, chạy lần lượt trên hai DBMS. Kiểm tra có bán trùng ghế không và cái giá phải trả.',
    engines: { postgres: 'MVCC + khóa dòng', firestore: 'Transaction serializable' },
    params: [
      { key: 'users', label: 'Số người mua', type: 'number', default: 500 },
      { key: 'seats', label: 'Số vé mở bán', type: 'number', default: 50 },
      {
        key: 'strategy', label: 'Chiến lược điều khiển đồng thời', type: 'select', default: 'pessimistic', wide: true,
        options: [
          ['pessimistic', 'Khóa bi quan (SELECT … FOR UPDATE / transaction server)'],
          ['optimistic', 'Khóa lạc quan (cột version, kiểm tra khi commit)'],
          ['none', 'Không khóa (để thấy lỗi bán trùng)'],
        ],
      },
    ],
    metrics: [
      { label: 'Vé bán ra / mở bán', value: (m, p) => (m.sold != null ? m.sold + ' / ' + p.seats : null) },
      { label: 'Ghế bị bán trùng', value: (m) => m.duplicates },
      { label: 'Xung đột / thử lại', value: (m) => m.conflicts },
      { label: 'Thời gian hoàn tất', value: ms },
    ],
  },
  'backup-recovery': {
    owner: 'TV1',
    title: 'Sao lưu và phục hồi: xóa nhầm một sự kiện',
    subtitle: 'Xóa nhầm sự kiện rồi khôi phục: pg_dump/restore và Firestore export/import (hoặc PITR).',
    engines: { postgres: 'pg_dump / pg_restore', firestore: 'Export / import · PITR' },
    params: [{ key: 'eventId', label: 'Mã sự kiện bị xóa', type: 'number', default: 1 }],
    metrics: [
      { label: 'Thời gian sao lưu', value: (m) => (m.backupMs != null ? m.backupMs + ' ms' : null) },
      { label: 'Thời gian phục hồi', value: (m) => (m.restoreMs != null ? m.restoreMs + ' ms' : null) },
      { label: 'Bản ghi phục hồi được', value: (m) => m.recordsRestored },
      { label: 'Mất dữ liệu', value: (m) => (m.dataLoss == null ? null : m.dataLoss ? 'Có' : 'Không') },
    ],
  },
};
