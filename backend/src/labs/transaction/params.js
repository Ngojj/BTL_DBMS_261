import { AppError } from '../../utils/AppError.js';

// Dùng chung cho HTTP và hai DBMS; "false" không được chuyển bằng Boolean().
export function parseParams(params = {}) {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    throw new AppError(400, 'VALIDATION', 'params phải là một object');
  }
  const raw = params.simulateFailure === undefined ? true : params.simulateFailure;
  if (![true, false, 'true', 'false'].includes(raw)) {
    throw new AppError(400, 'VALIDATION', 'simulateFailure phải là true hoặc false');
  }
  return { simulateFailure: raw === true || raw === 'true' };
}
