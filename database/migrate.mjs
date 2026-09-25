import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const toolingRoot = path.join(projectRoot, 'tooling');
const migrationsDir = path.join(projectRoot, 'database', 'migrations');
const localD1Dir = path.join(
  toolingRoot,
  '.wrangler',
  'state',
  'v3',
  'd1',
  'miniflare-D1DatabaseObject',
);
const wranglerBin = path.join(
  toolingRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'wrangler.cmd' : 'wrangler',
);

function migrationNames() {
  if (!existsSync(migrationsDir)) return [];

  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort();
}

function appliedMigrationNames() {
  if (!existsSync(localD1Dir)) return null;

  const databaseFiles = readdirSync(localD1Dir).filter(
    (name) => name.endsWith('.sqlite') && name !== 'metadata.sqlite',
  );

  for (const databaseFile of databaseFiles) {
    let database;
    try {
      database = new DatabaseSync(path.join(localD1Dir, databaseFile), {
        readOnly: true,
      });
      const migrationTable = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'",
        )
        .get();

      if (!migrationTable) continue;

      return new Set(
        database
          .prepare('SELECT name FROM d1_migrations ORDER BY id')
          .all()
          .map((row) => row.name),
      );
    } catch {
      // Let Wrangler perform the authoritative migration check below.
    } finally {
      database?.close();
    }
  }

  return null;
}

const expectedMigrations = migrationNames();
const appliedMigrations = appliedMigrationNames();
const databaseIsCurrent =
  appliedMigrations !== null &&
  expectedMigrations.every((name) => appliedMigrations.has(name));

if (databaseIsCurrent) {
  console.log(
    `✅ Local database is up to date (${expectedMigrations.length} migrations).`,
  );
  process.exit(0);
}

console.log('Checking pending local database migrations…');

const result = spawnSync(
  wranglerBin,
  [
    'd1',
    'migrations',
    'apply',
    'site-creator-d1',
    '--local',
    '--config',
    'database/wrangler.migrations.jsonc',
    '--persist-to',
    'tooling/.wrangler/state',
  ],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      WRANGLER_WRITE_LOGS: 'false',
      WRANGLER_LOG_PATH: path.join(toolingRoot, '.wrangler', 'logs'),
      MINIFLARE_REGISTRY_PATH: path.join(toolingRoot, '.wrangler', 'registry'),
    },
  },
);

process.exit(result.status ?? 1);
