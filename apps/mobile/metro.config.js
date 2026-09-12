const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Needed to consume workspace packages (@memaday/core, @memaday/db) from a
// pnpm monorepo: their source lives outside apps/mobile, symlinked in via
// node_modules, and Metro needs to be told to watch and resolve there too.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Workspace packages have no build step — they're consumed as raw
// TypeScript (see e.g. packages/core/package.json's `"main": "./src/index.ts"`)
// and their internal relative imports follow the NodeNext convention of
// writing a `.js` extension even though the real file is `.ts`
// (e.g. `export * from "./identity.js"` in packages/core/src/index.ts).
// tsc and esbuild both resolve that correctly; Metro doesn't out of the
// box — it looks for a literal `identity.js` and fails. This strips the
// extension before delegating back to Metro's normal resolution, which
// does try `.ts` via `sourceExts`.
const { resolveRequest: defaultResolveRequest } = config.resolver;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return context.resolveRequest(context, moduleName.replace(/\.js$/, ''), platform);
    } catch {
      // Fall through — a real .js import (not a mis-resolved .ts one).
    }
  }
  return (defaultResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
