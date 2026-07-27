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
  process.env.TEST_SUPABASE_SECRET_KEY &&
  process.env.TEST_MAILPIT_URL
    ? {
        url: testUrl,
        publishableKey: process.env.TEST_SUPABASE_PUBLISHABLE_KEY,
        secretKey: process.env.TEST_SUPABASE_SECRET_KEY,
        mailpitUrl: process.env.TEST_MAILPIT_URL,
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
      const { data, error } = await admin.auth.admin.createUser({
        email: user.email,
        password,
        email_confirm: true,
      });
      expect(error).toBeNull();
      expect(data.user).not.toBeNull();
      user.id = data.user!.id;
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
      if (user.id) await admin.auth.admin.deleteUser(user.id);
    }
  });

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

  it('completes the PKCE password recovery flow through local Mailpit', async () => {
    const storage = memoryStorage();
    const recovery = createClient(config!.url, config!.publishableKey, {
      auth: {
        ...authOptions().auth,
        flowType: 'pkce',
        storage,
      },
    });
    const newPassword = `Recovered-${runId}`;

    const { error: requestError } = await recovery.auth.resetPasswordForEmail(
      users.supervisor.email,
      { redirectTo: 'elevatorhandoff://reset-password' },
    );
    expect(requestError).toBeNull();

    const recoveryLink = await waitForRecoveryLink(
      config!.mailpitUrl,
      users.supervisor.email,
    );
    const verifyResponse = await fetch(recoveryLink, { redirect: 'manual' });
    expect(verifyResponse.status).toBeGreaterThanOrEqual(300);
    expect(verifyResponse.status).toBeLessThan(400);
    const redirect = verifyResponse.headers.get('location');
    expect(redirect).not.toBeNull();
    const url = new URL(redirect!);
    expect(`${url.protocol}//${url.hostname}${url.pathname}`).toBe(
      'elevatorhandoff://reset-password',
    );
    const code = url.searchParams.get('code');
    expect(code).not.toBeNull();

    const { error: exchangeError } = await recovery.auth.exchangeCodeForSession(code!);
    expect(exchangeError).toBeNull();
    const { error: updateError } = await recovery.auth.updateUser({ password: newPassword });
    expect(updateError).toBeNull();
    await recovery.auth.signOut({ scope: 'local' });
    await signIn(recovery, users.supervisor.email, newPassword);
  }, 20_000);
});

function authOptions() {
  return { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
}

async function signIn(client: SupabaseClient, email: string, password: string) {
  const { error } = await client.auth.signInWithPassword({ email, password });
  expect(error).toBeNull();
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => void values.set(key, value),
    removeItem: async (key: string) => void values.delete(key),
  };
}

async function waitForRecoveryLink(mailpitUrl: string, email: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const query = new URLSearchParams({ query: `to:${email}`, limit: '1' });
    const response = await fetch(`${mailpitUrl}/api/v1/search?${query}`);
    if (response.ok) {
      const result = await response.json() as {
        messages?: { ID?: string; id?: string }[];
      };
      const id = result.messages?.[0]?.ID ?? result.messages?.[0]?.id;
      if (id) {
        const messageResponse = await fetch(`${mailpitUrl}/api/v1/message/${id}`);
        const message = await messageResponse.json() as { HTML?: string; Text?: string };
        const link = `${message.HTML ?? ''}\n${message.Text ?? ''}`
          .match(/https?:\/\/[^\s"'<>]+\/auth\/v1\/verify[^\s"'<>]*/)?.[0]
          ?.replaceAll('&amp;', '&');
        if (link) return link;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Password recovery email was not captured for ${email}`);
}
