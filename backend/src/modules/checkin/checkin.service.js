// [checkin.service] #7 soát vé. Phụ trách: TV5
import * as repo from './checkin.repository.js';

// [d] danh sách vé hợp lệ của sự kiện
export async function listValidTickets(input) {
  return repo.listValidTickets(input);
}

// [c] đồng bộ các lượt soát (Firestore) về PostgreSQL
export async function syncCheckins(input) {
  return repo.syncCheckins(input);
}
