// TODO [zones.service] Phụ trách: TV2 (#9)
import * as repo from './zones.repository.js';

export async function listZones(input) {
  return repo.listZones(input);
}

// TODO [a] #9 – danh sách ghế cho khu vực
export async function listSeats(input) {
  return repo.listSeats(input);
}
