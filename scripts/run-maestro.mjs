#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const mappings = [
  ['SUPERVISOR_EMAIL', 'MAESTRO_SUPERVISOR_EMAIL'],
  ['SUPERVISOR_PASSWORD', 'MAESTRO_SUPERVISOR_PASSWORD'],
  ['ENGINEER_A_EMAIL', 'MAESTRO_ENGINEER_A_EMAIL'],
  ['ENGINEER_A_PASSWORD', 'MAESTRO_ENGINEER_A_PASSWORD'],
  ['ENGINEER_B_EMAIL', 'MAESTRO_ENGINEER_B_EMAIL'],
  ['ENGINEER_B_PASSWORD', 'MAESTRO_ENGINEER_B_PASSWORD'],
  ['ENGINEER_A_NAME', 'MAESTRO_ENGINEER_A_NAME'],
  ['ENGINEER_B_NAME', 'MAESTRO_ENGINEER_B_NAME'],
];

function resolveArguments(environment) {
  return mappings.flatMap(([flowName, sourceName]) => {
    const value = environment[sourceName]?.trim();
    if (!value) throw new Error(`Missing required environment variable: ${sourceName}`);
    return ['-e', `${flowName}=${value}`];
  });
}

if (process.argv[2] === '--self-check') {
  const fake = Object.fromEntries(mappings.map(([, sourceName]) => [sourceName, `test-${sourceName}`]));
  const args = resolveArguments(fake);
  if (args.length !== mappings.length * 2 || args.includes('undefined')) throw new Error('Maestro mapping self-check failed');
  console.log('[run-maestro] Mapping self-check passed');
  process.exit(0);
}

const flowArgs = process.argv.slice(2);
if (flowArgs.length === 0) {
  throw new Error('Usage: run-maestro.mjs [maestro test arguments and flow paths]');
}

const result = spawnSync(process.env.MAESTRO_BIN ?? 'maestro', ['test', ...resolveArguments(process.env), ...flowArgs], {
  stdio: 'inherit',
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
