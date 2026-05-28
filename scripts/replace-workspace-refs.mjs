/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

// Rewrites workspace:* → ^{version} in all packages/*/package.json before
// publish. changeset publish calls npm publish directly, bypassing yarn's
// workspace: protocol rewriting. This script fills that gap.
//
// Run on the CI runner before publish — source files stay as workspace:*
// for local development (yarn resolves local packages by version match).

import { readdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packagesDir = resolve(__dirname, '..', 'packages');
const packageDirs = readdirSync(packagesDir).filter((d) =>
  existsSync(join(packagesDir, d, 'package.json')),
);

// Build name → version map
const versionMap = {};
for (const dir of packageDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (pkg.name && pkg.version) {
    versionMap[pkg.name] = pkg.version;
  }
}

// Rewrite workspace:* in dependencies and peerDependencies
let totalReplaced = 0;
for (const dir of packageDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  let changed = false;

  for (const section of ['dependencies', 'peerDependencies']) {
    if (!pkg[section]) continue;
    for (const [dep, ver] of Object.entries(pkg[section])) {
      if (ver === 'workspace:*' && versionMap[dep]) {
        pkg[section][dep] = `^${versionMap[dep]}`;
        changed = true;
        totalReplaced++;
        console.log(
          `  ${dir}/${section}/${dep}: workspace:* → ^${versionMap[dep]}`,
        );
      }
    }
  }

  if (changed) {
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}

console.log(`\nReplaced ${totalReplaced} workspace:* reference(s).`);
