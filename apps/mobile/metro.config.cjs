const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Local release builds serve from this folder (EXPO_NO_METRO_WORKSPACE_ROOT, see scripts/build-apk.ps1),
// which drops the workspace from the watched folders; pnpm keeps every package there.
const workspaceRoot = path.resolve(__dirname, '../..');
if (!config.watchFolders.includes(workspaceRoot)) config.watchFolders.push(workspaceRoot);

// pnpm can resolve Router's React peer to a different copy than React Native's.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/')) {
    return {
      filePath: require.resolve(moduleName),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
