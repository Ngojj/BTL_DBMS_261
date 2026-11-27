// TODO [labs/transaction/postgres] Phụ trách: TV1 – Transaction trên PostgreSQL (pg, SQL thuần)
// Kịch bản: Luồng mua vé; nút giả lập lỗi thanh toán để thấy rollback ở hai bên
// Trả về { metrics: { <tên>: <giá trị> }, details? } – cùng khóa metrics với file còn lại để so sánh.
import { notImplemented } from '../../utils/AppError.js';

export async function run(params = {}) {
  void params;
  throw notImplemented('labs.transaction.postgres');
}
