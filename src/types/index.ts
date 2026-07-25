export type UUID = string;
export type IsoDateTime = string;
export type UserRole = 'elevator_supervisor' | 'elevator_engineer';
export type WorkOrderStatus = 'assigned' | 'in_progress' | 'closed';
export type WorkOrderPriority = 'normal' | 'urgent';
export type AuthEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'PASSWORD_RECOVERY'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED';

export type AuthStateListener = (event: AuthEvent, hasSession: boolean) => void;

export interface Profile {
  id: UUID;
  displayName: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthContext {
  userId: UUID;
  email: string;
  profile: Profile;
}

export interface UserSummary {
  id: UUID;
  displayName: string;
}

export type EngineerOption = UserSummary;

export interface WorkOrderListItem {
  id: UUID;
  elevatorArea: string;
  elevatorCode: string;
  description: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignee: EngineerOption;
  version: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface WorkOrderAttachment {
  id: UUID;
  storagePath: string;
  mimeType: 'image/jpeg';
  sizeBytes: number;
  position: 0 | 1 | 2;
  signedUrl: string | null;
  signedUrlExpiresAt: IsoDateTime | null;
}

export interface WorkOrderDetail extends WorkOrderListItem {
  createdBy: UserSummary;
  assigneeId: UUID;
  resolution: string | null;
  startedAt: IsoDateTime | null;
  closedAt: IsoDateTime | null;
  attachments: WorkOrderAttachment[];
}

export interface WorkOrderPage {
  items: WorkOrderListItem[];
  page: number;
  hasMore: boolean;
  fetchedAt: IsoDateTime;
}

export interface WorkOrderMutationResult {
  id: UUID;
  status: WorkOrderStatus;
  assigneeId: UUID;
  resolution: string | null;
  version: number;
  startedAt: IsoDateTime | null;
  closedAt: IsoDateTime | null;
  updatedAt: IsoDateTime;
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface LocalPhoto {
  uri: string;
  mimeType: 'image/jpeg';
  sizeBytes: number;
}

export interface CreateWorkOrderInput {
  id: UUID;
  elevatorArea: string;
  elevatorCode: string;
  description: string;
  priority: WorkOrderPriority;
  assigneeId: UUID;
  photos: readonly LocalPhoto[];
}

export interface ListWorkOrdersInput {
  statuses?: readonly WorkOrderStatus[];
  page: number;
}

export interface ReassignWorkOrderInput {
  id: UUID;
  assigneeId: UUID;
  expectedVersion: number;
}

export interface StartWorkOrderInput {
  id: UUID;
  expectedVersion: number;
}

export interface CloseWorkOrderInput {
  id: UUID;
  resolution: string;
  expectedVersion: number;
}

export type AppErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_RECOVERY_EXPIRED'
  | 'ACCOUNT_DISABLED'
  | 'PROFILE_MISSING'
  | 'ROLE_FORBIDDEN'
  | 'NOT_FOUND_OR_FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'ENGINEER_INACTIVE'
  | 'ENGINEER_UNCHANGED'
  | 'PHOTO_COUNT_INVALID'
  | 'PHOTO_TYPE_INVALID'
  | 'PHOTO_SIZE_INVALID'
  | 'PHOTO_UPLOAD_FAILED'
  | 'PHOTO_OBJECT_MISSING'
  | 'PHOTO_CLEANUP_FAILED'
  | 'INVALID_TRANSITION'
  | 'RESOLUTION_REQUIRED'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'SERVER_ERROR';

export type AppErrorField = 'email' | 'password' | 'assigneeId' | 'photos' | 'resolution';
