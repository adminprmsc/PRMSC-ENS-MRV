const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '..');
const config = {
  // Allow importing shared source files from sibling apps/packages.
  watchFolders: [workspaceRoot],
  resolver: {
    unstable_enableSymlinks: true,
  },
};

module.exports = withNativeWind(mergeConfig(getDefaultConfig(__dirname), config), {
  input: './global.css',
  inlineRem: 16,
});
