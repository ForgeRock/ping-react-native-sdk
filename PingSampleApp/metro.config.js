/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Path to local library package (adjust the relative path if needed)
const oidcPackage = path.resolve(__dirname, '../packages/oidc');
const journeyPackage = path.resolve(__dirname, '../packages/journey');
const storagePackage = path.resolve(__dirname, '../packages/storage');
const corePackage = path.resolve(__dirname, '../packages/core');
const loggerPackage = path.resolve(__dirname, '../packages/logger');
const workspaceRoot = path.resolve(__dirname, '..');

const config = {
  watchFolders: [journeyPackage, storagePackage, oidcPackage, workspaceRoot, corePackage, loggerPackage],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(oidcPackage, 'node_modules'),
      path.resolve(journeyPackage, 'node_modules'),
      path.resolve(storagePackage, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
      path.resolve(corePackage, 'node_modules'),
      path.resolve(loggerPackage, 'node_modules'),
    ],
    extraNodeModules: {
      '@ping-identity/rn-oidc': oidcPackage,
      '@ping-identity/rn-journey': journeyPackage,
      '@react-native-pingidentity/storage': storagePackage,
      '@react-native-pingidentity/core': corePackage,
      '@react-native-pingidentity/logger': loggerPackage,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
