// TODO [zones.service] Phụ trách: TV2 (#9)
import { AppError } from "../../utils/AppError.js";
import * as repo from "./zones.repository.js";
import { syncEventSeats, inBackground } from "../sync/sync.repository.js";

const toPositiveInt = (value, field) => {
  const n = Number(value);

  if (!Number.isInteger(n) || n <= 0) {
    throw new AppError(400, "VALIDATION", `${field} phải là số nguyên dương`);
  }

  return n;
};

const toNonNegativeNumber = (value, field) => {
  const n = Number(value);

  if (!Number.isFinite(n) || n < 0) {
    throw new AppError(400, "VALIDATION", `${field} phải là số không âm`);
  }

  return n;
};

const requireId = (value, field) => {
  const id = String(value ?? "");

  if (!/^\d+$/.test(id) || id === "0") {
    throw new AppError(400, "VALIDATION", `${field} không hợp lệ`);
  }

  return id;
};

const requireName = (value) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(400, "VALIDATION", "Tên khu vực không được để trống");
  }

  const name = value.trim();

  if (name.length > 30) {
    throw new AppError(400, "VALIDATION", "Tên khu vực tối đa 30 ký tự");
  }

  return name;
};

// A → B → ... → Z → AA → AB...
const toExcelColumn = (zeroBased) => {
  let n = zeroBased + 1;
  let label = "";

  while (n > 0) {
    const remainder = (n - 1) % 26;

    label = String.fromCharCode(65 + remainder) + label;

    n = Math.floor((n - 1) / 26);
  }

  return label;
};

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [d] #9 – khu vực của sự kiện
export async function listZones({ params }) {
  const eventId = requireId(params.eventId, "eventId");

  return repo.listZones({
    params: { eventId },
  });
  // return repo.listZones(input);
}

// TODO [a] #9 – thêm khu vực + giá vé
export async function createZone({ params, body = {} }) {
  const eventId = requireId(params.eventId, "eventId");
  const name = requireName(body.name);
  const price = toNonNegativeNumber(body.price, "price");
  const capacity = toPositiveInt(body.capacity, "capacity");

  return repo.createZone({
    params: { eventId },
    body: {
      name,
      price,
      capacity,
    },
  });
  // return repo.createZone(input);
}

// TODO [c] #9 – sửa khu vực / giá
export async function updateZone({ params, body = {} }) {
  const zoneId = requireId(params.zoneId, "zoneId");
  const name = requireName(body.name);
  const price = toNonNegativeNumber(body.price, "price");
  const capacity = toPositiveInt(body.capacity, "capacity");
  const current = await repo.getZoneStats(zoneId);

  if (!current) {
    throw new AppError(404, "NOT_FOUND", "Không tìm thấy khu vực");
  }

  if (capacity < current.seat_count) {
    throw new AppError(
      409,
      "CAPACITY_TOO_SMALL",
      `Sức chứa mới (${capacity}) nhỏ hơn số ghế đã tạo (${current.seat_count})`,
    );
  }

  const updated = await repo.updateZone({
    params: { zoneId },
    body: {
      name,
      price,
      capacity,
    },
  });

  if (!updated) {
    throw new AppError(404, "NOT_FOUND", "Không tìm thấy khu vực");
  }

  return updated;
  // return repo.updateZone(input);
}

// TODO [b] #9 – xóa khu vực
export async function deleteZone({ params }) {
  const zoneId = requireId(params.zoneId, "zoneId");
  const current = await repo.getZoneStats(zoneId);

  if (!current) {
    throw new AppError(404, "NOT_FOUND", "Không tìm thấy khu vực");
  }

  // Không cho xóa khu vực đã có vé
  if (current.ticket_count > 0) {
    throw new AppError(
      409,
      "ZONE_HAS_TICKETS",
      "Không thể xóa khu vực đã có vé",
    );
  }

  const deleted = await repo.deleteZone({
    params: { zoneId },
  });

  if (!deleted) {
    throw new AppError(404, "NOT_FOUND", "Không tìm thấy khu vực");
  }

  // Ghế của khu vực đã bị xóa theo (cascade): dọn khỏi sơ đồ ghế realtime
  inBackground("dọn ghế sau khi xóa khu vực", syncEventSeats(Number(current.event_id)));

  return {
    deleted: true,
    zone: deleted,
  };
  // return repo.deleteZone(input);
}

// TODO [a] #9 – sinh ghế cho khu vực (bulk insert)
export async function generateSeats({ params, body = {} }) {
  const zoneId = requireId(params.zoneId, "zoneId");
  const zone = await repo.getZoneStats(zoneId);

  if (!zone) {
    throw new AppError(404, "NOT_FOUND", "Không tìm thấy khu vực");
  }

  // Contract implementation: mặc định 10 ghế/hàng
  const seatsPerRow = toPositiveInt(body.seatsPerRow ?? 10, "seatsPerRow");

  if (seatsPerRow > 50) {
    throw new AppError(400, "VALIDATION", "seatsPerRow tối đa 50");
  }

  const seatRows = Array.from({ length: zone.capacity }, (_, index) => ({
    rowLabel: toExcelColumn(Math.floor(index / seatsPerRow)),
    seatNo: (index % seatsPerRow) + 1,
  }));

  const result = await repo.generateSeats({
    params: { zoneId },
    body: { seatRows },
  });
  // Đẩy ghế mới sang Firestore để khách thấy ngay sơ đồ (không phải chờ admin bấm "Đồng bộ")
  inBackground("đồng bộ ghế sau khi sinh ghế", syncEventSeats(Number(zone.event_id)));
  return result;
  // return repo.generateSeats(input);
}
