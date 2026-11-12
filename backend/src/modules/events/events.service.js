//[events.service] Phụ trách: TV1 (#1, #8) + TV2 (#2)
import * as repo from './events.repository.js';
import { AppError } from '../../utils/AppError.js';

// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

export async function listGenres(input) {
  return repo.listGenres(input);
}

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

function validateEventBody(body = {}) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION', 'Dữ liệu sự kiện không hợp lệ');
  }

  const {
    genreId,
    venueId,
    eventDate,
    saleOpenAt,
    maxTicketsPerUser = 4,
    status = 'DRAFT',
  } = body;

  if (typeof body.title !== 'string') {
    throw new AppError(400, 'VALIDATION', 'Tên sự kiện phải là chuỗi');
  }

  const title = body.title.trim();

  if (!title || title.length > 200) {
    throw new AppError(
      400,
      'VALIDATION',
      'Tên sự kiện phải có từ 1 đến 200 ký tự',
    );
  }

  for (const [field, value] of Object.entries({ genreId, venueId })) {
    if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
      throw new AppError(
        400,
        'VALIDATION',
        `${field} phải là số nguyên dương hợp lệ`,
      );
    }
  }

  if (
    typeof eventDate !== 'string' ||
    typeof saleOpenAt !== 'string' ||
    !Number.isFinite(Date.parse(eventDate)) ||
    !Number.isFinite(Date.parse(saleOpenAt))
  ) {
    throw new AppError(
      400,
      'VALIDATION',
      'Ngày diễn ra và giờ mở bán phải là ngày giờ hợp lệ',
    );
  }

  if (Date.parse(saleOpenAt) >= Date.parse(eventDate)) {
    throw new AppError(
      400,
      'VALIDATION',
      'Giờ mở bán phải trước ngày diễn ra sự kiện',
    );
  }

  if (
    !Number.isInteger(maxTicketsPerUser) ||
    maxTicketsPerUser < 1 ||
    maxTicketsPerUser > 10
  ) {
    throw new AppError(
      400,
      'VALIDATION',
      'Số vé tối đa mỗi người phải là số nguyên từ 1 đến 10',
    );
  }

  const allowedStatuses = [
    'DRAFT',
    'ON_SALE',
    'SOLD_OUT',
    'CANCELLED',
    'ENDED',
  ];

  if (!allowedStatuses.includes(status)) {
    throw new AppError(400, 'VALIDATION', 'Trạng thái sự kiện không hợp lệ');
  }

  const validatedBody = {
    title,
    genreId,
    venueId,
    eventDate: new Date(eventDate).toISOString(),
    saleOpenAt: new Date(saleOpenAt).toISOString(),
    maxTicketsPerUser,
    status,
  };

  return validatedBody;
}

export async function createEvent({ body }) {
  const validatedBody = validateEventBody(body);

  try {
    return await repo.createEvent({ body: validatedBody });
  } catch (err) {
    if (err.code === '23503') {
      throw new AppError(
        400,
        'VALIDATION',
        'Thể loại hoặc địa điểm không tồn tại',
      );
    }

    throw err;
  }
}

export async function updateEvent({ params, body }) {
  const eventId = params.eventId;

  if (typeof eventId !== 'string' || !/^[0-9]+$/.test(eventId)) {
    throw new AppError(
      400,
      'VALIDATION',
      'eventId phải là số nguyên dương',
    );
  }

  const id = BigInt(eventId);

  if (id < 1n || id > 9223372036854775807n) {
    throw new AppError(
      400,
      'VALIDATION',
      'eventId nằm ngoài phạm vi hợp lệ',
    );
  }

  const validatedBody = validateEventBody(body);

  try {
    const event = await repo.updateEvent({
      params: { eventId },
      body: validatedBody,
    });

    if (!event) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Không tìm thấy sự kiện',
      );
    }

    return event;
  } catch (err) {
    if (err.code === '23503') {
      throw new AppError(
        400,
        'VALIDATION',
        'Thể loại hoặc địa điểm không tồn tại',
      );
    }

    throw err;
  }
}

export async function deleteEvent({ params }) {
  const eventId = params.eventId;

  if (typeof eventId !== 'string' || !/^[0-9]+$/.test(eventId)) {
    throw new AppError(
      400,
      'VALIDATION',
      'eventId phải là số nguyên dương',
    );
  }

  const id = BigInt(eventId);

  if (id < 1n || id > 9223372036854775807n) {
    throw new AppError(
      400,
      'VALIDATION',
      'eventId nằm ngoài phạm vi hợp lệ',
    );
  }

  try {
    const event = await repo.deleteEvent({
      params: { eventId },
    });

    if (!event) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Không tìm thấy sự kiện',
      );
    }

    return { deleted: true, event };
  } catch (err) {
    if (err.code === '23503') {
      throw new AppError(
        409,
        'EVENT_HAS_DEPENDENCIES',
        'Không thể xóa sự kiện đang có đơn hàng hoặc dữ liệu liên quan',
      );
    }

    throw err;
  }
}
