// Dummy provider.js pro build kompatibilitu
// Pokud potřebujete skutečnou implementaci, přesuňte logiku sem.

export function getROProvider() {
  throw new Error("getROProvider není implementován: src/services/provider.js neexistuje");
}

export function explorerBaseForChain() {
  return "https://etherscan.io/address/";
}
