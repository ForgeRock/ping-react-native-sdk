const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Path to local library package (adjust the relative path if needed)
const oidcPackage = path.resolve(__dirname, '../packages/oidc');
const journeyPackage = path.resolve(__dirname, '../packages/journey');
const browserPackage = path.resolve(__dirname, '../packages/browser');
const deviceIdPackage = path.resolve(__dirname, '../packages/device-id');
const deviceProfilePackage = path.resolve(__dirname, '../packages/device-profile');
const storagePackage = path.resolve(__dirname, '../packages/storage');
const corePackage = path.resolve(__dirname, '../packages/core');
const loggerPackage = path.resolve(__dirname, '../packages/logger');
const typesPackage = path.resolve(__dirname, '../packages/types');
const workspaceRoot = path.resolve(__dirname, '..');

const config = {
  watchFolders: [
    journeyPackage,
    browserPackage,
    deviceIdPackage,
    deviceProfilePackage,
    storagePackage,
    corePackage,
    loggerPackage,
    typesPackage,
    workspaceRoot,
  ],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(oidcPackage, 'node_modules'),
      path.resolve(journeyPackage, 'node_modules'),
      path.resolve(browserPackage, 'node_modules'),
      path.resolve(deviceIdPackage, 'node_modules'),
      path.resolve(deviceProfilePackage, 'node_modules'),
      path.resolve(storagePackage, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
      path.resolve(corePackage, 'node_modules'),
      path.resolve(loggerPackage, 'node_modules'),
      path.resolve(typesPackage, 'node_modules'),
    ],
    extraNodeModules: {
      '@ping-identity/rn-oidc': oidcPackage,
      '@react-native-pingidentity/journey': journeyPackage,
      '@ping-identity/rn-browser': browserPackage,
      '@ping-identity/rn-device-id': deviceIdPackage,
      '@ping-identity/rn-device-profile': deviceProfilePackage,
      '@ping-identity/rn-storage': storagePackage,
      '@ping-identity/rn-core': corePackage,
      '@ping-identity/rn-logger': loggerPackage,
      '@ping-identity/rn-types': typesPackage,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
