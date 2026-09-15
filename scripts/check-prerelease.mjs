#!/usr/bin/env node
/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

// Verifies the repo is in a releasable prerelease state for the expected tag
// before a beta release runs. Usage: node scripts/check-prerelease.mjs beta
//
// Fails with exit code 1 unless:
//   - .changeset/pre.json is absent, or present with { "mode": "exit" }
//     (pre mode would route publish to its own tag and conflict with --tag)
//   - every publishable packages/*/package.json version ends in -<expected>.N
//
// This keeps a stable version from ever being published through the beta
// workflow onto the latest dist-tag.

import { readdirSync, statSync, existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const expectedTag = process.argv[2];

if (!expectedTag) {
  console.error('Usage: node scripts/check-prerelease.mjs <tag> (e.g. beta)');
  process.exit(1);
}

// 1. Check changesets prerelease mode is NOT active (it would hijack the
//    dist-tag or reject the explicit --tag flag).
const preStatePath = resolve(__dirname, '..', '.changeset', 'pre.json');

if (existsSync(preStatePath)) {
  let preState;
  try {
    preState = JSON.parse(readFileSync(preStatePath, 'utf8'));
  } catch (err) {
    console.error('✗ Failed to parse .changeset/pre.json: ' + err.message);
    process.exit(1);
  }
  if (preState.mode === 'pre') {
    console.error(
      '✗ .changeset/pre.json is in pre mode (tag "' +
        preState.tag +
        '"). This workflow publishes with --tag ' +
        expectedTag +
        ' directly.\n' +
        '  Run: yarn changeset pre exit (then commit the pre.json removal)',
    );
    process.exit(1);
  }
}

// 2. Check every publishable package version ends in -<tag>.N
const packagesDir = resolve(__dirname, '..', 'packages');

const packageDirs = readdirSync(packagesDir).filter((dir) =>
  statSync(join(packagesDir, dir)).isDirectory(),
);

const versionPattern = new RegExp('-' + expectedTag + '\\.\\d+$');

const violations = [];
let publishedVersion = null;

for (const dir of packageDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  if (!existsSync(pkgPath)) continue;
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (!pkg.name || pkg.private) continue;

  if (pkg.name === '@ping-identity/rn-core') {
    publishedVersion = pkg.version;
  }

  if (typeof pkg.version !== 'string' || !versionPattern.test(pkg.version)) {
    violations.push('  ' + pkg.name + ': ' + pkg.version);
  }
}

if (violations.length > 0) {
  console.error(
    '✗ Prerelease violation: packages not at a -' +
      expectedTag +
      '.N version\n',
  );
  violations.forEach((v) => console.error(v));
  console.error(
    '\nBump versions to x.y.z-' +
      expectedTag +
      '.N before running this workflow (e.g. set all package versions to 1.1.0-' +
      expectedTag +
      '.0 and update the lockfile).',
  );
  process.exit(1);
}

console.log(
  '✓ Prerelease versions verified (tag: ' +
    expectedTag +
    '), version: ' +
    publishedVersion,
);
