// TODO [labs/indexing/firestore] Phụ trách: TV2 – Indexing trên Firestore (Admin SDK)
// Kịch bản: Tìm vé theo sự kiện và trạng thái check-in; bật/tắt index; EXPLAIN ANALYZE (PostgreSQL) và Query Explain (Firestore)
// Trả về { metrics: { <tên>: <giá trị> }, details? } – cùng khóa metrics với file còn lại để so sánh.
import { notImplemented } from "../../utils/AppError.js";
import { firestore } from "../../config/firebase.js";

const ALLOWED_STATUSES = new Set(["VALID", "CHECKED_IN"]);
const ALLOWED_PLAN_MODES = new Set(["seqscan", "index"]);

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function readExplainStats(explain) {
  const metrics = explain?.metrics ?? explain?.queryPlan?.metrics ?? {};
  const executionStats =
    metrics.executionStats ?? metrics.execution_stats ?? {};
  const debugStats =
    executionStats.debugStats ?? executionStats.debug_stats ?? {};
  const scannedCandidates = [
    getPath(debugStats, "documents_scanned"),
    getPath(debugStats, "documentsScanned"),
    getPath(debugStats, "index_entries_scanned"),
    getPath(debugStats, "indexEntriesScanned"),
  ]
    .map((value) => (value == null ? null : Number(value)))
    .filter(Number.isFinite);
  const returned =
    executionStats.resultsReturned ?? executionStats.results_returned;
  const readOperations =
    executionStats.readOperations ?? executionStats.read_operations;
  const duration =
    executionStats.executionDuration ?? executionStats.execution_duration;

  let executionMs = null;
  if (typeof duration === "string") {
    const match = duration.match(/^(\d+(?:\.\d+)?)(ns|us|µs|ms|s)$/);
    if (match) {
      const amount = Number(match[1]);
      executionMs =
        match[2] === "s"
          ? amount * 1000
          : match[2] === "ms"
            ? amount
            : match[2] === "us" || match[2] === "µs"
              ? amount / 1000
              : amount / 1e6;
    }
  }

  return {
    rowsScanned: scannedCandidates.length
      ? scannedCandidates.reduce((sum, value) => sum + value, 0)
      : null,
    rowsReturned: returned == null ? null : Number(returned),
    readOperations: readOperations == null ? null : Number(readOperations),
    executionMs: executionMs == null ? null : Number(executionMs.toFixed(3)),
  };
}

export async function run(params = {}) {
  const planModeRequested = String(params.planMode ?? "seqscan");
  const eventId = Number(params.eventId ?? 2);
  const status = String(params.status ?? "VALID").toUpperCase();

  if (!ALLOWED_PLAN_MODES.has(planModeRequested)) {
    throw new Error("planMode chỉ nhận seqscan hoặc index.");
  }
  if (!Number.isSafeInteger(eventId) || eventId < 1) {
    throw new Error("eventId phải là số nguyên dương.");
  }
  if (!ALLOWED_STATUSES.has(status)) {
    throw new Error("status chỉ nhận VALID hoặc CHECKED_IN.");
  }

  const checkedIn = status === "CHECKED_IN";
  const query = firestore
    .collection("validTickets")
    .where("eventId", "==", String(eventId))
    .where("checkedIn", "==", checkedIn);

  let explainStats = {
    rowsScanned: null,
    rowsReturned: null,
    readOperations: null,
    executionMs: null,
  };
  let explainSupported = false;
  let explainError = null;

  // Thử Query Explain nếu SDK hiện tại hỗ trợ.
  // planModeRequested không điều khiển chỉ mục của Firestore.
  if (typeof query.explain === "function") {
    try {
      const explainResult = await query.explain({ analyze: "true" });
      explainStats = readExplainStats(explainResult);
      explainSupported = true;
    } catch (error) {
      explainError = error.message;
    }
  } else {
    explainError =
      "SDK hiện tại không cung cấp Query Explain cho truy vấn này.";
  }

  const snapshot = await query.get();
  const rowsReturned = snapshot.size;
  if (explainStats.rowsReturned == null)
    explainStats.rowsReturned = rowsReturned;

  return {
    metrics: {
      plan: explainSupported
        ? "Firestore Query Explain · chỉ mục do Firestore quản lý"
        : "Firestore query · chỉ mục tự động; Explain không khả dụng",
      rowsScanned: explainStats.rowsScanned,
      rowsReturned,
      executionMs: explainStats.executionMs,
    },
    details: {
      engine: "Cloud Firestore",
      eventId,
      status,
      checkedIn,
      planModeRequested,
      indexControl:
        "Hai chế độ Seq Scan đối chứng / Ưu tiên Index chỉ điều khiển PostgreSQL. Firestore dùng chỉ mục do Firestore quản lý; cùng một truy vấn Firestore được chạy ở cả hai chế độ.",
      explainSupported,
      explainError,
      readOperations: explainStats.readOperations,
      explainRowsScanned: explainStats.rowsScanned,
      note: "rowsScanned để null nếu Query Explain không cung cấp số liệu; không dùng rowsReturned thay thế cho số document đã quét.",
    },
  };
}
