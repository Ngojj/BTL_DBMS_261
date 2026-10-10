// TODO [labs/concurrency-control/postgres] Phụ trách: TV5 – Concurrency control trên PostgreSQL (pg, SQL thuần)
// Kịch bản: "Giả lập giờ G": N người (mặc định 500) giành M vé (mặc định 50); đo số vé bán, bán trùng, xung đột/thử lại, thời gian; có biến thể "không khóa"
// Trả về { metrics: { <tên>: <giá trị> }, details? } – cùng khóa metrics với file còn lại để so sánh.
import { notImplemented } from '../../utils/AppError.js';

export async function run(params = {}) {
  void params;
  throw notImplemented('labs.concurrencyControl.postgres');
}
