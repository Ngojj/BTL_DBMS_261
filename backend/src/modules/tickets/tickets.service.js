// TODO [tickets.service] Phụ trách: TV5 (#6)
import * as repo from './tickets.repository.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [f] #6 – vé của tôi: JOIN tickets/orders/seats/zones/events
export async function listMyTickets(input) {
  return repo.listMyTickets(input);
}
