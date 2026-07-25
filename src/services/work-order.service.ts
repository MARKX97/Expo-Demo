import { AppError } from '@/lib/app-error';
import { mapSupabaseError } from '@/lib/map-supabase-error';
import { getSupabase } from '@/lib/supabase';
import { createUuid } from '@/lib/uuid';
import { sameDraftPhotos } from '@/lib/validation';
import {
  type CloseWorkOrderInput,
  type CreateWorkOrderInput,
  type ListWorkOrdersInput,
  type ReassignWorkOrderInput,
  type StartWorkOrderInput,
  type UserSummary,
  type WorkOrderAttachment,
  type WorkOrderDetail,
  type WorkOrderListItem,
  type WorkOrderMutationResult,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from '@/types';

const PAGE_SIZE = 20;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const BUCKET = 'work-order-media';
const readSelect = `
  id, elevator_area, elevator_code, description, priority, status,
  assignee_id, version, created_at, updated_at,
  assignee:profiles!work_orders_assignee_id_fkey(id, display_name)
`;
const detailSelect = `
  id, elevator_area, elevator_code, description, priority, status,
  created_by, assignee_id, resolution, version,
  created_at, started_at, closed_at, updated_at,
  creator:profiles!work_orders_created_by_fkey(id, display_name),
  assignee:profiles!work_orders_assignee_id_fkey(id, display_name),
  attachments:work_order_attachments(id, storage_path, mime_type, size_bytes, position)
`;

type SummaryRow = { id: string; display_name: string };
type ListRow = {
  id: string;
  elevator_area: string;
  elevator_code: string;
  description: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assignee_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  assignee: SummaryRow | SummaryRow[];
};
type DetailRow = ListRow & {
  created_by: string;
  resolution: string | null;
  started_at: string | null;
  closed_at: string | null;
  creator: SummaryRow | SummaryRow[];
  attachments: {
    id: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    position: number;
  }[];
};
type MutationRow = {
  id: string;
  status: WorkOrderStatus;
  assignee_id: string;
  resolution: string | null;
  version: number;
  started_at: string | null;
  closed_at: string | null;
  updated_at: string;
};
type DraftAttachment = {
  id: string;
  path: string;
  position: 0 | 1 | 2;
  photoKey: string;
};

const draftAttachments = new Map<string, DraftAttachment[]>();

function firstSummary(value: SummaryRow | SummaryRow[]): UserSummary {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row) throw new AppError('SERVER_ERROR', 'Missing profile summary');
  return { id: row.id, displayName: row.display_name };
}

function mapListItem(row: ListRow): WorkOrderListItem {
  return {
    id: row.id,
    elevatorArea: row.elevator_area,
    elevatorCode: row.elevator_code,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assignee: firstSummary(row.assignee),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMutation(row: MutationRow): WorkOrderMutationResult {
  return {
    id: row.id,
    status: row.status,
    assigneeId: row.assignee_id,
    resolution: row.resolution,
    version: row.version,
    startedAt: row.started_at,
    closedAt: row.closed_at,
    updatedAt: row.updated_at,
  };
}

function withTimeout<T>(operation: PromiseLike<T>, milliseconds: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new AppError('TIMEOUT', 'Request timed out', true)),
      milliseconds,
    );
    Promise.resolve(operation).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function readWithRetry<T>(operation: () => PromiseLike<T>): Promise<T> {
  try {
    return await withTimeout(operation(), 15_000);
  } catch (error) {
    const mapped = mapSupabaseError(error);
    if (!['NETWORK_ERROR', 'TIMEOUT'].includes(mapped.code)) throw mapped;
    try {
      return await withTimeout(operation(), 15_000);
    } catch (retryError) {
      throw mapSupabaseError(retryError);
    }
  }
}

function validateListInput(input: ListWorkOrdersInput): void {
  if (!Number.isInteger(input.page) || input.page < 0) {
    throw new AppError('VALIDATION_FAILED', 'Page must be a non-negative integer');
  }
  if (input.statuses) {
    if (!input.statuses.length || new Set(input.statuses).size !== input.statuses.length) {
      throw new AppError('VALIDATION_FAILED', 'Statuses must be non-empty and unique');
    }
  }
}

async function list(input: ListWorkOrdersInput) {
  validateListInput(input);
  try {
    const response = await readWithRetry(() => {
      let query = getSupabase()
        .from('work_orders')
        .select(readSelect)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(input.page * PAGE_SIZE, input.page * PAGE_SIZE + PAGE_SIZE);
      if (input.statuses) query = query.in('status', [...input.statuses]);
      return query;
    });
    if (response.error) throw response.error;
    const rows = (response.data ?? []) as unknown as ListRow[];
    return {
      items: rows.slice(0, PAGE_SIZE).map(mapListItem),
      page: input.page,
      hasMore: rows.length > PAGE_SIZE,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

async function signedAttachment(
  attachment: DetailRow['attachments'][number],
): Promise<WorkOrderAttachment> {
  try {
    const { data, error } = await readWithRetry(() =>
      getSupabase().storage.from(BUCKET).createSignedUrl(attachment.storage_path, 600),
    );
    if (error) throw error;
    const expiresAt = new Date(Date.now() + 600_000).toISOString();
    return {
      id: attachment.id,
      storagePath: attachment.storage_path,
      mimeType: 'image/jpeg',
      sizeBytes: attachment.size_bytes,
      position: attachment.position as 0 | 1 | 2,
      signedUrl: data.signedUrl,
      signedUrlExpiresAt: expiresAt,
    };
  } catch {
    return {
      id: attachment.id,
      storagePath: attachment.storage_path,
      mimeType: 'image/jpeg',
      sizeBytes: attachment.size_bytes,
      position: attachment.position as 0 | 1 | 2,
      signedUrl: null,
      signedUrlExpiresAt: null,
    };
  }
}

async function getById(id: string): Promise<WorkOrderDetail> {
  try {
    const response = await readWithRetry(() =>
      getSupabase().from('work_orders').select(detailSelect).eq('id', id).maybeSingle(),
    );
    if (response.error) throw response.error;
    if (!response.data) throw new AppError('NOT_FOUND_OR_FORBIDDEN', 'Work order unavailable');
    const row = response.data as unknown as DetailRow;
    const attachments = await Promise.all(
      [...row.attachments].sort((a, b) => a.position - b.position).map(signedAttachment),
    );
    return {
      ...mapListItem(row),
      createdBy: firstSummary(row.creator),
      assigneeId: row.assignee_id,
      resolution: row.resolution,
      startedAt: row.started_at,
      closedAt: row.closed_at,
      attachments,
    };
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

function validateCreate(input: CreateWorkOrderInput): void {
  if (
    !input.elevatorArea.trim() ||
    !input.elevatorCode.trim() ||
    !input.description.trim() ||
    !input.assigneeId
  ) {
    throw new AppError('VALIDATION_FAILED', 'Missing required work order field');
  }
  if (input.photos.length < 1 || input.photos.length > 3) {
    throw new AppError('PHOTO_COUNT_INVALID', 'Photo count must be 1–3', false, 'photos');
  }
  for (const photo of input.photos) {
    if (photo.mimeType !== 'image/jpeg') {
      throw new AppError('PHOTO_TYPE_INVALID', 'Only JPEG is supported', false, 'photos');
    }
    if (photo.sizeBytes > MAX_PHOTO_BYTES) {
      throw new AppError('PHOTO_SIZE_INVALID', 'Photo exceeds 10 MiB', false, 'photos');
    }
  }
}

function attachmentsFor(input: CreateWorkOrderInput, userId: string): DraftAttachment[] {
  const existing = draftAttachments.get(input.id);
  const photoKeys = input.photos.map((photo) => `${photo.uri}:${photo.sizeBytes}`);
  if (existing) {
    if (!sameDraftPhotos(existing.map((item) => item.photoKey), photoKeys)) {
      throw new AppError('IDEMPOTENCY_CONFLICT', 'Draft photos changed');
    }
    return existing;
  }
  const created = photoKeys.map((photoKey, position) => {
    const id = createUuid();
    return {
      id,
      path: `work-orders/${userId}/${input.id}/${id}.jpg`,
      position: position as 0 | 1 | 2,
      photoKey,
    };
  });
  draftAttachments.set(input.id, created);
  return created;
}

async function cleanup(paths: string[]): Promise<void> {
  if (!paths.length) return;
  try {
    const { error } = await withTimeout(getSupabase().storage.from(BUCKET).remove(paths), 30_000);
    if (error) throw error;
  } catch (error) {
    throw new AppError('PHOTO_CLEANUP_FAILED', mapSupabaseError(error).message, true, 'photos');
  }
}

async function uploadPhotos(
  input: CreateWorkOrderInput,
  attachments: DraftAttachment[],
): Promise<string[]> {
  const uploaded: string[] = [];
  try {
    for (const [index, attachment] of attachments.entries()) {
      const response = await fetch(input.photos[index].uri);
      if (!response.ok) throw new AppError('PHOTO_UPLOAD_FAILED', 'Cannot read local photo', true);
      const bytes = await response.arrayBuffer();
      const { error } = await withTimeout(
        getSupabase().storage.from(BUCKET).upload(attachment.path, bytes, {
          contentType: 'image/jpeg',
          upsert: false,
        }),
        60_000,
      );
      if (error && !/duplicate/i.test(error.message)) throw error;
      uploaded.push(attachment.path);
    }
    return uploaded;
  } catch (error) {
    await cleanup(uploaded);
    draftAttachments.delete(input.id);
    const mapped = mapSupabaseError(error);
    throw new AppError('PHOTO_UPLOAD_FAILED', mapped.message, true, 'photos');
  }
}

async function createRpc(input: CreateWorkOrderInput, attachments: DraftAttachment[]) {
  const response = await withTimeout(
    getSupabase()
      .rpc('create_work_order', {
        p_id: input.id,
        p_elevator_area: input.elevatorArea.trim(),
        p_elevator_code: input.elevatorCode.trim(),
        p_description: input.description.trim(),
        p_priority: input.priority,
        p_assignee_id: input.assigneeId,
        p_attachments: attachments.map(({ id, path, position }) => ({ id, path, position })),
      })
      .single(),
    15_000,
  );
  if (response.error) throw response.error;
  return response.data;
}

async function create(input: CreateWorkOrderInput): Promise<WorkOrderDetail> {
  validateCreate(input);
  const { data: userResult, error: userError } = await getSupabase().auth.getUser();
  if (userError) throw mapSupabaseError(userError);
  if (!userResult.user) throw new AppError('AUTH_REQUIRED', 'No authenticated user');

  const attachments = attachmentsFor(input, userResult.user.id);
  const uploaded = await uploadPhotos(input, attachments);
  let rpcConfirmed = false;
  try {
    try {
      await createRpc(input, attachments);
    } catch (error) {
      const mapped = mapSupabaseError(error);
      if (!['NETWORK_ERROR', 'TIMEOUT'].includes(mapped.code)) throw mapped;
      await createRpc(input, attachments);
    }
    rpcConfirmed = true;
    const detail = await getById(input.id);
    draftAttachments.delete(input.id);
    return detail;
  } catch (error) {
    const mapped = mapSupabaseError(error);
    if (!rpcConfirmed && !['NETWORK_ERROR', 'TIMEOUT'].includes(mapped.code)) {
      await cleanup(uploaded);
      draftAttachments.delete(input.id);
    }
    throw mapped;
  }
}

async function runMutation(
  name: 'reassign_work_order' | 'start_work_order' | 'close_work_order',
  params: Record<string, string | number>,
): Promise<WorkOrderMutationResult> {
  try {
    const { data, error } = await withTimeout(getSupabase().rpc(name, params).single(), 15_000);
    if (error) throw error;
    return mapMutation(data as unknown as MutationRow);
  } catch (error) {
    throw mapSupabaseError(error);
  }
}

function reassign(input: ReassignWorkOrderInput) {
  return runMutation('reassign_work_order', {
    p_id: input.id,
    p_assignee_id: input.assigneeId,
    p_expected_version: input.expectedVersion,
  });
}

function start(input: StartWorkOrderInput) {
  return runMutation('start_work_order', {
    p_id: input.id,
    p_expected_version: input.expectedVersion,
  });
}

function close(input: CloseWorkOrderInput) {
  const resolution = input.resolution.trim();
  if (!resolution) {
    return Promise.reject(new AppError('RESOLUTION_REQUIRED', 'Resolution is required', false, 'resolution'));
  }
  return runMutation('close_work_order', {
    p_id: input.id,
    p_resolution: resolution,
    p_expected_version: input.expectedVersion,
  });
}

export const workOrderService = { list, getById, create, reassign, start, close };
