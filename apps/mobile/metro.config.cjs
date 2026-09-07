const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

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
