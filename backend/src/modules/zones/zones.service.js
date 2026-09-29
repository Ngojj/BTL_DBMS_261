// TODO [zones.service] Phụ trách: TV2 (#9)
import * as repo from './zones.repository.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [d] #9 – khu vực của sự kiện
export async function listZones(input) {
  return repo.listZones(input);
}

// TODO [a] #9 – thêm khu vực + giá vé
export async function createZone(input) {
  return repo.createZone(input);
}

// TODO [c] #9 – sửa khu vực / giá
export async function updateZone(input) {
  return repo.updateZone(input);
}

// TODO [b] #9 – xóa khu vực
export async function deleteZone(input) {
  return repo.deleteZone(input);
}

// TODO [a] #9 – sinh ghế cho khu vực (bulk insert)
export async function generateSeats(input) {
  return repo.generateSeats(input);
}
