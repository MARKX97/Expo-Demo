import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getSupabase } from '@/lib/supabase';
import { workOrderService } from '@/services/work-order.service';
import type { CreateWorkOrderInput } from '@/types';

jest.mock('@/lib/supabase', () => ({ getSupabase: jest.fn() }));

const mockedGetSupabase = jest.mocked(getSupabase);
const fetchMock = jest.fn<(...args: unknown[]) => Promise<unknown>>();

function input(id: string, photoCount = 1): CreateWorkOrderInput {
  return {
    id,
    elevatorArea: 'A 区',
    elevatorCode: 'E-01',
    description: '门机异常',
    priority: 'normal',
    assigneeId: '00000000-0000-4000-8000-000000000002',
    photos: Array.from({ length: photoCount }, (_, index) => ({
      uri: `file:///photo-${index}.jpg`,
      mimeType: 'image/jpeg' as const,
      sizeBytes: 128,
    })),
  };
}

function fakeSupabase() {
  const upload = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const remove = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const rpcSingle = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const detailSingle = jest.fn<(...args: unknown[]) => Promise<unknown>>();
  const client = {
    auth: {
      getUser: jest.fn<(...args: unknown[]) => Promise<unknown>>().mockResolvedValue({
        data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
        error: null,
      }),
    },
    storage: {
      from: jest.fn(() => ({
        upload,
        remove,
        createSignedUrl: jest.fn(),
      })),
    },
    rpc: jest.fn(() => ({ single: rpcSingle })),
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ maybeSingle: detailSingle })),
      })),
    })),
  };
  mockedGetSupabase.mockReturnValue(client as never);
  return { client, upload, remove, rpcSingle, detailSingle };
}

function expectCode(code: string) {
  return expect.objectContaining({ code });
}

describe('WorkOrderService create compensation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('cleans the first upload when the second upload fails', async () => {
    const api = fakeSupabase();
    api.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'upload failed' } });
    api.remove.mockResolvedValue({ error: null });

    await expect(workOrderService.create(input('draft-partial', 2)))
      .rejects.toEqual(expectCode('PHOTO_UPLOAD_FAILED'));

    expect(api.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^work-orders\/.+\/draft-partial\/.+\.jpg$/),
    ]);
    expect(api.client.rpc).not.toHaveBeenCalled();
  });

  it('retains a failed cleanup so cancelDraft can retry it', async () => {
    const api = fakeSupabase();
    api.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'upload failed' } });
    api.remove
      .mockResolvedValueOnce({ error: { message: 'remove failed' } })
      .mockResolvedValueOnce({ error: null });

    await expect(workOrderService.create(input('draft-cleanup', 2)))
      .rejects.toEqual(expectCode('PHOTO_CLEANUP_FAILED'));
    await expect(workOrderService.cancelDraft('draft-cleanup')).resolves.toBeUndefined();

    expect(api.remove).toHaveBeenLastCalledWith([
      expect.stringMatching(/^work-orders\/.+\/draft-cleanup\/.+\.jpg$/),
      expect.stringMatching(/^work-orders\/.+\/draft-cleanup\/.+\.jpg$/),
    ]);
    await workOrderService.cancelDraft('draft-cleanup');
    expect(api.remove).toHaveBeenCalledTimes(2);
  });

  it('cleans uploaded photos after an explicit RPC rejection', async () => {
    const api = fakeSupabase();
    api.upload.mockResolvedValue({ error: null });
    api.remove.mockResolvedValue({ error: null });
    api.rpcSingle.mockResolvedValue({ data: null, error: { message: 'ENGINEER_INACTIVE' } });

    await expect(workOrderService.create(input('draft-rpc')))
      .rejects.toEqual(expectCode('ENGINEER_INACTIVE'));
    expect(api.remove).toHaveBeenCalledWith([
      expect.stringMatching(/^work-orders\/.+\/draft-rpc\/.+\.jpg$/),
    ]);
  });

  it('reuses the same paths after an unknown RPC result', async () => {
    const api = fakeSupabase();
    api.upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'Duplicate object' } });
    api.remove.mockResolvedValue({ error: null });
    api.rpcSingle
      .mockResolvedValueOnce({ data: null, error: { message: 'network failed' } })
      .mockResolvedValueOnce({ data: null, error: { message: 'network failed' } })
      .mockResolvedValueOnce({ data: { id: 'draft-retry' }, error: null });
    api.detailSingle.mockResolvedValue({
      data: {
        id: 'draft-retry',
        elevator_area: 'A 区',
        elevator_code: 'E-01',
        description: '门机异常',
        priority: 'normal',
        status: 'assigned',
        assignee_id: '00000000-0000-4000-8000-000000000002',
        version: 1,
        created_at: '2026-07-27T00:00:00.000Z',
        updated_at: '2026-07-27T00:00:00.000Z',
        created_by: '00000000-0000-4000-8000-000000000001',
        resolution: null,
        started_at: null,
        closed_at: null,
        creator: { id: '00000000-0000-4000-8000-000000000001', display_name: '主管' },
        assignee: { id: '00000000-0000-4000-8000-000000000002', display_name: '工程师' },
        attachments: [],
      },
      error: null,
    });

    await expect(workOrderService.create(input('draft-retry')))
      .rejects.toEqual(expectCode('NETWORK_ERROR'));
    const firstPath = api.upload.mock.calls[0][0];
    expect(api.remove).not.toHaveBeenCalled();

    await expect(workOrderService.create(input('draft-retry'))).resolves.toMatchObject({
      id: 'draft-retry',
      status: 'assigned',
    });
    expect(api.upload.mock.calls[1][0]).toBe(firstPath);
    expect(api.remove).not.toHaveBeenCalled();
  });
});
