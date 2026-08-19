// Vite plugin to wrap CommonJS modules with default exports for Rollup
export function commonjsToEsm() {
  return {
    name: 'commonjs-to-esm',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'bn.js' || id === 'hash.js') {
        return `\0virtual:${id}`;
      }
      return null;
    },
    load(id) {
      if (id === '\0virtual:bn.js') {
        return `
          import * as BNModule from 'bn.js/lib/bn.js';
          const BN = BNModule.default || BNModule;
          export default BN;
          export { BN };
        `;
      }
      if (id === '\0virtual:hash.js') {
        return `
          import * as hashModule from 'hash.js/lib/hash.js';
          const hash = hashModule.default || hashModule;
          export default hash;
          export { hash };
        `;
      }
      return null;
    },
  };
}
