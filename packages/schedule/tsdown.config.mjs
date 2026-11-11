/**
 * Build configuration for the dsh-enhance-schedule component.
 *
 * Two artifacts come out of this package:
 *
 * - `lib/index.js` — the Host half, an ordinary ES module the Host imports as
 *   the package's main entry.
 * - `lib/client.js` — the browser half. It is a CommonJS bundle wrapped in the
 *   `window.__ModuleLoader__.load({ id, factory })` handoff the Host's Client
 *   module table expects; the id is the package name, which is the contract the
 *   module table registers under. React and react-dom stay external because the
 *   browser module table owns them.
 *
 * The wrapper shape follows the Host's own client build: an `intro` that opens
 * the CommonJS module object, a `banner` that opens the loader handoff, and a
 * `footer` that hands the module's exports back to the loader.
 */
import { readFileSync } from 'node:fs'

const { name } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

export default [
  {
    name: `${name}/host`,
    entry: { index: 'src/index.js' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: true,
    sourcemap: true,
  },
  {
    name: `${name}/client`,
    entry: { client: 'src/client/index.js' },
    outDir: 'lib',
    format: ['cjs'],
    platform: 'browser',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    // The Host half's output lives in the same directory; cleaning here would
    // take it away.
    clean: false,
    sourcemap: true,
    deps: {
      // React and react-dom come from the browser module table, not from a
      // bundled copy: a second React instance would break the hooks.
      neverBundle: (specifier) => specifier === 'react' || specifier === 'react-dom',
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: () => `window.__ModuleLoader__.load({ id: ${JSON.stringify(name)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
]
