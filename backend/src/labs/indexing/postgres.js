// TODO [labs/indexing/postgres] Phụ trách: TV2 – Indexing trên PostgreSQL (pg, SQL thuần)
// Kịch bản: Tìm vé theo sự kiện và trạng thái check-in; bật/tắt index; EXPLAIN ANALYZE (PostgreSQL) và Query Explain (Firestore)
// Trả về { metrics: { <tên>: <giá trị> }, details? } – cùng khóa metrics với file còn lại để so sánh.
import { notImplemented } from "../../utils/AppError.js";
import { performance } from "node:perf_hooks";
import { pool } from "../../config/pg.js";

const ALLOWED_STATUSES = new Set(["VALID", "CHECKED_IN"]);

const PLAN_MODES = {
  seqscan: {
    label: "Seq Scan đối chứng",
    settings: {
      enable_seqscan: "on",
      enable_indexscan: "off",
      enable_indexonlyscan: "off",
      enable_bitmapscan: "off",
    },
    note: "Chế độ đối chứng: bật Seq Scan và đặt Index Scan, Index Only Scan, Bitmap Scan ở trạng thái không được khuyến khích trong transaction chỉ đọc. Không xóa index khỏi database.",
  },
  index: {
    label: "Ưu tiên sử dụng Index",
    settings: {
      enable_seqscan: "off",
      enable_indexscan: "on",
      enable_indexonlyscan: "on",
      enable_bitmapscan: "on",
    },
    note: "Khuyến khích planner dùng Index Scan, Index Only Scan hoặc Bitmap Scan; enable_seqscan=off chỉ làm Seq Scan kém ưu tiên, không cấm tuyệt đối.",
  },
};

// Các node thực sự truy cập tuple của bảng. Bitmap Index Scan được hiển thị
// trong scanTypes và indexNames nhưng không cộng vào rowsScanned để tránh đếm
// trùng candidate index entries với Bitmap Heap Scan.
const TABLE_SCAN_TYPES = new Set([
  "Seq Scan",
  "Parallel Seq Scan",
  "Index Scan",
  "Index Only Scan",
  "Bitmap Heap Scan",
  "Tid Scan",
]);

function collectScanStats(node, stats = { rowsScanned: 0, scanTypes: [] }) {
  if (!node || typeof node !== "object") return stats;

  const nodeType = node["Node Type"];
  if (typeof nodeType === "string" && nodeType.includes("Scan")) {
    stats.scanTypes.push(nodeType);
  }

  if (TABLE_SCAN_TYPES.has(nodeType)) {
    const loops = Number(node["Actual Loops"] ?? 1);
    const actual = Number(node["Actual Rows"] ?? 0);
    const removed = Number(node["Rows Removed by Filter"] ?? 0);
    const recheckRemoved = Number(node["Rows Removed by Index Recheck"] ?? 0);
    stats.rowsScanned += Math.round(
      (actual + removed + recheckRemoved) * loops,
    );
  }

  for (const child of node.Plans ?? []) collectScanStats(child, stats);
  return stats;
}

function collectIndexNames(node, names = []) {
  if (!node || typeof node !== "object") return names;
  if (node["Index Name"]) names.push(node["Index Name"]);
  for (const child of node.Plans ?? []) collectIndexNames(child, names);
  return names;
}

function roundMs(value) {
  return Number(value.toFixed(3));
}

export async function run(params = {}) {
  const adapterStartedAt = performance.now();
  const planMode = String(params.planMode ?? "seqscan");
  const mode = PLAN_MODES[planMode];
  const eventId = Number(params.eventId ?? 2);
  const status = String(params.status ?? "VALID").toUpperCase();

  if (!mode) {
    throw new Error("planMode chỉ nhận seqscan hoặc index.");
  }
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    throw new Error("eventId phải là số nguyên dương.");
  }
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error("status chỉ nhận VALID hoặc CHECKED_IN.");
  }

  // Cùng ý nghĩa nghiệp vụ với Firestore validTickets:
  // tìm vé của một sự kiện theo trạng thái check-in.
  const sql = `
    SELECT t.ticket_id, o.event_id, t.status, t.checked_in_at
    FROM orders AS o
    JOIN tickets AS t ON t.order_id = o.order_id
    WHERE o.event_id = $1
      AND t.status = $2::ticket_status
  `;

  // Các mốc đo chỉ nằm trong adapter PostgreSQL của lab Indexing.
  // Không thay đổi labRunner.js hoặc cách đo durationMs dùng chung của nhóm.
  const timings = {
    connectionAcquireMs: 0,
    beginTransactionMs: 0,
    plannerSetupMs: 0,
    explainCallMs: 0,
    resultProcessingMs: 0,
    commitMs: 0,
    rollbackMs: 0,
    clientReleaseMs: 0,
    adapterElapsedMs: 0,
  };

  let client;
  let transactionOpen = false;
  let output;
  let failure;

  try {
    let startedAt = performance.now();
    client = await pool.connect();
    timings.connectionAcquireMs = performance.now() - startedAt;

    startedAt = performance.now();
    await client.query("BEGIN READ ONLY");
    transactionOpen = true;
    timings.beginTransactionMs = performance.now() - startedAt;

    startedAt = performance.now();
    // Các thiết lập chỉ có hiệu lực trong transaction hiện tại.
    // Giá trị lấy từ PLAN_MODES cố định, không nhận trực tiếp SQL từ client.
    for (const [setting, value] of Object.entries(mode.settings)) {
      await client.query(`SET LOCAL ${setting} = ${value}`);
    }
    timings.plannerSetupMs = performance.now() - startedAt;

    startedAt = performance.now();
    const explainResult = await client.query(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`,
      [eventId, status],
    );
    timings.explainCallMs = performance.now() - startedAt;

    startedAt = performance.now();
    const explain = explainResult.rows[0]["QUERY PLAN"][0];
    const root = explain.Plan;
    const stats = collectScanStats(root);
    const scanTypes = [...new Set(stats.scanTypes)];
    const indexNames = [...new Set(collectIndexNames(root))];
    const executionMs = Number(explain["Execution Time"] ?? 0);
    const planningMs = Number(explain["Planning Time"] ?? 0);
    const rowsReturned =
      Number(root["Actual Rows"] ?? 0) * Number(root["Actual Loops"] ?? 1);
    timings.resultProcessingMs = performance.now() - startedAt;

    startedAt = performance.now();
    await client.query("COMMIT");
    transactionOpen = false;
    timings.commitMs = performance.now() - startedAt;

    output = {
      metrics: {
        plan: `${root["Node Type"]} · ${scanTypes.join(" + ") || "Không có scan node"}${indexNames.length ? ` (${indexNames.join(", ")})` : ""}`,
        rowsScanned: stats.rowsScanned,
        rowsReturned,
        executionMs: roundMs(executionMs),
      },
      details: {
        engine: "PostgreSQL",
        eventId,
        status,
        planMode,
        planModeLabel: mode.label,
        note: mode.note,
        plannerSettings: mode.settings,
        planningMs: roundMs(planningMs),
        executionMs: roundMs(executionMs),
        scanTypes,
        indexNames,
        rowsScannedDefinition:
          "Tổng số dòng được ghi nhận tại các node truy cập bảng (Actual Rows + Rows Removed), nhân Actual Loops. Đây là chỉ số ước tính theo plan, không phải số page đọc từ ổ đĩa.",
        timings,
        timingDefinitions: {
          connectionAcquireMs:
            "Thời gian chờ pool cấp một PostgreSQL client; có thể bao gồm mở kết nối mới nếu pool cần tạo connection.",
          beginTransactionMs:
            "Thời gian gọi BEGIN READ ONLY và chờ PostgreSQL phản hồi.",
          plannerSetupMs:
            "Tổng thời gian gửi và chờ phản hồi cho các lệnh SET LOCAL của chế độ planner.",
          explainCallMs:
            "Thời gian Node.js chờ lệnh EXPLAIN ANALYZE trả kết quả; bao gồm planning, execution phía PostgreSQL, giao tiếp giao thức và xử lý kết quả ở tầng pg driver. Không phải thời gian mạng thuần túy.",
          resultProcessingMs:
            "Thời gian JavaScript đọc cấu trúc JSON của plan và tổng hợp metrics/details; không bao gồm thời gian pg driver parse response trước khi query promise hoàn tất.",
          commitMs: "Thời gian gọi COMMIT và chờ PostgreSQL phản hồi.",
          rollbackMs:
            "Thời gian gọi ROLLBACK khi transaction cần được hủy do lỗi.",
          clientReleaseMs: "Thời gian trả client về pool.",
          adapterElapsedMs:
            "Tổng thời gian đo bên trong adapter, từ đầu hàm run đến sau khi trả client về pool. Đây là phép đo riêng của indexing/postgres.js; labRunner.durationMs vẫn được giữ nguyên.",
          planningMs:
            "Thời gian lập kế hoạch do PostgreSQL trả về trong EXPLAIN ANALYZE.",
          executionMs:
            "Thời gian thực thi plan do PostgreSQL trả về trong EXPLAIN ANALYZE.",
        },
        plan: root,
      },
    };
  } catch (error) {
    failure = error;
    if (client && transactionOpen) {
      const startedAt = performance.now();
      try {
        await client.query("ROLLBACK");
      } catch {
        // Giữ nguyên lỗi ban đầu; rollback chỉ là thao tác dọn transaction.
      }
      timings.rollbackMs = performance.now() - startedAt;
      transactionOpen = false;
    }
  } finally {
    if (client) {
      const startedAt = performance.now();
      client.release();
      timings.clientReleaseMs = performance.now() - startedAt;
    }
  }

  timings.adapterElapsedMs = performance.now() - adapterStartedAt;

  if (failure) throw failure;

  // Gán lại timings sau khi COMMIT và release đã hoàn tất để adapterElapsedMs
  // bao gồm cả thời gian trả client về pool.
  output.details.timings = Object.fromEntries(
    Object.entries(timings).map(([key, value]) => [key, roundMs(value)]),
  );

  return output;
}
