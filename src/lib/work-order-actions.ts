import type { UserRole, WorkOrderStatus } from '@/types';

export type WorkOrderAction = 'reassign' | 'start' | 'close';

export function availableWorkOrderActions(
  role: UserRole,
  status: WorkOrderStatus,
): readonly WorkOrderAction[] {
  if (role === 'elevator_supervisor') return status === 'assigned' ? ['reassign'] : [];
  if (status === 'assigned') return ['start'];
  return status === 'in_progress' ? ['close'] : [];
}
