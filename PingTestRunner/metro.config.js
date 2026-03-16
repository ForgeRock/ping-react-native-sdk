/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspaceRoot = path.resolve(__dirname, '..');

// Local workspace package paths
const browserPackage = path.resolve(workspaceRoot, 'packages/browser');
const corePackage = path.resolve(workspaceRoot, 'packages/core');
const deviceIdPackage = path.resolve(workspaceRoot, 'packages/device-id');
const deviceProfilePackage = path.resolve(workspaceRoot, 'packages/device-profile');
const journeyPackage = path.resolve(workspaceRoot, 'packages/journey');
const loggerPackage = path.resolve(workspaceRoot, 'packages/logger');
const oidcPackage = path.resolve(workspaceRoot, 'packages/oidc');
const storagePackage = path.resolve(workspaceRoot, 'packages/storage');
const typesPackage = path.resolve(workspaceRoot, 'packages/types');

const config = {
  watchFolders: [
    workspaceRoot,
    browserPackage,
    corePackage,
    deviceIdPackage,
    deviceProfilePackage,
    journeyPackage,
    loggerPackage,
    oidcPackage,
    storagePackage,
    typesPackage,
  ],
  resolver: {
    disableHierarchicalLookup: true,
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
      '@ping-identity/rn-browser': browserPackage,
      '@ping-identity/rn-core': corePackage,
      '@ping-identity/rn-device-id': deviceIdPackage,
      '@ping-identity/rn-device-profile': deviceProfilePackage,
      '@ping-identity/rn-journey': journeyPackage,
      '@ping-identity/rn-logger': loggerPackage,
      '@ping-identity/rn-oidc': oidcPackage,
      '@ping-identity/rn-storage': storagePackage,
      '@ping-identity/rn-types': typesPackage,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
