// Cấu hình giao diện của 6 trang DBMS Lab. Mỗi topic khai báo:
//   params  – ô nhập tham số, gửi lên POST /api/admin/labs/<topic>/run trong body.params
//   metrics – các ô số liệu; value(m, params, run) đọc từ results.<dbms>.metrics do backend trả về
// Khi làm thí nghiệm, người phụ trách topic đổi tên khóa metrics cho khớp với postgres.js / firestore.js
// (hai file đó PHẢI trả cùng khóa). value trả null/undefined → hiện "—".
const ms = (_m, _p, r) => (r.durationMs != null ? r.durationMs + " ms" : null);

export const labConfigs = {
  "data-storage": {
    owner: "TV4",
    title: "Lưu trữ: cùng dữ liệu vé, hai mô hình",
    subtitle:
      'So sánh dung lượng, số lần đọc để dựng trang "vé của tôi" và chi phí ước tính của Firestore.',
    engines: {
      postgres: "Bảng quan hệ, chuẩn hóa",
      firestore: "Document, phi chuẩn hóa",
    },
    params: [
      { key: "tickets", label: "Số vé", type: "number", default: 10000 },
    ],
    metrics: [
      {
        label: "Dung lượng dữ liệu",
        value: (m) =>
          m.storageBytes != null
            ? (m.storageBytes / 1024).toFixed(1) + " KB"
            : null,
      },
      { label: "Số lần đọc (vé của tôi)", value: (m) => m.readsForMyTickets },
      { label: "Chi phí ước tính", value: (m) => m.estimatedCost },
      { label: "Thời gian hoàn tất", value: ms },
    ],
  },
  indexing: {
    owner: "TV2",
    title: "Chỉ mục: tìm vé theo sự kiện và trạng thái check-in",
    subtitle:
      "Tìm vé theo sự kiện và trạng thái check-in. PostgreSQL dùng EXPLAIN ANALYZE; Firestore dùng Query Explain nếu SDK hỗ trợ.",
    engines: {
      postgres: "B-tree · EXPLAIN ANALYZE",
      firestore: "Chỉ mục tự động · Query Explain nếu SDK hỗ trợ",
    },
    params: [
      {
        key: "eventId",
        label: "Mã sự kiện",
        type: "number",
        default: 2,
      },
      {
        key: "status",
        label: "Trạng thái vé",
        type: "select",
        default: "VALID",
        options: [
          ["VALID", "Chưa check-in"],
          ["CHECKED_IN", "Đã check-in"],
        ],
      },
      {
        key: "planMode",
        label: "Chế độ PostgreSQL",
        type: "select",
        default: "seqscan",
        wide: true,
        options: [
          ["seqscan", "1. Seq Scan đối chứng"],
          ["index", "2. Ưu tiên sử dụng Index"],
        ],
      },
    ],
    metrics: [
      { label: "Kế hoạch truy vấn", value: (m) => m.plan },
      { label: "Số dòng / document quét", value: (m) => m.rowsScanned },
      { label: "Số kết quả", value: (m) => m.rowsReturned },
      {
        label: "Thời gian SQL (EXPLAIN ANALYZE)",
        value: (m) => (m.executionMs != null ? m.executionMs + " ms" : null),
      },
      { label: "Thời gian adapter", value: ms },
    ],
  },
  'query-processing': {
    owner: 'TV3',
    title: 'Xử lý truy vấn: báo cáo doanh thu theo khu vực',
    subtitle: 'Cùng câu hỏi "doanh thu từng khu của một sự kiện": PostgreSQL trả lời bằng một câu SQL JOIN + GROUP BY, Firestore không có JOIN và GROUP BY nên phải chọn một trong bốn cách làm.',
    engines: { postgres: 'Một câu SQL JOIN + GROUP BY · EXPLAIN ANALYZE', firestore: 'Không JOIN/GROUP BY · tính phí theo lượt đọc' },
    note: 'Mỗi lần chạy tự sinh dữ liệu thử riêng (VIP, CAT 1, CAT 2, CAT 3; khoảng 8% vé đã hủy) ở cả hai DBMS, đối chiếu kết quả với đáp án tính sẵn rồi dọn sạch. PostgreSQL chạy trong một transaction rồi ROLLBACK. Firestore ghi vào queryLabRuns/{runId} (khoảng 2N lượt ghi, gói miễn phí giới hạn 20.000 lượt ghi/ngày). Số lượt đọc và số lượt gọi mới là số liệu so sánh chính; thời gian Firestore chỉ tham khảo.',
    params: [
      { key: 'tickets', label: 'Số vé của sự kiện', type: 'select', default: '1000', options: [['500', '500 vé'], ['1000', '1.000 vé'], ['2000', '2.000 vé']] },
      {
        key: 'approach', label: 'Cách làm trên Firestore', type: 'select', default: 'C', wide: true,
        options: [
          ['A', 'A. Chuẩn hóa, ứng dụng tự kết khu → ghế → vé'],
          ['B', 'B. Phi chuẩn hóa, đọc hết vé rồi cộng ở ứng dụng'],
          ['C', 'C. Phi chuẩn hóa, mỗi khu một truy vấn count() + sum()'],
          ['D', 'D. Document tổng hợp duy trì sẵn'],
        ],
      },
    ],
    metrics: [
      { label: 'Số truy vấn đã chạy', value: (m) => m.queries },
      { label: 'Số document / dòng đọc', value: (m) => (m.rowsRead == null ? null : Number(m.rowsRead).toLocaleString('vi-VN')) },
      { label: 'Số nhóm kết quả', value: (m) => m.groups },
      { label: 'Tổng doanh thu', value: (m) => (m.revenue == null ? null : Number(m.revenue).toLocaleString('vi-VN') + ' đ') },
      { label: 'Kết quả đúng đáp án', value: (m) => (m.matchesExpected == null ? null : m.matchesExpected ? 'Đúng' : 'SAI') },
      { label: 'Thời gian truy vấn', value: (m) => (m.queryMs == null ? null : m.queryMs + ' ms') },
      { label: 'Kế hoạch / cách làm', value: (m) => m.plan },
      { label: 'Thời gian hoàn tất', value: ms },
    ],
  },
  transaction: {
    owner: "TV1",
    title: "Giao dịch: mua vé và giả lập lỗi thanh toán",
    subtitle:
      "Kiểm tra rollback: khi thanh toán lỗi, ghế và đơn hàng có về đúng trạng thái ban đầu ở cả hai DBMS không.",
    engines: {
      postgres: "ACID · BEGIN/COMMIT/ROLLBACK",
      firestore: "Transaction / batched write",
    },
    params: [
      {
        key: "simulateFailure",
        label: "Giả lập lỗi thanh toán",
        type: "select",
        default: "true",
        options: [
          ["true", "Có (phải rollback)"],
          ["false", "Không (commit)"],
        ],
      },
    ],
    metrics: [
      {
        label: "Đã commit",
        value: (m) =>
          m.committed == null ? null : m.committed ? "Có" : "Không",
      },
      {
        label: "Đã rollback",
        value: (m) =>
          m.rolledBack == null ? null : m.rolledBack ? "Có" : "Không",
      },
      { label: "Bản ghi còn sót", value: (m) => m.leftoverRecords },
      { label: "Thời gian hoàn tất", value: ms },
    ],
  },
  'concurrency-control': {
    owner: 'TV3',
    eyebrow: 'DBMS LAB · CONCURRENCY CONTROL',
    title: 'Giả lập giờ G: nhiều người giành cùng một số vé',
    subtitle: 'N người cùng mua "ghế tốt nhất còn trống" trong M ghế, chạy trên cả hai DBMS với cùng một chiến lược điều khiển đồng thời. Kiểm tra có bán trùng ghế không, bao nhiêu người bị từ chối khi vẫn còn ghế, và mất bao lâu.',
    engines: { postgres: 'MVCC + khóa dòng', firestore: 'Transaction serializable · khóa bi quan (Admin SDK)' },
    note: 'Kết quả đúng: số vé bán ra = số ghế, không bán trùng, không còn ghế trống. Mỗi lần chạy tạo dữ liệu thử riêng (PostgreSQL: bảng lab_cc_*, Firestore: concurrencyLabRuns/{runId}) rồi xóa ngay. Giữa lúc đọc và lúc ghi có 5 ms "suy nghĩ" mô phỏng logic ứng dụng; tối đa 50 người chạy cùng lúc. Firestore đi qua Internet nên thời gian chỉ để tham khảo; chi phí một lần chạy 500 người khoảng vài nghìn lượt đọc/ghi.',
    params: [
      { key: 'users', label: 'Số người mua (2–1000)', type: 'number', default: 200 },
      { key: 'seats', label: 'Số ghế mở bán (1–200)', type: 'number', default: 50 },
      {
        key: 'strategy', label: 'Chiến lược điều khiển đồng thời', type: 'select', default: 'pessimistic', wide: true,
        options: [
          ['none', 'Không khóa: đọc ghế trống rồi ghi (để thấy bán trùng)'],
          ['pessimistic', 'Khóa bi quan: SELECT … FOR UPDATE / runTransaction'],
          ['optimistic', 'Khóa lạc quan: cột version / ghi có điều kiện lastUpdateTime'],
          ['skip', 'Bỏ qua ghế đang khóa: SKIP LOCKED / chọn ngẫu nhiên 1 trong 20 ghế'],
        ],
      },
    ],
    metrics: [
      { label: 'Cách làm', value: (m) => m.method },
      { label: 'Ghế đã bán / mở bán', value: (m, p) => (m.sold != null ? m.sold + ' / ' + p.seats : null) },
      { label: 'Vé phát hành', value: (m) => m.ticketsIssued },
      { label: 'Vé bán trùng ghế', value: (m) => m.duplicates },
      { label: 'Ghế còn trống khi kết thúc', value: (m) => m.seatsLeft },
      { label: 'Người bị từ chối do lỗi / tranh chấp', value: (m) => m.refused },
      { label: 'Xung đột / chạy lại', value: (m) => m.conflicts },
      { label: 'Thời gian chạy', value: (m) => (m.elapsedMs == null ? null : Number(m.elapsedMs).toLocaleString('vi-VN') + ' ms') },
      { label: 'P95 thời gian một người', value: (m) => (m.p95Ms == null ? null : Number(m.p95Ms).toLocaleString('vi-VN') + ' ms') },
    ],
  },
  "backup-recovery": {
    owner: "TV1",
    title: "Sao lưu và phục hồi: xóa nhầm một sự kiện",
    subtitle:
      "Xóa nhầm sự kiện rồi khôi phục: pg_dump/restore và Firestore export/import (hoặc PITR).",
    engines: {
      postgres: "pg_dump / pg_restore",
      firestore: "Export / import · PITR",
    },
    params: [
      {
        key: "seatCount",
        label: "Số ghế của sự kiện thử (1–200)",
        type: "number",
        default: 50,
      },
    ],
    metrics: [
      {
        label: "Thời gian sao lưu",
        value: (m) => (m.backupMs != null ? m.backupMs + " ms" : null),
      },
      {
        label: "Thời gian phục hồi",
        value: (m) => (m.restoreMs != null ? m.restoreMs + " ms" : null),
      },
      { label: "Bản ghi phục hồi được", value: (m) => m.recordsRestored },
      {
        label: "Mất dữ liệu",
        value: (m) => (m.dataLoss == null ? null : m.dataLoss ? "Có" : "Không"),
      },
    ],
  },
};
