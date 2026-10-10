import { AppError } from '../../utils/AppError.js';
import * as repo from './zones.repository.js';

const ensureAdmin = (input) => {
  if (input?.user && input.user.role !== 'ADMIN') {
    throw new AppError(403, 'FORBIDDEN', 'Chỉ admin mới được quản lý khu vực');
  }
};

export async function listZones(input) {
  return repo.listZones(input);
}

export async function createZone(input) {
  ensureAdmin(input);
  return repo.createZone(input);
}

export async function updateZone(input) {
  ensureAdmin(input);
  return repo.updateZone(input);
}

export async function deleteZone(input) {
  ensureAdmin(input);
  return repo.deleteZone(input);
}

export async function generateSeats(input) {
  ensureAdmin(input);
  return repo.generateSeats(input);
}
