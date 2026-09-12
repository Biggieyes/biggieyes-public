// Never repeat a wallet submission: an RPC error can hide an accepted transaction.
export async function sendWriteOnce(sendFn) {
  return await sendFn();
}

// Recheck the signing context after async preflight, immediately before submission.
export async function assertWriteContext({
  contract,
  account,
  getCurrentAccount,
  chainId,
}) {
  const expected = String(account || "").toLowerCase();
  const assertAccount = () => {
    if (
      !/^0x[\da-f]{40}$/.test(expected) ||
      String(getCurrentAccount() || "").toLowerCase() !== expected
    ) {
      throw new Error(
        "Wallet changed. Review the action with the current account.",
      );
    }
  };
  assertAccount();
  const signer = contract?.runner;
  if (
    typeof signer?.getAddress !== "function" ||
    typeof signer?.provider?.send !== "function"
  ) {
    throw new Error("Signing wallet could not be verified.");
  }
  const address = await signer.getAddress();
  assertAccount();
  if (String(address).toLowerCase() !== expected) {
    throw new Error("Signing wallet does not match the connected account.");
  }
  // BrowserProvider("any").getNetwork() can return the preceding network once.
  // Read the wallet directly; do not use getSigner(), which can prompt reconnect.
  const accounts = await signer.provider.send("eth_accounts", []);
  assertAccount();
  if (
    !Array.isArray(accounts) ||
    String(accounts[0] || "").toLowerCase() !== expected
  ) {
    throw new Error(
      "Wallet account changed or disconnected. Reconnect before trying again.",
    );
  }
  const chainHex = await signer.provider.send("eth_chainId", []);
  assertAccount();
  if (
    !Number.isSafeInteger(chainId) ||
    typeof chainHex !== "string" ||
    !/^0x[\da-f]+$/i.test(chainHex) ||
    BigInt(chainHex) !== BigInt(chainId)
  ) {
    throw new Error(
      "Wallet network changed. Switch to Polygon mainnet before trying again.",
    );
  }
}

export async function waitForWriteReceipt(tx) {
  let receipt;
  try {
    receipt = await tx.wait();
  } catch (error) {
    if (
      error?.code !== "TRANSACTION_REPLACED" ||
      error.cancelled ||
      error.reason !== "repriced"
    )
      throw error;
    receipt = error.receipt;
  }
  if (Number(receipt?.status) !== 1) {
    const error = new Error("Transaction was not confirmed successfully");
    error.receipt = receipt;
    throw error;
  }
  return receipt;
}
