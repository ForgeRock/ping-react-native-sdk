#!/usr/bin/env node
/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

/**
 * Verifies that all Ping native SDK versions pinned across packages are identical.
 *
 * Checks:
 *   - packages/*\/android\/build.gradle  → com.pingidentity.sdks:<artifact>:<version>
 *   - packages\/*.podspec               → s.dependency "PingXxx", '<version>'
 *
 * Exits 1 if any mismatch is found, 0 when all versions are consistent.
 */

import { readFileSync } from 'fs';
import { glob } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** @param {string} pattern */
async function findFiles(pattern) {
  const matches = [];
  for await (const file of glob(pattern, { cwd: root })) {
    matches.push(path.resolve(root, file));
  }
  return matches;
}

/** @param {string} filePath @returns {string[]} */
function extractGradleVersions(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const pattern = /com\.pingidentity\.sdks:[^:]+:(\d+\.\d+\.\d+)/g;
  const versions = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    versions.push(match[1]);
  }
  return versions;
}

/** @param {string} filePath @returns {string[]} */
function extractPodspecVersions(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const pattern =
    /s\.dependency\s+['"]Ping[^'"]+['"]\s*,\s*['"](\d+\.\d+\.\d+)['"]/g;
  const versions = [];
  let match;
  while ((match = pattern.exec(content)) !== null) {
    versions.push(match[1]);
  }
  return versions;
}

const gradleFiles = await findFiles('packages/*/android/build.gradle');
const podspecFiles = await findFiles('packages/*/*.podspec');

/** @type {Map<string, string[]>} file → all versions found in the file */
const versionsByFile = new Map();

for (const file of gradleFiles) {
  const versions = extractGradleVersions(file);
  if (versions.length > 0) {
    versionsByFile.set(file, versions);
  }
}

for (const file of podspecFiles) {
  const versions = extractPodspecVersions(file);
  if (versions.length > 0) {
    versionsByFile.set(file, versions);
  }
}

if (versionsByFile.size === 0) {
  console.log(
    'check-native-sdk-versions: no pinned native SDK versions found.',
  );
  process.exit(0);
}

// Every version extracted from any file must match — both within a single
// file and across all files.
const allVersions = new Set();
for (const versions of versionsByFile.values()) {
  for (const version of versions) {
    allVersions.add(version);
  }
}

const fileCount = versionsByFile.size;

if (allVersions.size === 1) {
  const [version] = allVersions;
  console.log(
    `check-native-sdk-versions: all ${fileCount} files pinned to ${version} ✓`,
  );
  process.exit(0);
}

console.error(
  'check-native-sdk-versions: native SDK version mismatch detected!\n',
);
for (const [file, versions] of versionsByFile) {
  const rel = path.relative(root, file);
  const unique = [...new Set(versions)].join(', ');
  console.error(`  ${rel} → ${unique}`);
}
console.error(
  '\nAll native Ping SDK versions must be identical across packages.',
);
process.exit(1);
