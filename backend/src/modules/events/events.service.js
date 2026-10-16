// TODO [events.service] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import * as repo from './events.repository.js';
import { AppError } from '../../utils/AppError.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

// TODO [d] #1 – danh sách thể loại
export async function listGenres(input) {
  return repo.listGenres(input);
}

// TODO [d,e] #1 lọc theo thể loại [d]; #2 lọc thành phố + khoảng ngày + khoảng giá [e]
export async function listEvents(input) {
  const query = { ...input.query };

  if (query.genreId !== undefined) {
    const raw = query.genreId;

    if (typeof raw !== 'string' || !/^[0-9]+$/.test(raw)) {
      throw new AppError(
        400,
        'VALIDATION',
        'genreId phải là số nguyên dương',
      );
    }

    const genreId = Number(raw);

    if (!Number.isInteger(genreId) || genreId < 1 || genreId > 2147483647) {
      throw new AppError(
        400,
        'VALIDATION',
        'genreId nằm ngoài phạm vi hợp lệ',
      );
    }

    query.genreId = genreId;
  }

  return repo.listEvents({ ...input, query });
}

// TODO [d] Chi tiết sự kiện + các khu vực
export async function getEvent(input) {
  const eventId = input.params.eventId;

  // Check the format before calling BigInt().
  if (typeof eventId !== 'string' || !/^[0-9]+$/.test(eventId)) {
    throw new AppError(
      400,
      'VALIDATION',
      'eventId phải là số nguyên dương',
    );
  }

  // event_id is PostgreSQL BIGINT.
  const id = BigInt(eventId);

  if (id < 1n || id > 9223372036854775807n) {
    throw new AppError(
      400,
      'VALIDATION',
      'eventId nằm ngoài phạm vi hợp lệ',
    );
  }

  const event = await repo.getEvent(input);

  if (!event) {
    throw new AppError(
      404,
      'NOT_FOUND',
      'Không tìm thấy sự kiện',
    );
  }

  return event;
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
