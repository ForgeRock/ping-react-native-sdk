/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

// Fails with exit code 1 if any packages/*/package.json still contains
// workspace:* in dependencies or peerDependencies. Run after
// replace-workspace-refs.mjs as a safety net before publishing to npm.

import { readdirSync, existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packagesDir = resolve(__dirname, '..', 'packages');
const packageDirs = readdirSync(packagesDir).filter((d) =>
  existsSync(join(packagesDir, d, 'package.json')),
);

const violations = [];

for (const dir of packageDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  for (const section of ['dependencies', 'peerDependencies']) {
    if (!pkg[section]) continue;
    for (const [dep, ver] of Object.entries(pkg[section])) {
      if (ver === 'workspace:*') {
        violations.push(
          `  ${dir}/package.json → ${section}.${dep}: "workspace:*"`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    'ERROR: workspace:* references found in packages. Run scripts/replace-workspace-refs.mjs first.\n',
  );
  violations.forEach((v) => console.error(v));
  process.exit(1);
}

console.log('OK: No workspace:* references found in packages.');
