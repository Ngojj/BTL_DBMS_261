// TODO [sync.service] Phụ trách: TV5 (đồng bộ PostgreSQL → Firestore)
import * as repo from './sync.repository.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [-] Đồng bộ lại toàn bộ trạng thái ghế của một sự kiện
export async function resyncEvent(input) {
  return repo.resyncEvent(input);
}

// TODO [-] Đồng bộ lại toàn bộ (events, seats, validTickets)
export async function resyncAll(input) {
  return repo.resyncAll(input);
}
