import {
  lstatSync,
  realpathSync,
  symlinkSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolingRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const projectRoot = path.resolve(toolingRoot, '..');

function ensureDirectoryLink(linkPath, targetPath) {
  let existing;
  try {
    existing = lstatSync(linkPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  if (existing) {
    if (
      existing.isSymbolicLink() &&
      realpathSync(linkPath) === realpathSync(targetPath)
    ) {
      return;
    }
    throw new Error(
      `Cannot create workspace link: ${linkPath} already exists and points elsewhere.`,
    );
  }

  const target =
    process.platform === 'win32'
      ? targetPath
      : path.relative(path.dirname(linkPath), targetPath);
  symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
}

ensureDirectoryLink(
  path.join(projectRoot, 'node_modules'),
  path.join(toolingRoot, 'node_modules'),
);
ensureDirectoryLink(path.join(toolingRoot, 'app'), path.join(projectRoot, 'app'));
ensureDirectoryLink(
  path.join(toolingRoot, 'public'),
  path.join(projectRoot, 'public'),
);

console.log('Workspace links are ready.');
