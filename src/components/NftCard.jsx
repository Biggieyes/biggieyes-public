// src/components/NftCard.jsx
import * as React from "react";
import { formatEther } from "ethers";
import { DEFAULT_BLOCKS } from "@/shared/blocks";
import { buildBlockImagePath } from "@/shared/utils/images";
import "./NftCard.css";
import ImportNftButton from "./ImportNftButton";
import { useContracts } from "../providers/ContractsProvider";
import { httpFromIpfs, readJsonFromURI, resolveImageUrl } from "../shared/services/ipfs";

const PLACEHOLDER_IMG = "/images/Biggi.png";

const BG_NAMES = [
  "ORANGE",
  "BLACK",
  "WHITE",
  "BROWN",
  "BLUE",
  "GREEN",
  "VIOLET",
  "RED",
  "PINK",
  "RAINBOW",
];
const BG_CODES = ["O", "B", "W", "BR", "BL", "G", "V", "R", "P", "RB"];

const normalizeIndex = (val, max) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= max) return n - 1;
  if (n >= 0 && n < max) return n;
  return null;
};

const blockNameFromIdx = (val) => {
  const idx = normalizeIndex(val, DEFAULT_BLOCKS.length);
  return idx == null ? null : DEFAULT_BLOCKS[idx];
};

const bgCodeFromIdx = (val) => {
  const idx = normalizeIndex(val, BG_CODES.length);
  return idx == null ? null : BG_CODES[idx];
};

const bgNameFromIdx = (val) => {
  const idx = normalizeIndex(val, BG_NAMES.length);
  return idx == null ? null : BG_NAMES[idx];
};

const bgNameFromCode = (val) => {
  if (!val) return null;
  const code = String(val).toUpperCase();
  const idx = BG_CODES.indexOf(code);
  return idx === -1 ? null : BG_NAMES[idx];
};

const parseTokenUriParts = (uri) => {
  if (!uri) return null;
  const m = String(uri).match(/Biggi_(\d+)_([A-Z]+)_([A-Z]+)\.json/i);
  if (!m) return null;
  return {
    mainId: m[1],
    blockName: m[2].toUpperCase(),
    bgCode: m[3].toUpperCase(),
  };
};

const trimSlash = (val) => String(val || "").replace(/\/+$/, "");

const buildBlockImageUrl = (baseUri, blockName, bgCode, mainId) => {
  if (!blockName || !bgCode || !mainId) return null;
  const fileName = `Biggi_${mainId}_${blockName}_${bgCode}.png`;
  if (baseUri) return `${trimSlash(baseUri)}/${fileName}`;
  return buildBlockImagePath(fileName);
};

/* ----- helpers ----- */
const ipfsToHttp = (url) => {
  if (!url || typeof url !== "string") return url;
  return httpFromIpfs(url);
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

const looksLikeTicketMeta = (meta) => {
  if (!meta) return false;
  const name = String(meta?.name || "").toLowerCase();
  const desc = String(meta?.description || "").toLowerCase();
  return (
    name.includes("ticket") ||
    desc.includes("ticket") ||
    desc.includes("redeem")
  );
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
  highlight = false,
}) {
  // HOOKS must be called deterministically; keep outside conditionals
  let contracts = null;
  try {
    contracts = useContracts();
  } catch {
    contracts = null;
  }

  const tokenId = nft?.tokenId != null ? String(nft.tokenId) : null;

  const [metadata, setMetadata] = React.useState(nft.meta || null);
  const [image, setImage] = React.useState(nft.image || null);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
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
  const metadataRef = React.useRef(metadata);
  const onchainFallbackRef = React.useRef(new Set());

  const contractAddress = React.useMemo(() => {
    if (nft?.contractAddress) return nft.contractAddress;
    if (fallbackContractAddress) return fallbackContractAddress;
    try {
      return contracts?.mainRead?.()?.address ?? null;
    } catch {
      return null;
    }
  }, [contracts, nft?.contractAddress, fallbackContractAddress]);

  const metadataContract = React.useMemo(() => {
    if (!contracts) return null;
    let main = null;
    let main2 = null;
    try {
      main = contracts?.mainRead?.();
    } catch {
      main = null;
    }
    try {
      main2 = contracts?.main2Read?.();
    } catch {
      main2 = null;
    }
    const target = contractAddress
      ? String(contractAddress).toLowerCase()
      : "";
    if (target) {
      if (main && String(main.address || "").toLowerCase() === target)
        return main;
      if (main2 && String(main2.address || "").toLowerCase() === target)
        return main2;
    }
    return main || main2 || null;
  }, [contracts, contractAddress]);

  const forcedRefreshRef = React.useRef(new Set());

  React.useEffect(() => {
    setMetadata(nft.meta || null);
  }, [nft.meta]);

  React.useEffect(() => {
    setImage(nft.image || null);
    setImageLoaded(false);
    setImageFailed(false);
  }, [nft.image, tokenId]);

  React.useEffect(() => {
    if (imageFailed && image === PLACEHOLDER_IMG) return;
    setImageLoaded(false);
    setImageFailed(false);
  }, [image]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handleStatus = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", handleStatus);
    window.addEventListener("offline", handleStatus);
    handleStatus();
    return () => {
      window.removeEventListener("online", handleStatus);
      window.removeEventListener("offline", handleStatus);
    };
  }, []);

  React.useEffect(() => {
    metadataRef.current = metadata;
  }, [metadata]);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!tokenId || nft?.isTicket || nft?.isPending) return;
      if (onchainFallbackRef.current.has(tokenId)) return;

      const needsImage = !image || image === PLACEHOLDER_IMG;
      const attrs = Array.isArray(metadata?.attributes)
        ? metadata.attributes
        : [];
      const needsAttrs = attrs.length === 0;
      const name = metadata?.name || "";
      const needsName =
        !name ||
        (name.startsWith("#") && name.length > 12) ||
        /^\d{12,}$/.test(name);

      if (!needsImage && !needsAttrs && !needsName) return;

      const main = metadataContract || contracts?.mainRead?.();
      if (!main) return;

      let info = null;
      if (typeof main.nftInfo === "function") {
        info = await main.nftInfo(tokenId).catch(() => null);
      }
      if (!info) return;

      const blockIdx = info?.blockIdx ?? info?.[2];
      const background = info?.background ?? info?.[1];
      const mainIdRaw = info?.mainId ?? info?.[3];
      const mainId =
        mainIdRaw != null && typeof mainIdRaw?.toString === "function"
          ? mainIdRaw.toString()
          : String(mainIdRaw ?? "");

      const blockName = blockNameFromIdx(blockIdx);
      const bgCode = bgCodeFromIdx(background);
      const bgName = bgNameFromIdx(background);

      let baseUri = null;
      if (typeof main.blockBaseURIs === "function" && blockIdx != null) {
        const candidates = [];
        const n = Number(blockIdx);
        if (Number.isFinite(n)) {
          candidates.push(n);
          if (n > 0) candidates.push(n - 1);
          candidates.push(n + 1);
        }
        for (const idx of candidates) {
          const v = await main.blockBaseURIs(idx).catch(() => null);
          if (typeof v === "string" && v.trim()) {
            baseUri = v.trim();
            break;
          }
        }
      }

      if (!cancelled) {
        if (needsImage && blockName && bgCode && mainId && mainId !== "0") {
          const fallbackImage = buildBlockImageUrl(
            baseUri,
            blockName,
            bgCode,
            mainId,
          );
          if (fallbackImage) setImage(fallbackImage);
        }

        if (needsAttrs && (blockName || bgName)) {
          const nextAttrs = [...attrs];
          const upsert = (trait_type, value) => {
            if (!value) return;
            const idx = nextAttrs.findIndex(
              (a) => String(a?.trait_type) === trait_type,
            );
            if (idx === -1) nextAttrs.push({ trait_type, value });
            else nextAttrs[idx] = { ...nextAttrs[idx], value };
          };
          upsert("Block", blockName);
          upsert("Background", bgName);
          setMetadata((prev) => ({
            ...(prev || {}),
            attributes: nextAttrs,
          }));
        }

        if (needsName && mainId && mainId !== "0") {
          setMetadata((prev) => ({
            ...(prev || {}),
            name: `Biggi NFT #${mainId}`,
          }));
        }
      }

      onchainFallbackRef.current.add(tokenId);
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    tokenId,
    image,
    metadata,
    metadataContract,
    contracts,
    nft?.isTicket,
    nft?.isPending,
  ]);

  React.useEffect(() => {
    let cancelled = false;
    const currentMeta = metadataRef.current;
    const fetchMetadata = async () => {
      if (!tokenId) return;
      if (nft?.isTicket || nft?.isPending) return;
      const forceRefresh =
        !nft?.isTicket &&
        looksLikeTicketMeta(currentMeta) &&
        tokenId &&
        !forcedRefreshRef.current.has(tokenId);
      // always try to fetch on missing or incomplete metadata
      const main = metadataContract || contracts?.mainRead?.();
      if (!main || typeof main.tokenURI !== "function") return;
      try {
        setLoadingMeta(true);
        const uri = await main.tokenURI(tokenId);
        if (!uri) return;
        const json = await readJsonFromURI(uri);
        if (!json) {
          const parsed = parseTokenUriParts(uri);
          if (parsed && !cancelled) {
            const { mainId, blockName, bgCode } = parsed;
            const bgName = bgNameFromCode(bgCode) || bgCode;
            const fallbackMeta = {
              name: `Biggi NFT #${mainId}`,
              description: "Metadata is updating after redeem.",
              attributes: [
                blockName ? { trait_type: "Block", value: blockName } : null,
                bgName ? { trait_type: "Background", value: bgName } : null,
              ].filter(Boolean),
            };
            setMetadata((prev) => prev || fallbackMeta);
            const fallbackImage = buildBlockImageUrl(null, blockName, bgCode, mainId);
            if (fallbackImage) setImage(fallbackImage);
          }
          return;
        }
        const ticketLike = !nft?.isTicket && looksLikeTicketMeta(json);
        const fixedMeta = ticketLike
          ? {
              ...(json || {}),
              name: `Biggi NFT #${tokenId}`,
              description: "Metadata is updating after redeem.",
            }
          : json;
        if (!cancelled) {
          setMetadata((prev) => {
            if (forceRefresh) return fixedMeta;
            if (!prev) return fixedMeta;
            if (!nft?.isTicket && looksLikeTicketMeta(prev)) return fixedMeta;
            return prev;
          });
          const img = ticketLike
            ? PLACEHOLDER_IMG
            : fixedMeta?.image || fixedMeta?.image_url;
          const shouldUpdateImage =
            !nft.image || nft.image === PLACEHOLDER_IMG;
          if (shouldUpdateImage && img) {
            const resolved = await resolveImageUrl(img, uri).catch(() => null);
            setImage(resolved || ipfsToHttp(img));
          }
        }
      } catch (err) {
        const name = err?.errorName || "";
        const msg = String(err?.message || "");
        if (
          name === "NoToken" ||
          /not exist|nonexistent|NoToken/i.test(msg)
        ) {
          if (!cancelled) {
            setMetadata({
              name: tokenId ? `#${tokenId}` : "Biggi NFT",
              description: "Metadata unavailable (token burned or not minted).",
              image: PLACEHOLDER_IMG,
            });
            setImage(PLACEHOLDER_IMG);
          }
          return;
        }
        if (!cancelled && !nft?.isTicket && !currentMeta) {
          setMetadata({
            name: tokenId ? `Biggi NFT #${tokenId}` : "Biggi NFT",
            description: "Metadata is updating after redeem.",
            image: PLACEHOLDER_IMG,
          });
          setImage(PLACEHOLDER_IMG);
        }
        console.error("NftCard metadata fetch failed", err);
      } finally {
        if (!cancelled) setLoadingMeta(false);
        if (forceRefresh && tokenId) {
          forcedRefreshRef.current.add(tokenId);
        }
      }
    };
    // fetch even if some metadata exists, but avoid refetch loop
    const shouldFetch =
      !currentMeta ||
      !currentMeta.image ||
      (!nft?.isTicket &&
        looksLikeTicketMeta(currentMeta) &&
        tokenId &&
        !forcedRefreshRef.current.has(tokenId));
    if (shouldFetch) fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [
    contracts,
    metadataContract,
    nft.image,
    tokenId,
    nft?.isTicket,
    nft?.isPending,
  ]);

  React.useEffect(() => {
    let cancelled = false;
    const fetchMintData = async () => {
      if (!tokenId) return;
      const reader = contracts?.readerRead?.();
      const main = metadataContract || contracts?.mainRead?.();
      try {
        setLoadingMint(true);
        let ticketPrice = null;
        let blockPrice = null;
        let finalPrice = null;

        if (reader && typeof reader.getMintDataByTokenId === "function") {
          const res = await reader.getMintDataByTokenId(tokenId).catch(() => null);
          if (res) {
            ticketPrice = fmtEtherNum(res?.[0] ?? 0);
            blockPrice = fmtEtherNum(res?.[1] ?? 0);
            finalPrice = fmtEtherNum(res?.[2] ?? 0);
          }
        }

        // Fallback for deployments where the reader is missing/limited.
        if (ticketPrice == null && main) {
          const ticketCandidates = ["getTicketPrice", "ticketPrice"];
          for (const fn of ticketCandidates) {
            if (typeof main?.[fn] !== "function") continue;
            try {
              const v = await main[fn]();
              if (v != null) {
                ticketPrice = fmtEtherNum(v);
                break;
              }
            } catch {
              // try next candidate
            }
          }
        }

        if (blockPrice == null && main && typeof main.getCurrentBlockPriceByTokenId === "function") {
          try {
            const v = await main.getCurrentBlockPriceByTokenId(tokenId);
            if (v != null) blockPrice = fmtEtherNum(v);
          } catch {
            // ignore block price fallback failures
          }
        }

        if (finalPrice == null && blockPrice != null) {
          finalPrice = blockPrice;
        }

        if (ticketPrice == null && blockPrice == null && finalPrice == null) return;
        if (!cancelled) {
          setMintData((prev) => ({
            ticketPrice: ticketPrice ?? prev?.ticketPrice ?? null,
            blockPrice: blockPrice ?? prev?.blockPrice ?? null,
            finalPrice: finalPrice ?? prev?.finalPrice ?? null,
          }));
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
  }, [contracts, metadataContract, tokenId]);

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
    const merged = [
      ...base,
      ...dyn
        .map((e) => ({
          trait_type: String(e?.trait_type ?? ""),
          value: String(e?.value ?? ""),
        }))
        .filter((e) => e.trait_type),
    ];
    if (merged.length) return merged;
    if (nft?.isTicket) {
      return [
        { trait_type: "Type", value: "Mint Ticket" },
        {
          trait_type: "Status",
          value: nft?.isPending ? "VRF pending" : "Redeem to mint NFT",
        },
      ];
    }
    return merged;
  }, [metadata, dynamicTraits, nft?.isTicket, nft?.isPending]);

  const visibleAttributes = React.useMemo(
    () => (detailsOpen ? attributes : attributes.slice(0, 4)),
    [attributes, detailsOpen],
  );

  const title =
    metadata?.name || nft?.name || (tokenId ? `#${tokenId}` : "Biggi NFT");
  const rarityLabel =
    nft?.rarityRank != null ? `Rank #${nft.rarityRank}` : null;
  const imageSrc = image ? ipfsToHttp(image) : PLACEHOLDER_IMG;
  const imageIsIpfs = React.useMemo(() => {
    const rawPrimary = String(image || "");
    const rawSecondary = String(nft?.image || "");
    const raw = `${rawPrimary} ${rawSecondary}`.toLowerCase();
    return (
      raw.includes("ipfs://") ||
      raw.includes("/ipfs/") ||
      raw.includes("ipns://") ||
      raw.includes("/ipns/") ||
      raw.includes("pinata") ||
      raw.includes("mypinata") ||
      raw.includes("ipfs")
    );
  }, [image, nft?.image]);
  const showImageFallback =
    imageIsIpfs && (imageFailed || (!imageLoaded && isOffline));

  const handleToggleDetails = () => {
    setDetailsOpen((prev) => !prev);
    if (typeof onOpenDetails === "function") onOpenDetails(nft);
  };

  const handleZoom = () => {
    if (typeof onZoom === "function") onZoom({ ...nft, image: imageSrc });
  };

  const cardClassName = `nft-card${
    detailsOpen ? " nft-card--open" : ""
  }${highlight ? " nft-card--highlight" : ""}`;

  return (
    <article className={cardClassName}>
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
        <div className="nft-card__image-wrap">
          <img
            src={imageSrc}
            alt={title}
            loading="lazy"
            decoding="async"
            onClick={handleZoom}
            onLoad={() => setImageLoaded(true)}
            onError={() => {
              setImageFailed(true);
              if (image !== PLACEHOLDER_IMG) setImage(PLACEHOLDER_IMG);
            }}
          />
          {showImageFallback && (
            <div className="nft-card__image-fallback">
              IPFS image offline
            </div>
          )}
        </div>
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
                  : formatMatic(derivedMintData?.ticketPrice)}
              </strong>
            </div>
            <div title="Current block price">
              <span>Block (now)</span>
              <strong>
                {loadingBlockNow
                  ? "..."
                  : formatMatic(derivedMintData?.blockPriceNow)}
              </strong>
            </div>
            <div>
              <span>Final</span>
              <strong>
                {loadingMint
                  ? "..."
                  : formatMatic(derivedMintData?.finalPrice)}
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
