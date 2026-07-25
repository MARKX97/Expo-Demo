import { AppError, isAppError } from '@/lib/app-error';
import type { AppErrorCode } from '@/types';

const businessCodes = new Set<AppErrorCode>([
  'AUTH_REQUIRED',
  'ACCOUNT_DISABLED',
  'PROFILE_MISSING',
  'ROLE_FORBIDDEN',
  'NOT_FOUND_OR_FORBIDDEN',
  'VALIDATION_FAILED',
  'ENGINEER_INACTIVE',
  'ENGINEER_UNCHANGED',
  'PHOTO_COUNT_INVALID',
  'PHOTO_TYPE_INVALID',
  'PHOTO_SIZE_INVALID',
  'PHOTO_UPLOAD_FAILED',
  'PHOTO_OBJECT_MISSING',
  'PHOTO_CLEANUP_FAILED',
  'INVALID_TRANSITION',
  'RESOLUTION_REQUIRED',
  'VERSION_CONFLICT',
  'IDEMPOTENCY_CONFLICT',
]);

function errorRecord(error: unknown): Record<string, unknown> {
  return typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
}

export function mapSupabaseError(error: unknown): AppError {
  if (isAppError(error)) return error;

  const record = errorRecord(error);
  const message = typeof record.message === 'string' ? record.message : '';
  const status = typeof record.status === 'number' ? record.status : 0;
  if (businessCodes.has(message as AppErrorCode)) {
    return new AppError(message as AppErrorCode, message, message === 'VERSION_CONFLICT');
  }
  if (status === 401 || /jwt.*expired|not authenticated/i.test(message)) {
    return new AppError('AUTH_REQUIRED', message);
  }
  if (status === 429 || /rate limit/i.test(message)) {
    return new AppError('AUTH_RATE_LIMITED', message, true);
  }
  if (/invalid login credentials/i.test(message)) {
    return new AppError('AUTH_INVALID_CREDENTIALS', message, false, 'password');
  }
  if (/network|fetch failed|failed to fetch/i.test(message) || error instanceof TypeError) {
    return new AppError('NETWORK_ERROR', message, true);
  }
  return new AppError('SERVER_ERROR', message || 'Unknown Supabase error', true);
}
