// TODO [reviews.service] Phụ trách: TV1 (giả định – brief chưa phân công)
import * as repo from "./reviews.repository.js";
import { AppError } from "../../utils/AppError.js";
// Nghiệp vụ + điều phối transaction. Không viết SQL ở đây (SQL nằm trong repository).

export async function listReviews({ params }) {
  const eventId = params.eventId;

  if (typeof eventId !== "string" || !/^[0-9]+$/.test(eventId)) {
    throw new AppError(400, "VALIDATION", "eventId phải là số nguyên dương");
  }

  const id = BigInt(eventId);

  if (id < 1n || id > 9223372036854775807n) {
    throw new AppError(400, "VALIDATION", "eventId nằm ngoài phạm vi hợp lệ");
  }

  return repo.listReviews({ params: { eventId } });
}

export async function reviewSummary({ params }) {
  const eventId = params.eventId;

  if (typeof eventId !== "string" || !/^[0-9]+$/.test(eventId)) {
    throw new AppError(400, "VALIDATION", "eventId phải là số nguyên dương");
  }

  const id = BigInt(eventId);

  if (id < 1n || id > 9223372036854775807n) {
    throw new AppError(400, "VALIDATION", "eventId nằm ngoài phạm vi hợp lệ");
  }

  return repo.reviewSummary({ params: { eventId } });
}
export async function createReview({ user, params, body = {} }) {
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

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(
      400,
      'VALIDATION',
      'Dữ liệu đánh giá không hợp lệ',
    );
  }

  const { rating, comment = '' } = body;

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new AppError(
      400,
      'VALIDATION',
      'Điểm đánh giá phải là số nguyên từ 1 đến 5',
    );
  }

  if (typeof comment !== 'string' || comment.length > 500) {
    throw new AppError(
      400,
      'VALIDATION',
      'Nội dung đánh giá phải là chuỗi tối đa 500 ký tự',
    );
  }

  try {
    return await repo.createReview({
      user,
      params: { eventId },
      body: {
        rating,
        comment: comment.trim(),
      },
    });
  } catch (err) {
    if (
      err.code === '23505' &&
      err.constraint === 'reviews_user_id_event_id_key'
    ) {
      throw new AppError(
        409,
        'REVIEW_EXISTS',
        'Bạn đã đánh giá sự kiện này',
      );
    }

    if (
      err.code === '23503' &&
      err.constraint === 'reviews_event_id_fkey'
    ) {
      throw new AppError(
        404,
        'NOT_FOUND',
        'Không tìm thấy sự kiện',
      );
    }

    if (
      err.code === '23503' &&
      err.constraint === 'reviews_user_id_fkey'
    ) {
      throw new AppError(
        401,
        'USER_NOT_FOUND',
        'Tài khoản không còn tồn tại',
      );
    }

    throw err;
  }
}
