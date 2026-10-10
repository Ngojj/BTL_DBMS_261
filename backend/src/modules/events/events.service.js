import { AppError } from '../../utils/AppError.js';
import * as repo from './events.repository.js';

const ensureAdmin = (input) => {
  if (input?.user && input.user.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Chỉ admin mới được quản lý sự kiện');
  }
};

export async function listGenres(input) {
  return repo.listGenres(input);
}

export async function listEvents(input) {
  return repo.listEvents(input);
}

export async function getEvent(input) {
  return repo.getEvent(input);
}

export async function createEvent(input) {
  ensureAdmin(input);
  return repo.createEvent(input);
}

export async function updateEvent(input) {
  ensureAdmin(input);
  return repo.updateEvent(input);
}

export async function deleteEvent(input) {
  ensureAdmin(input);
  return repo.deleteEvent(input);
}
