const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { resolve } = require('metro-resolver').default;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * Custom `@src/` alias: delegate with Metro’s default `resolve` so nested
 * resolution inside `node_modules` (e.g. `@react-navigation/bottom-tabs`)
 * keeps the same behavior as the stock resolver.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const projectRoot = __dirname;

module.exports = mergeConfig(getDefaultConfig(projectRoot), {
  resolver: {
    resolveRequest(context, moduleName, platform) {
      const ctx = {
        ...context,
        resolveRequest: resolve,
      };

      if (moduleName.startsWith('@src/')) {
        return resolve(
          ctx,
          path.resolve(projectRoot, moduleName.replace(/^@src\//, 'src/')),
          platform,
        );
      }

      return resolve(ctx, moduleName, platform);
    },
  },
});
