const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// Path to local library package (adjust the relative path if needed)
const oidcPackage = path.resolve(__dirname, '../packages/oidc');
const journeyPackage = path.resolve(__dirname, '../packages/journey');
const storagePackage = path.resolve(__dirname, '../packages/storage');

const workspaceRoot = path.resolve(__dirname, '..');

const config = {
  watchFolders: [ oidcPackage, journeyPackage, storagePackage, workspaceRoot],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(oidcPackage, 'node_modules'),
      path.resolve(journeyPackage, 'node_modules'),
      path.resolve(storagePackage, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules')
    ],
    extraNodeModules: {
      '@react-native-pingidentity/oidc': oidcPackage,
      '@react-native-pingidentity/journey': journeyPackage,
      '@react-native-pingidentity/storage': storagePackage,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);