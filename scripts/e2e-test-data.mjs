#!/usr/bin/env node

const COMMANDS = new Set(['prepare', 'cleanup', 'self-check']);
const BUCKET = 'work-order-media';
const E2E_CODE_FILTER = 'like.E2E-%';

function requireValue(env, name) {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function validateEnvironment(env) {
  if (env.E2E_ALLOW_TEST_RESET !== 'true') {
    throw new Error('E2E reset is disabled');
  }

  const rawUrl = requireValue(env, 'E2E_SUPABASE_URL');
  const projectRef = requireValue(env, 'E2E_PROJECT_REF');
  const secretKey = requireValue(env, 'E2E_SUPABASE_SECRET_KEY');
  let url;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('E2E Supabase URL is invalid');
  }

  const expectedHostname = `${projectRef}.supabase.co`;
  const isRootUrl =
    url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password;

  if (
    url.protocol !== 'https:' ||
    url.hostname !== expectedHostname ||
    !/^[a-z0-9-]+$/.test(projectRef) ||
    !isRootUrl
  ) {
    throw new Error('E2E Supabase URL and project ref do not match');
  }

  return { baseUrl: url.origin, secretKey };
}

function validateTestUsers(env) {
  const definitions = [
    {
      email: 'MAESTRO_SUPERVISOR_EMAIL',
      password: 'MAESTRO_SUPERVISOR_PASSWORD',
      name: 'MAESTRO_SUPERVISOR_NAME',
      role: 'elevator_supervisor',
      fallbackName: 'E2E 区域主管',
    },
    {
      email: 'MAESTRO_ENGINEER_A_EMAIL',
      password: 'MAESTRO_ENGINEER_A_PASSWORD',
      name: 'MAESTRO_ENGINEER_A_NAME',
      role: 'elevator_engineer',
    },
    {
      email: 'MAESTRO_ENGINEER_B_EMAIL',
      password: 'MAESTRO_ENGINEER_B_PASSWORD',
      name: 'MAESTRO_ENGINEER_B_NAME',
      role: 'elevator_engineer',
    },
  ];

  const users = definitions.map((definition) => {
    const email = requireValue(env, definition.email);
    const password = requireValue(env, definition.password);
    const displayName = definition.fallbackName ?? requireValue(env, definition.name);

    if (!email.includes('@') || password.length < 8) {
      throw new Error('E2E test account configuration is invalid');
    }

    return { email, password, displayName, role: definition.role };
  });
  if (new Set(users.map(({ email }) => email.toLowerCase())).size !== users.length) {
    throw new Error('E2E test account emails must be distinct');
  }
  return users;
}

function createClient(config) {
  const headers = {
    apikey: config.secretKey,
    Authorization: `Bearer ${config.secretKey}`,
    'Content-Type': 'application/json',
  };

  async function request(path, options = {}) {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
    });

    if (!response.ok) {
      throw new Error(`Supabase request failed (${response.status})`);
    }

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  return { request };
}

function restPath(table, params) {
  const search = new URLSearchParams(params);
  return `/rest/v1/${table}?${search}`;
}

async function cleanupData(client) {
  const workOrders =
    (await client.request(
      restPath('work_orders', {
        select: 'id',
        elevator_code: E2E_CODE_FILTER,
      }),
    )) ?? [];

  if (workOrders.length === 0) {
    return { workOrders: 0, attachments: 0 };
  }

  const ids = workOrders.map(({ id }) => id);
  const idFilter = `in.(${ids.join(',')})`;
  const attachments =
    (await client.request(
      restPath('work_order_attachments', {
        select: 'storage_path',
        work_order_id: idFilter,
      }),
    )) ?? [];

  const storagePaths = attachments.map(({ storage_path: storagePath }) => storagePath);
  if (storagePaths.length > 0) {
    await client.request(`/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      body: JSON.stringify({ prefixes: storagePaths }),
    });
  }

  await client.request(
    restPath('work_order_attachments', {
      work_order_id: idFilter,
    }),
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
  );
  await client.request(
    restPath('work_orders', {
      id: idFilter,
      elevator_code: E2E_CODE_FILTER,
    }),
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } },
  );

  return { workOrders: ids.length, attachments: attachments.length };
}

async function listAuthUsers(client) {
  const users = [];

  for (let page = 1; ; page += 1) {
    const result = await client.request(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    const pageUsers = Array.isArray(result) ? result : (result?.users ?? []);
    users.push(...pageUsers);
    if (pageUsers.length < 1000) {
      return users;
    }
  }
}

async function ensureAuthUser(client, existingUsers, definition) {
  const existing = existingUsers.find(
    ({ email }) => email?.toLowerCase() === definition.email.toLowerCase(),
  );
  const body = JSON.stringify({
    email: definition.email,
    password: definition.password,
    email_confirm: true,
    user_metadata: { display_name: definition.displayName },
  });

  if (existing) {
    return client.request(`/auth/v1/admin/users/${existing.id}`, {
      method: 'PUT',
      body,
    });
  }

  return client.request('/auth/v1/admin/users', { method: 'POST', body });
}

async function prepareData(client, definitions) {
  const existingUsers = await listAuthUsers(client);
  const profiles = [];

  for (const definition of definitions) {
    const result = await ensureAuthUser(client, existingUsers, definition);
    const user = result?.user ?? result;
    if (!user?.id) {
      throw new Error('Supabase Auth response did not contain a user id');
    }
    profiles.push({
      id: user.id,
      display_name: definition.displayName,
      role: definition.role,
      is_active: true,
    });
  }

  await client.request('/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(profiles),
  });

  return profiles.length;
}

function assertThrows(action) {
  try {
    action();
  } catch {
    return;
  }
  throw new Error('Safety self-check failed');
}

function selfCheck() {
  const valid = {
    E2E_ALLOW_TEST_RESET: 'true',
    E2E_SUPABASE_URL: 'https://e2eexample.supabase.co',
    E2E_PROJECT_REF: 'e2eexample',
    E2E_SUPABASE_SECRET_KEY: 'test-only-placeholder',
    MAESTRO_ENGINEER_A_EMAIL: 'engineer-a@example.test',
    MAESTRO_ENGINEER_A_NAME: '工程师 A',
    MAESTRO_ENGINEER_A_PASSWORD: 'test-only-a',
    MAESTRO_ENGINEER_B_EMAIL: 'engineer-b@example.test',
    MAESTRO_ENGINEER_B_NAME: '工程师 B',
    MAESTRO_ENGINEER_B_PASSWORD: 'test-only-b',
    MAESTRO_SUPERVISOR_EMAIL: 'supervisor@example.test',
    MAESTRO_SUPERVISOR_PASSWORD: 'test-only-supervisor',
  };

  assertThrows(() => validateEnvironment({}));
  assertThrows(() =>
    validateEnvironment({ ...valid, E2E_PROJECT_REF: 'different-project' }),
  );
  validateEnvironment(valid);
  validateTestUsers(valid);
  assertThrows(() =>
    validateTestUsers({ ...valid, MAESTRO_ENGINEER_B_EMAIL: valid.MAESTRO_ENGINEER_A_EMAIL }),
  );
  console.log('[e2e-test-data] Safety self-check passed');
}

async function main() {
  const command = process.argv[2];
  if (!COMMANDS.has(command)) {
    throw new Error('Usage: e2e-test-data.mjs <prepare|cleanup|self-check>');
  }

  if (command === 'self-check') {
    selfCheck();
    return;
  }

  const config = validateEnvironment(process.env);
  const definitions = command === 'prepare' ? validateTestUsers(process.env) : null;
  const client = createClient(config);
  const cleaned = await cleanupData(client);

  if (command === 'prepare') {
    const accounts = await prepareData(client, definitions);
    console.log(
      `[e2e-test-data] Prepared ${accounts} accounts after cleaning ${cleaned.workOrders} work orders`,
    );
    return;
  }

  console.log(
    `[e2e-test-data] Cleaned ${cleaned.workOrders} work orders and ${cleaned.attachments} attachments`,
  );
}

main().catch((error) => {
  console.error(`[e2e-test-data] ${error instanceof Error ? error.message : 'Unknown failure'}`);
  process.exitCode = 1;
});
