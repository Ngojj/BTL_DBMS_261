// TODO [TransactionLabPage] Phụ trách: TV1 – DBMS Lab: Transaction
// Kịch bản: Luồng mua vé; nút giả lập lỗi thanh toán để thấy rollback ở hai bên
import LabPage from '../../components/lab/LabPage.jsx';

export default function TransactionLabPage() {
  return (
    <LabPage
      topic="transaction"
      title="Transaction"
      scenario="Luồng mua vé; nút giả lập lỗi thanh toán để thấy rollback ở hai bên"
    />
  );
}
