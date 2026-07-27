import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const testUrl = process.env.TEST_SUPABASE_URL;
if (
  testUrl &&
  !['127.0.0.1', 'localhost'].includes(new URL(testUrl).hostname)
) {
  throw new Error('TEST_SUPABASE_URL must point to local Supabase');
}

const config =
  testUrl &&
  process.env.TEST_SUPABASE_PUBLISHABLE_KEY &&
  process.env.TEST_SUPABASE_SECRET_KEY
    ? {
        url: testUrl,
        publishableKey: process.env.TEST_SUPABASE_PUBLISHABLE_KEY,
        secretKey: process.env.TEST_SUPABASE_SECRET_KEY,
      }
    : null;

const integration = config ? describe : describe.skip;

integration('Supabase low-privilege permissions', () => {
  const runId = randomUUID();
  const password = `Integration-${runId}`;
  const users = {
    supervisor: { id: '', email: `supervisor-${runId}@example.test` },
    engineerA: { id: '', email: `engineer-a-${runId}@example.test` },
    engineerB: { id: '', email: `engineer-b-${runId}@example.test` },
  };
  const workOrderId = randomUUID();
  const attachmentId = randomUUID();
  let storagePath = '';
  let admin: SupabaseClient;
  let supervisor: SupabaseClient;
  let engineerA: SupabaseClient;
  let engineerB: SupabaseClient;

  beforeAll(async () => {
    admin = createClient(config!.url, config!.secretKey, authOptions());
    supervisor = createClient(config!.url, config!.publishableKey, authOptions());
    engineerA = createClient(config!.url, config!.publishableKey, authOptions());
    engineerB = createClient(config!.url, config!.publishableKey, authOptions());

    for (const user of Object.values(users)) {
      const result = (await authAdminRequest('/users', {
        method: 'POST',
        body: JSON.stringify({
          email: user.email,
          password,
          email_confirm: true,
        }),
      })) as { id?: string; user?: { id?: string } };
      const userId = result.user?.id ?? result.id;
      expect(userId).toEqual(expect.any(String));
      user.id = userId!;
    }
    storagePath = `work-orders/${users.supervisor.id}/${workOrderId}/${attachmentId}.jpg`;
    const { error: profileError } = await admin.from('profiles').insert([
      {
        id: users.supervisor.id,
        display_name: 'Integration Supervisor',
        role: 'elevator_supervisor',
      },
      {
        id: users.engineerA.id,
        display_name: 'Integration Engineer A',
        role: 'elevator_engineer',
      },
      {
        id: users.engineerB.id,
        display_name: 'Integration Engineer B',
        role: 'elevator_engineer',
      },
    ]);
    expect(profileError).toBeNull();

    await signIn(supervisor, users.supervisor.email, password);
    await signIn(engineerA, users.engineerA.email, password);
    await signIn(engineerB, users.engineerB.email, password);
  });

  afterAll(async () => {
    if (!admin) return;
    await admin.storage.from('work-order-media').remove([storagePath]);
    await admin.from('work_order_attachments').delete().eq('work_order_id', workOrderId);
    await admin.from('work_orders').delete().eq('id', workOrderId);
    for (const user of Object.values(users)) {
      if (user.id) {
        await authAdminRequest(`/users/${user.id}`, { method: 'DELETE' });
      }
    }
  });

  async function authAdminRequest(path: string, init: RequestInit) {
    const response = await fetch(`${config!.url}/auth/v1/admin${path}`, {
      ...init,
      headers: {
        apikey: config!.secretKey,
        Authorization: `Bearer ${config!.secretKey}`,
        'Content-Type': 'application/json',
      },
    });

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Supabase Auth fixture request failed (${response.status}): ${text}`);
    }
    return text ? JSON.parse(text) : null;
  }

  it('enforces assignment isolation and optimistic state transitions', async () => {
    const fixture = await readFile(resolve(process.cwd(), 'tests/fixtures/work-order-photo.jpg'));
    const bytes = fixture.buffer.slice(
      fixture.byteOffset,
      fixture.byteOffset + fixture.byteLength,
    ) as ArrayBuffer;
    const { error: uploadError } = await supervisor.storage
      .from('work-order-media')
      .upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: false });
    expect(uploadError).toBeNull();

    const { data: created, error: createError } = await supervisor
      .rpc('create_work_order', {
        p_id: workOrderId,
        p_elevator_area: 'Integration Area',
        p_elevator_code: `INT-${runId}`,
        p_description: 'Synthetic integration work order',
        p_priority: 'normal',
        p_assignee_id: users.engineerA.id,
        p_attachments: [{ id: attachmentId, path: storagePath, position: 0 }],
      })
      .single();
    expect(createError).toBeNull();
    expect(created).toMatchObject({ id: workOrderId, status: 'assigned', version: 1 });

    const { data: visibleToA } = await engineerA
      .from('work_orders')
      .select('id')
      .eq('id', workOrderId);
    const { data: hiddenFromB } = await engineerB
      .from('work_orders')
      .select('id')
      .eq('id', workOrderId);
    expect(visibleToA).toHaveLength(1);
    expect(hiddenFromB).toHaveLength(0);

    const { error: forbiddenStart } = await engineerB.rpc('start_work_order', {
      p_id: workOrderId,
      p_expected_version: 1,
    });
    expect(forbiddenStart?.message).toBe('NOT_FOUND_OR_FORBIDDEN');

    const { data: started, error: startError } = await engineerA
      .rpc('start_work_order', { p_id: workOrderId, p_expected_version: 1 })
      .single();
    expect(startError).toBeNull();
    expect(started).toMatchObject({ status: 'in_progress', version: 2 });

    const { error: staleClose } = await engineerA.rpc('close_work_order', {
      p_id: workOrderId,
      p_resolution: 'Fixed',
      p_expected_version: 1,
    });
    expect(staleClose?.message).toBe('VERSION_CONFLICT');

    const { data: closed, error: closeError } = await engineerA
      .rpc('close_work_order', {
        p_id: workOrderId,
        p_resolution: ' Fixed and verified ',
        p_expected_version: 2,
      })
      .single();
    expect(closeError).toBeNull();
    expect(closed).toMatchObject({
      status: 'closed',
      resolution: 'Fixed and verified',
      version: 3,
    });
  });
});

function authOptions() {
  return { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
}

async function signIn(client: SupabaseClient, email: string, password: string) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
}
