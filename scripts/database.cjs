const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const root = resolve(__dirname, '..');
require('dotenv').config({ path: resolve(root, '.env') });
const action = process.argv[2];
if (!['migrate', 'generate', 'seed'].includes(action))
  throw new Error('Use migrate, generate or seed');
if (action !== 'generate')
  process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
if (!process.env.DATABASE_URL) {
  if (action === 'generate') process.env.DATABASE_URL = 'postgresql://unused@localhost/barberhub';
  else throw new Error('Defina MIGRATION_DATABASE_URL no .env');
}
const cli =
  action === 'seed' ? 'node_modules/tsx/dist/cli.mjs' : 'node_modules/prisma/build/index.js';
const args =
  action === 'seed'
    ? ['apps/api/prisma/seed.ts']
    : action === 'generate'
      ? ['generate', '--schema', 'apps/api/prisma/schema.prisma']
      : ['migrate', 'deploy', '--schema', 'apps/api/prisma/schema.prisma'];
const result = spawnSync(process.execPath, [resolve(root, cli), ...args], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
