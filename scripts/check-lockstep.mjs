#!/usr/bin/env node
//
// Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
//
// This software may be modified and distributed under the terms
// of the MIT license. See the LICENSE file for details.
//

import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packagesDir = resolve(__dirname, '..', 'packages');

const packageDirs = readdirSync(packagesDir).filter((dir) =>
  statSync(join(packagesDir, dir)).isDirectory(),
);

const packages = packageDirs
  .map((dir) => {
    const pkgPath = join(packagesDir, dir, 'package.json');
    if (!existsSync(pkgPath)) return null;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return { name: pkg.name, version: pkg.version, private: pkg.private };
  })
  .filter((pkg) => pkg !== null && !pkg.private);

if (packages.length === 0) {
  console.error('No publishable packages found in packages/*');
  process.exit(1);
}

const versions = [...new Set(packages.map((p) => p.version))];

if (versions.length === 1) {
  console.log(`✓ All ${packages.length} packages are at version ${versions[0]}`);
  process.exit(0);
}

console.error('✗ Lockstep violation: packages have diverged versions\n');
for (const pkg of packages) {
  console.error(`  ${pkg.name}: ${pkg.version}`);
}
console.error(
  '\nAll @ping-identity/* packages must be at the same version. ' +
    'Run "yarn release:version" to align versions, or revert any manual package.json edits.',
);
process.exit(1);
