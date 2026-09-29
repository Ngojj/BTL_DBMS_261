// TODO [ConcurrencyControlLabPage] Phụ trách: TV5 – DBMS Lab: Concurrency control
// Kịch bản: "Giả lập giờ G": N người (mặc định 500) giành M vé (mặc định 50); đo số vé bán, bán trùng, xung đột/thử lại, thời gian; có biến thể "không khóa"
import LabPage from '../../components/lab/LabPage.jsx';

export default function ConcurrencyControlLabPage() {
  return (
    <LabPage
      topic="concurrency-control"
      title="Concurrency control"
      scenario="&quot;Giả lập giờ G&quot;: N người (mặc định 500) giành M vé (mặc định 50); đo số vé bán, bán trùng, xung đột/thử lại, thời gian; có biến thể &quot;không khóa&quot;"
    />
  );
}
