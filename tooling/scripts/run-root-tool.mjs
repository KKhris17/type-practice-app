import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolingRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const projectRoot = path.resolve(toolingRoot, '..');
const mode = process.argv[2];
const binaryName = mode === 'lint' ? 'oxlint' : mode === 'format' ? 'oxfmt' : null;

if (!binaryName) {
  console.error('Usage: node scripts/run-root-tool.mjs <lint|format>');
  process.exit(2);
}

const binary = path.join(
  toolingRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? `${binaryName}.cmd` : binaryName,
);
const args =
  mode === 'lint'
    ? [
        '--config',
        'config/oxlint.json',
        '--ignore-pattern',
        'frontend/ui/**',
        '--ignore-pattern',
        'frontend/hooks/use-mobile.ts',
        'app',
        'backend',
        'database',
        'frontend',
        'shared',
        'tests',
        'tooling/scripts',
        'tooling/vite.config.ts',
      ]
    : [
        '--config',
        'config/oxfmt.json',
        'README.md',
        'app',
        'backend',
        'config',
        'database',
        'docs',
        'frontend',
        'public',
        'shared',
        'tests',
        'tooling/components.json',
        'tooling/package.json',
        'tooling/tsconfig.json',
        'tooling/vite.config.ts',
        'tooling/scripts',
        ...process.argv.slice(3),
      ];

const result = spawnSync(binary, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
