// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Stability improvements for Metro bundler
config.resolver.unstable_enableSymlinks = false;

// ── Hermes base-x fix ──────────────────────────────────────────────────────
// Hermes breaks `instanceof Uint8Array` for Buffer polyfill subclasses.
// base-x v3 (bs58) throws "Expected Buffer", v4 (MWA) throws "Expected Uint8Array".
// Redirect ALL base-x imports to our shim that brute-force copies bytes into
// plain Uint8Array — no instanceof checks at all.
const path = require('path');
const BASEX_SHIM = path.resolve(__dirname, 'src/shims/base-x-hermes.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'base-x') {
    return { type: 'sourceFile', filePath: BASEX_SHIM };
  }
  // Fall through to default resolution for everything else
  return context.resolveRequest(context, moduleName, platform);
};

// Increase file watcher stability (helps with "Metro offline" issues)
config.watchFolders = [__dirname];

config.watcher = {
  // Use watchman for better performance, fall back to polling if unavailable
  watchman: {
    deferStates: ['hg.update'],
  },
  // Increase health check interval to reduce disconnections
  healthCheck: {
    enabled: true,
    interval: 30000, // 30 seconds
    timeout: 5000,
    filePrefix: '.metro-health-check',
  },
};

// Server stability settings - critical for iOS Expo Go
config.server = {
  ...config.server,
  // Keep connection alive longer
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // CORS headers for tunnel mode
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      // Keep-alive headers to prevent disconnections
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Keep-Alive', 'timeout=300, max=1000');
      return middleware(req, res, next);
    };
  },
};

// Transformer settings for better caching
config.transformer = {
  ...config.transformer,
  // Enable Hermes for better performance
  minifierConfig: {
    keep_classnames: true,
    keep_fnames: true,
    mangle: {
      keep_classnames: true,
      keep_fnames: true,
    },
  },
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      // inlineRequires OFF — it defers module evaluation which can cause
      // polyfills to load after the modules that need them.
      inlineRequires: false,
    },
  }),
};

// Reset cache to avoid stale bundle issues
config.resetCache = false;

module.exports = config;
