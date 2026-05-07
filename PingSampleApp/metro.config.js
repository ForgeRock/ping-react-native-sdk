/*
 * Copyright (c) 2026 Ping Identity Corporation. All rights reserved.
 *
 * This software may be modified and distributed under the terms
 * of the MIT license. See the LICENSE file for details.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require('path');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Path to local library package (adjust the relative path if needed)
const oidcPackage = path.resolve(__dirname, '../packages/oidc');
const journeyPackage = path.resolve(__dirname, '../packages/journey');
const browserPackage = path.resolve(__dirname, '../packages/browser');
const deviceIdPackage = path.resolve(__dirname, '../packages/device-id');
const deviceProfilePackage = path.resolve(
  __dirname,
  '../packages/device-profile',
);
const externalIdpPackage = path.resolve(__dirname, '../packages/external-idp');
const fidoPackage = path.resolve(__dirname, '../packages/fido');
const storagePackage = path.resolve(__dirname, '../packages/storage');
const corePackage = path.resolve(__dirname, '../packages/core');
const loggerPackage = path.resolve(__dirname, '../packages/logger');
const typesPackage = path.resolve(__dirname, '../packages/types');
const bindingPackage = path.resolve(__dirname, '../packages/binding');
const deviceClientPackage = path.resolve(
  __dirname,
  '../packages/device-client',
);
const workspaceRoot = path.resolve(__dirname, '..');

const config = {
  watchFolders: [
    journeyPackage,
    browserPackage,
    deviceIdPackage,
    deviceProfilePackage,
    externalIdpPackage,
    fidoPackage,
    storagePackage,
    corePackage,
    loggerPackage,
    typesPackage,
    bindingPackage,
    deviceClientPackage,
    workspaceRoot,
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
      '@ping-identity/rn-oidc': oidcPackage,
      '@ping-identity/rn-journey': journeyPackage,
      '@ping-identity/rn-browser': browserPackage,
      '@ping-identity/rn-device-id': deviceIdPackage,
      '@ping-identity/rn-device-profile': deviceProfilePackage,
      '@ping-identity/rn-external-idp': externalIdpPackage,
      '@ping-identity/rn-fido': fidoPackage,
      '@ping-identity/rn-storage': storagePackage,
      '@ping-identity/rn-core': corePackage,
      '@ping-identity/rn-logger': loggerPackage,
      '@ping-identity/rn-types': typesPackage,
      '@ping-identity/rn-binding': bindingPackage,
      '@ping-identity/rn-device-client': deviceClientPackage,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
