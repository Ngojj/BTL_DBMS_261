// TODO [events.service] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import * as repo from './events.repository.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [d] #1 – danh sách thể loại
export async function listGenres(input) {
  return repo.listGenres(input);
}

// TODO [d,e] #1 lọc theo thể loại [d]; #2 lọc thành phố + khoảng ngày + khoảng giá [e]
export async function listEvents(input) {
  return repo.listEvents(input);
}

// TODO [d] Chi tiết sự kiện + các khu vực
export async function getEvent(input) {
  return repo.getEvent(input);
}

// TODO [a] #8 – thêm sự kiện
export async function createEvent(input) {
  return repo.createEvent(input);
}

// TODO [c] #8 – sửa sự kiện
export async function updateEvent(input) {
  return repo.updateEvent(input);
}

// TODO [b] #8 – xóa sự kiện
export async function deleteEvent(input) {
  return repo.deleteEvent(input);
}
