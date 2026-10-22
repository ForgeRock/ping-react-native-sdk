/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

// Prints one name@version per line for every publishable package in
// packages/* whose current version is not on npm. Prints nothing when all
// are published. Exits 1 if the registry state cannot be determined.

import { readdirSync, existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packagesDir = resolve(__dirname, '..', 'packages');

const packages = readdirSync(packagesDir)
  .map((dir) => join(packagesDir, dir, 'package.json'))
  .filter((pkgPath) => existsSync(pkgPath))
  .map((pkgPath) => JSON.parse(readFileSync(pkgPath, 'utf8')))
  .filter((pkg) => !pkg.private);

const isPublished = ({ name, version }) => {
  try {
    const published = execFileSync(
      'npm',
      ['view', `${name}@${version}`, 'version'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    ).trim();
    return published === version;
  } catch (error) {
    // Only E404 means the version is not on npm. Any other failure (401/403,
    // network, registry outage) says nothing about publish state, so abort
    // instead of counting it as unpublished.
    const stderr = String(error.stderr ?? '').trim();
    if (!stderr.includes('E404')) {
      console.error(
        `npm view failed for ${name}@${version} (not a 404, aborting): ${stderr}`,
      );
      process.exit(1);
    }
    return false;
  }
};

for (const pkg of packages) {
  if (!isPublished(pkg)) {
    console.log(`${pkg.name}@${pkg.version}`);
  }
}
