import type { AppErrorCode, AppErrorField } from '@/types';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly field?: AppErrorField,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function errorMessage(error: unknown): string {
  if (!isAppError(error)) return '操作失败，请稍后重试。';

  const messages: Partial<Record<AppErrorCode, string>> = {
    AUTH_REQUIRED: '登录已过期，请重新登录。',
    AUTH_INVALID_CREDENTIALS: '邮箱或密码不正确。',
    AUTH_RATE_LIMITED: '操作过于频繁，请稍后再试。',
    AUTH_RECOVERY_EXPIRED: '重置链接已失效，请在当前设备重新发送。',
    ACCOUNT_DISABLED: '账号已停用，请联系管理员。',
    PROFILE_MISSING: '账号资料不完整，请联系管理员。',
    ROLE_FORBIDDEN: '当前账号无权执行此操作。',
    NOT_FOUND_OR_FORBIDDEN: '工单不存在或你无权查看。',
    VALIDATION_FAILED: '请检查填写内容后重试。',
    ENGINEER_INACTIVE: '该工程师已停用，请重新选择。',
    ENGINEER_UNCHANGED: '请选择其他工程师。',
    PHOTO_COUNT_INVALID: '请选择 1–3 张现场照片。',
    PHOTO_TYPE_INVALID: '照片必须转换为 JPEG。',
    PHOTO_SIZE_INVALID: '单张照片不能超过 10 MiB。',
    PHOTO_UPLOAD_FAILED: '照片上传失败，请重试。',
    PHOTO_OBJECT_MISSING: '照片未完整上传，请重新选择。',
    PHOTO_CLEANUP_FAILED: '照片清理失败，请保持网络后重试。',
    INVALID_TRANSITION: '工单状态已变化，请刷新后重试。',
    RESOLUTION_REQUIRED: '请填写处理结果。',
    VERSION_CONFLICT: '工单已被其他人更新，请刷新后重试。',
    IDEMPOTENCY_CONFLICT: '草稿内容与已提交工单不一致。',
    NETWORK_ERROR: '网络连接失败，请检查网络后重试。',
    TIMEOUT: '请求超时，请刷新确认结果。',
  };

  return messages[error.code] ?? '操作失败，请稍后重试。';
}
