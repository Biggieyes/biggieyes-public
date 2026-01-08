// src/components/NftCard.jsx
import * as React from "react";
import { formatEther, parseEther, Contract, BrowserProvider, ZeroAddress, arrayify } from "ethers";
import "./NftCard.css";
import ImportNftButton from "./ImportNftButton";
import { useContracts } from "../providers/ContractsProvider";

const PLACEHOLDER_IMG = "/images/Biggi.png";

/* ----- helpers ----- */
const ipfsToHttp = (url) => {
  if (!url || typeof url !== "string") return url;
  if (!url.startsWith("ipfs://")) return url;
  const clean = url.replace(/^ipfs:\/\//, "").replace(/^ipfs\//, "");
  return `https://ipfs.io/ipfs/${clean}`;
};

const normaliseAttributes = (meta) => {
  if (!meta) return [];
  const attrs = Array.isArray(meta.attributes) ? meta.attributes : [];
  return attrs
    .filter((e) => e && e.trait_type != null && e.value != null)
    .map((e) => ({ trait_type: String(e.trait_type), value: String(e.value) }));
};

const fmtEtherNum = (v) => {
  try {
    return Number(formatEther(v));
  } catch {
    try {
      const bi = typeof v === "bigint" ? v : BigInt(v ?? 0);
      return Number(bi) / 1e18;
    } catch {
      return 0;
    }
  }
};

const formatMatic = (value) => {
  if (value == null || Number.isNaN(Number(value))) return "--";
  const f = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${f.format(Number(value))} POL`;
};

const parseMatic = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const m = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isNaN(n) ? null : n;
};

/* optional color-to-blockId map as fallback if needed */
const COLOR_TO_BLOCKID = {
  Orange: 1,
  Black: 2,
  White: 3,
  Brown: 4,
  Blue: 5,
  Green: 6,
  Violet: 7,
  Red: 8,
  Pink: 9,
  Rainbow: 10,
};

export default function NftCard({
  nft = {},
  dynamicTraits = {},
  onOpenDetails,
  onZoom,
  fallbackContractAddress = null,
}) {
  // hooks must be called deterministically; keep outside conditionals
  let contracts = null;
  try {
    contracts = useContracts();
  } catch {
    contracts = null;
  }

  const tokenId = nft?.tokenId != null ? String(nft.tokenId) : null;

  const [metadata, setMetadata] = React.useState(nft.meta || null);
  const [image, setImage] = React.useState(nft.image || null);
  const [mintData, setMintData] = React.useState(() => {
    if (nft?.mint) {
      return {
        ticketPrice: parseMatic(nft.mint.ticketPrice ?? nft.mint.mintTicket),
        blockPrice: parseMatic(nft.mint.blockPrice ?? nft.mint.mintBlock),
        finalPrice: parseMatic(nft.mint.finalPrice ?? nft.mint.mintFinal),
      };
    }
    return null;
  });
  const [currentBlockPrice, setCurrentBlockPrice] = React.useState(null);
  const [loadingMeta, setLoadingMeta] = React.useState(false);
  const [loadingMint, setLoadingMint] = React.useState(false);
  const [loadingBlockNow, setLoadingBlockNow] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const contractAddress = React.useMemo(() => {
    if (nft?.contractAddress) return nft.contractAddress;
    if (fallbackContractAddress) return fallbackContractAddress;
    try {
      return contracts?.mainRead?.()?.address ?? null;
    } catch {
      return null;
    }
  }, [contracts, nft?.contractAddress, fallbackContractAddress]);

  React.useEffect(() => {
    setMetadata(nft.meta || null);
  }, [nft.meta]);

  React.useEffect(() => {
    setImage(nft.image || null);
  }, [nft.image]);

  React.useEffect(() => {
    let cancelled = false;
    const fetchMetadata = async () => {
      if (!tokenId) return;
      // always try to fetch on missing or incomplete metadata
      const main = contracts?.mainRead?.();
      if (!main || typeof main.tokenURI !== "function") return;
      try {
        setLoadingMeta(true);
        const uri = await main.tokenURI(tokenId);
        if (!uri) return;
        const response = await fetch(ipfsToHttp(uri));
        if (!response.ok) return;
        const json = await response.json();
        if (!cancelled) {
          setMetadata((prev) => prev || json);
          const img = json.image || json.image_url;
          if (!nft.image && img) setImage(ipfsToHttp(img));
        }
      } catch (err) {
        console.error("NftCard metadata fetch failed", err);
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    };
    // fetch even if some metadata exists, but avoid refetch loop
    if (!metadata || !metadata.image) fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [contracts, metadata, nft.image, tokenId]);

  React.useEffect(() => {
    let cancelled = false;
    const fetchMintData = async () => {
      if (!tokenId) return;
      const reader = contracts?.readerRead?.();
      if (!reader || typeof reader.getMintDataByTokenId !== "function") return;
      try {
        setLoadingMint(true);
        const res = await reader.getMintDataByTokenId(tokenId);
        if (!res) return;
        const ticketWei = res?.[0] ?? 0;
        const blockWei = res?.[1] ?? 0;
        const finalWei = res?.[2] ?? 0;
        if (!cancelled) {
          setMintData({
            ticketPrice: fmtEtherNum(ticketWei),
            blockPrice: fmtEtherNum(blockWei),
            finalPrice: fmtEtherNum(finalWei),
          });
        }
      } catch (err) {
        console.error("NftCard mint data fetch failed", err);
      } finally {
        if (!cancelled) setLoadingMint(false);
      }
    };
    fetchMintData();
    return () => {
      cancelled = true;
    };
  }, [contracts, tokenId]);

  /* === Current block price (on-chain now) === */
  const blockIdFromTraits = React.useMemo(() => {
    if (dynamicTraits?.blockId && Number(dynamicTraits.blockId) > 0)
      return Number(dynamicTraits.blockId);
    if (dynamicTraits?.linkedBlockId && Number(dynamicTraits.linkedBlockId) > 0)
      return Number(dynamicTraits.linkedBlockId);

    const attrs = normaliseAttributes(metadata);
    const byKey = (k) => attrs.find((a) => a.trait_type.toLowerCase() === k);
    const blockColor =
      byKey("block/eye color")?.value ||
      byKey("block")?.value ||
      byKey("eye color")?.value ||
      byKey("linked block")?.value ||
      null;

    if (blockColor && COLOR_TO_BLOCKID[blockColor])
      return COLOR_TO_BLOCKID[blockColor];

    if (
      typeof dynamicTraits?.linkedBlock === "string" &&
      COLOR_TO_BLOCKID[dynamicTraits.linkedBlock]
    )
      return COLOR_TO_BLOCKID[dynamicTraits.linkedBlock];

    return null;
  }, [dynamicTraits, metadata]);

  React.useEffect(() => {
    let cancelled = false;

    const loadCurrentBlockPrice = async () => {
      if (!contracts) {
        setCurrentBlockPrice(
          mintData?.blockPrice ??
            parseMatic(dynamicTraits?.currentBlockPrice) ??
            null,
        );
        return;
      }
      const reader = contracts?.readerRead?.();
      const main = contracts?.mainRead?.();

      try {
        setLoadingBlockNow(true);

        // prefer reader by tokenId
        if (
          reader &&
          typeof reader.getCurrentBlockPriceByTokenId === "function" &&
          tokenId
        ) {
          try {
            const wei = await reader.getCurrentBlockPriceByTokenId(tokenId);
            if (!cancelled && wei != null) {
              setCurrentBlockPrice(fmtEtherNum(wei));
              return;
            }
          } catch (e) {}
        }

        // reader by blockId
        if (
          reader &&
          typeof reader.getCurrentBlockPrice === "function" &&
          blockIdFromTraits
        ) {
          try {
            const wei = await reader.getCurrentBlockPrice(blockIdFromTraits);
            if (!cancelled && wei != null) {
              setCurrentBlockPrice(fmtEtherNum(wei));
              return;
            }
          } catch (e) {}
        }

        // main fallbacks
        if (
          main &&
          typeof main.getCurrentBlockPriceByTokenId === "function" &&
          tokenId
        ) {
          try {
            const wei = await main.getCurrentBlockPriceByTokenId(tokenId);
            if (!cancelled && wei != null) {
              setCurrentBlockPrice(fmtEtherNum(wei));
              return;
            }
          } catch (e) {}
        }
        if (
          main &&
          typeof main.getCurrentBlockPrice === "function" &&
          blockIdFromTraits
        ) {
          try {
            const wei = await main.getCurrentBlockPrice(blockIdFromTraits);
            if (!cancelled && wei != null) {
              setCurrentBlockPrice(fmtEtherNum(wei));
              return;
            }
          } catch (e) {}
        }

        // ultimate fallback
        if (!cancelled) {
          setCurrentBlockPrice(
            mintData?.blockPrice ??
              parseMatic(dynamicTraits?.currentBlockPrice) ??
              parseMatic(dynamicTraits?.mintBlock),
          );
        }
      } catch (err) {
        console.warn("loadCurrentBlockPrice failed", err);
        if (!cancelled) {
          setCurrentBlockPrice(
            mintData?.blockPrice ??
              parseMatic(dynamicTraits?.mintBlock) ??
              null,
          );
        }
      } finally {
        if (!cancelled) setLoadingBlockNow(false);
      }
    };

    if (tokenId) loadCurrentBlockPrice();
    return () => {
      cancelled = true;
    };
  }, [
    contracts,
    tokenId,
    blockIdFromTraits,
    mintData?.blockPrice,
    dynamicTraits?.currentBlockPrice,
    dynamicTraits?.mintBlock,
  ]);

  const derivedMintData = React.useMemo(
    () => ({
      ticketPrice:
        mintData?.ticketPrice ?? parseMatic(dynamicTraits?.mintTicket),
      blockPriceNow:
        currentBlockPrice != null
          ? currentBlockPrice
          : (mintData?.blockPrice ?? parseMatic(dynamicTraits?.mintBlock)),
      finalPrice:
        mintData?.finalPrice ??
        parseMatic(dynamicTraits?.mintFinal ?? dynamicTraits?.finalPrice),
    }),
    [mintData, dynamicTraits, currentBlockPrice],
  );

  const attributes = React.useMemo(() => {
    const base = normaliseAttributes(metadata);
    const dyn = Array.isArray(dynamicTraits?.attributes)
      ? dynamicTraits.attributes
      : [];
    return [
      ...base,
      ...dyn
        .map((e) => ({
          trait_type: String(e?.trait_type ?? ""),
          value: String(e?.value ?? ""),
        }))
        .filter((e) => e.trait_type),
    ];
  }, [metadata, dynamicTraits]);

  const visibleAttributes = React.useMemo(
    () => (detailsOpen ? attributes : attributes.slice(0, 4)),
    [attributes, detailsOpen],
  );

  const title =
    metadata?.name || nft?.name || (tokenId ? `#${tokenId}` : "Biggi NFT");
  const rarityLabel =
    nft?.rarityRank != null ? `Rank #${nft.rarityRank}` : null;
  const imageSrc = image ? ipfsToHttp(image) : PLACEHOLDER_IMG;

  const handleToggleDetails = () => {
    setDetailsOpen((prev) => !prev);
    if (typeof onOpenDetails === "function") onOpenDetails(nft);
  };

  const handleZoom = () => {
    if (typeof onZoom === "function") onZoom({ ...nft, image: imageSrc });
  };

  return (
    <article className={`nft-card${detailsOpen ? " nft-card--open" : ""}`}>
      <div className="nft-card__figure">
        <button type="button" className="nft-card__zoom" onClick={handleZoom}>
          Zoom
        </button>
        {nft.isTicket && <span className="nft-card__badge">Ticket</span>}
        {!nft.isTicket && (
          <ImportNftButton
            contractAddress={contractAddress}
            tokenId={tokenId}
            name={title}
            image={imageSrc}
            className="nft-card__import"
          />
        )}
        <img
          src={imageSrc}
          alt={title}
          loading="React.lazy"
          onClick={handleZoom}
          onError={() => {
            if (image !== PLACEHOLDER_IMG) setImage(PLACEHOLDER_IMG);
          }}
        />
      </div>

      <div className="nft-card__body">
        <div className="nft-card__header">
          <h3 className="nft-card__title">{title}</h3>
          {rarityLabel && (
            <span className="nft-card__rarity">{rarityLabel}</span>
          )}
        </div>

        <div className="nft-card__section">
          <div className="nft-card__section-title">Mint summary</div>
          <div className="nft-card__stats">
            <div>
              <span>Ticket</span>
              <strong>
                {loadingMint
                  ? "..."
                  : formatMatic(derivedMintData?.ticketPrice ?? 0)}
              </strong>
            </div>
            <div title="Current block price">
              <span>Block (now)</span>
              <strong>
                {loadingBlockNow
                  ? "..."
                  : formatMatic(derivedMintData?.blockPriceNow ?? 0)}
              </strong>
            </div>
            <div>
              <span>Final</span>
              <strong>
                {loadingMint
                  ? "..."
                  : formatMatic(derivedMintData?.finalPrice ?? 0)}
              </strong>
            </div>
          </div>
        </div>

        <div className="nft-card__section">
          <div className="nft-card__section-title">Attributes</div>
          {loadingMeta && !attributes.length && (
            <div className="nft-card__placeholder">Loading metadata...</div>
          )}
          {!loadingMeta && attributes.length === 0 && (
            <div className="nft-card__placeholder">No attributes provided.</div>
          )}
          {attributes.length > 0 && (
            <div className="nft-card__attributes">
              {visibleAttributes.map((attr, idx) => (
                <div
                  key={`${attr.trait_type}-${idx}`}
                  className="nft-card__attribute"
                >
                  <span>{attr.trait_type}</span>
                  <strong>{attr.value}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="nft-card__actions">
          <button
            type="button"
            className="nft-card__toggle"
            onClick={handleToggleDetails}
          >
            {detailsOpen ? "Hide details" : "Show details"}
          </button>
          {metadata?.external_url && (
            <a
              className="nft-card__external"
              href={metadata.external_url}
              target="_blank"
              rel="noreferrer"
            >
              External link
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

