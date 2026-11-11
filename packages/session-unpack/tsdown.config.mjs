/**
 * Build configuration for the dsh-enhance-session-unpack component.
 *
 * One artifact comes out of this package: `lib/index.js`, the Host half that
 * registers the `unpack_session` tool. The session reader it uses is a second
 * entry point, so the package can also be imported by path.
 */
export default [
  {
    name: 'dsh-enhance-session-unpack/host',
    entry: { index: 'src/index.js', 'session-unpack': 'src/session-unpack/index.js' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: true,
    sourcemap: true,
  },
]
