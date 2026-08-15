const BN = require('bn.js');
console.log('require', typeof BN, Object.keys(BN));
console.log('BN default', BN.default ? BN.default.name : 'none');
console.log('BN prototype', typeof BN === 'function');
