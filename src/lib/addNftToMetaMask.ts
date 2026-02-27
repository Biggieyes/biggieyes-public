// src/lib/addNftToMetaMask.ts
type HexChainId = `0x${string}`;

type AssetOptions = {
  name?: string;
  image?: string;
  symbol?: string;
};

type AddSingleParams = {
  contractAddress: string;
  tokenId: string | number;
  chainId?: HexChainId; // např. "0x1" (Ethereum), "0xaa36a7" (Sepolia), "0x13882" (Polygon Amoy)
  trySwitchChain?: boolean; // default: true
  assetOptions?: AssetOptions;
};

type AddManyParams = {
  contractAddress: string;
  tokenIds: Array<string | number>;
  chainId?: HexChainId;
  trySwitchChain?: boolean;
  assetOptions?: AssetOptions;
};

type EthereumishRequest = {
  method: string;
  params?: ReadonlyArray<unknown> | Record<string, unknown>;
};

interface EthereumishProvider {
  request(_args: EthereumishRequest): Promise<unknown>;
  sendAsync?: (
    _payload: EthereumishRequest | EthereumishRequest[],
    _cb: (_err: unknown, _result: unknown) => void,
  ) => void;
}

/** Přidá JEDNO ERC-721 NFT do MetaMask (vrací true, pokud uživatel potvrdí). */
export async function addNftToMetaMask({
  contractAddress,
  tokenId,
  chainId = "0x1",
  trySwitchChain = true,
  assetOptions,
}: AddSingleParams): Promise<boolean> {
  const provider = getProvider();
  await ensureOnChain(provider, chainId, trySwitchChain);

  const addr = normalizeAddress(contractAddress);
  const options: Record<string, string> = {
    address: addr,
    tokenId: String(tokenId),
  };
  if (assetOptions?.name) options.name = assetOptions.name;
  if (assetOptions?.image) options.image = assetOptions.image;
  if (assetOptions?.symbol) options.symbol = assetOptions.symbol;

  try {
    const wasAdded = await provider.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC721",
        options,
      },
    });
    return !!wasAdded;
  } catch (err) {
    if (isUserRejected(err)) return false;
    throw err;
  }
}

/** Batch varianta – volitelná, zatím ji nepoužíváte. */
export async function addManyNftsToMetaMask({
  contractAddress,
  tokenIds,
  chainId = "0x1",
  trySwitchChain = true,
  assetOptions,
}: AddManyParams): Promise<number> {
  const provider = getProvider();
  await ensureOnChain(provider, chainId, trySwitchChain);

  const addr = normalizeAddress(contractAddress);
  const payload = tokenIds.map((id) => ({
    method: "wallet_watchAsset",
    params: {
      type: "ERC721",
      options: {
        address: addr,
        tokenId: String(id),
        ...(assetOptions?.name ? { name: assetOptions.name } : {}),
        ...(assetOptions?.image ? { image: assetOptions.image } : {}),
        ...(assetOptions?.symbol ? { symbol: assetOptions.symbol } : {}),
      },
    },
  }));

  const anyProvider = provider as EthereumishProvider & {
    sendAsync?: (
      _payload: EthereumishRequest | EthereumishRequest[],
      _cb: (_err: unknown, _result: unknown) => void,
    ) => void;
  };
  if (typeof anyProvider.sendAsync !== "function") {
    let ok = 0;
    for (const call of payload) {
      try {
        const result = await provider.request(call);
        if (result) ok += 1;
      } catch (err) {
        console.debug("addManyNftsToMetaMask provider.request failed", err);
      }
      await new Promise((r) => setTimeout(r, 120));
    }
    return ok;
  }

  const res = await new Promise<{ success: number }>((resolve, reject) => {
    anyProvider.sendAsync(payload, (err: unknown, results: unknown) => {
      if (err) return reject(err);
      const array = Array.isArray(results) ? results : [];
      const success = array.reduce((acc, entry) => {
        if (typeof entry === "object" && entry !== null && "result" in entry) {
          return (
            acc + ((entry as unknown as { result?: boolean }).result ? 1 : 0)
          );
        }
        return acc;
      }, 0);
      resolve({ success });
    });
  });

  return res.success;
}

/* ----------------- interní pomocníci ----------------- */

function isUserRejected(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as {
    code?: unknown;
    message?: unknown;
    error?: { code?: unknown; message?: unknown };
  };
  const code = anyErr?.code ?? anyErr?.error?.code;
  if (code === 4001 || code === "4001" || code === "ACTION_REJECTED")
    return true;
  const msg = String(
    anyErr?.message ?? anyErr?.error?.message ?? "",
  ).toLowerCase();
  return msg.includes("user rejected") || msg.includes("denied");
}

function getProvider(): EthereumishProvider {
  const eth = (globalThis as unknown as { ethereum?: EthereumishProvider })
    .ethereum;
  if (!eth || typeof eth.request !== "function") {
    throw new Error("MetaMask provider not found");
  }
  return eth as EthereumishProvider;
}

async function ensureOnChain(
  provider: EthereumishProvider,
  chainId: HexChainId,
  trySwitch: boolean,
): Promise<void> {
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (normalizeHex(current) === normalizeHex(chainId)) return;

  if (!trySwitch) {
    throw new Error(`Wrong network: ${current} (need ${chainId})`);
  }
  await provider.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId }],
  });
}

function normalizeHex(v: string): string {
  return v?.toLowerCase().replace(/^0x0+/, "0x") ?? v;
}

/** Povolí běžný 0x… řetězec délky 42 znaků (lowercase i checksum). */
function normalizeAddress(a: string): string {
  if (typeof a !== "string") throw new Error("Invalid contract address");
  const addr = a.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    throw new Error("Invalid contract address");
  }
  return addr;
}
