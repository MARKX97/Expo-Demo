import type { CreateWorkOrderInput, WorkOrderPriority } from '@/types';

export type WorkOrderFormValues = Pick<
  CreateWorkOrderInput,
  'elevatorArea' | 'elevatorCode' | 'description' | 'assigneeId' | 'photos'
> & { priority: WorkOrderPriority };

export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? null : '请输入有效的工作邮箱。';
}

export function validatePassword(password: string): string | null {
  return password.length >= 8 ? null : '密码至少需要 8 位。';
}

export function validateWorkOrder(values: WorkOrderFormValues): string | null {
  if (!values.elevatorArea.trim()) return '请填写电梯区域。';
  if (!values.elevatorCode.trim()) return '请填写梯号或设备编号。';
  if (!values.description.trim()) return '请填写故障描述。';
  if (!values.assigneeId) return '请选择接手工程师。';
  if (values.photos.length < 1 || values.photos.length > 3) return '请选择 1–3 张现场照片。';
  return null;
}

export function validateResolution(resolution: string): string | null {
  const length = resolution.trim().length;
  if (!length) return '请填写处理结果。';
  if (length > 2000) return '处理结果不能超过 2000 字。';
  return null;
}

export function sameDraftPhotos(
  existing: readonly string[],
  incoming: readonly string[],
): boolean {
  return existing.length === incoming.length
    && existing.every((photo, index) => photo === incoming[index]);
}
