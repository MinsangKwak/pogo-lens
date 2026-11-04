const path = require('node:path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const workspace = path.resolve(__dirname, '../..');

module.exports = mergeConfig(getDefaultConfig(__dirname), {
  watchFolders: [workspace],
  resolver: {
    nodeModulesPaths: [
      path.join(workspace, 'node_modules'),
      path.join(__dirname, 'node_modules'),
    ],
    resolveRequest(context, moduleName, platform) {
      // Shared ESM packages use .js specifiers while Metro consumes their TypeScript sources.
      const sharedSource = context.originModulePath.startsWith(
        path.join(workspace, 'packages'),
      );
      const request =
        sharedSource && moduleName.startsWith('.') && moduleName.endsWith('.js')
          ? moduleName.slice(0, -3)
          : moduleName;
      return context.resolveRequest(context, request, platform);
    },
  },
});
