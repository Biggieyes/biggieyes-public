import BN from 'bn.js';
console.log('require', typeof BN, Object.keys(BN));
console.log('BN prototype?', typeof BN === 'function', BN.name);
console.log('BN default key', BN.default ? BN.default.name : 'no default');
