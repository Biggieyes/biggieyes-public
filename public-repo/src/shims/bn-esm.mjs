// ESM wrapper for bn.js that provides a default export
// This is imported by our bn-shim.js

// Read the CJS module directly
const BN = (function() {
  'use strict';

  // _inherits helper removed because it's not used in this ESM wrapper

  function BN(number, base, endian) {
    if (BN.isBN(number)) {
      return number;
    }

    if (!(this instanceof BN)) {
      return new BN(number, base, endian);
    }

    this.negative = 0;
    this.words = null;
    this.length = 0;
    this.red = null;

    if (number !== null) {
      if (base === 'le' || base === 'be') {
        endian = base;
        base = 10;
      }
      this._init(number || 0, base || 10, endian || 'be');
    }
  }

  // Stub - actual implementation should come from bn.js
  BN.isBN = function(num) {
    if (num instanceof BN) return true;
    return num !== null && typeof num === 'object' &&
      num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
  };

  BN.wordSize = 26;
  BN.prototype._init = function() {};
  
  return BN;
})();

export default BN;
export { BN };
