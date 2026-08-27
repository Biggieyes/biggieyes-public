// src/components/NftCard.jsx
import * as React from "react";
import { formatEther } from "ethers";
import { explorerBaseFor } from "@/config/chains.js";
import { DEFAULT_BLOCKS, ROWS_BY_BLOCK } from "@/shared/blocks";
import { buildBlockImagePath } from "@/shared/utils/images";
import { toMainNftIndexFromTokenId } from "@/shared/utils/biggiIdIndex";
import { mergeAttrs } from "@/shared/utils/metadata";
import "./NftCard.css";
import ImportNftButton from "./ImportNftButton";
import { useOptionalContracts } from "../providers/ContractsProvider";
import {
  httpFromIpfs,
  readJsonFromURI,
  resolveImageUrl,
} from "../shared/services/ipfs";

const PLACEHOLDER_IMG = "/images/Biggi.png";
const IPFS_HTTP_GATEWAYS = [
  "https://biggieyes.mypinata.cloud/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
];

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
const RARITY_TIERS = ["legendary", "epic", "rare", "uncommon", "common"];

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

const normalizeMainImageId = (rawMainId, tokenId) => {
  const fromRaw = toMainNftIndexFromTokenId(rawMainId, {
    maxSupply: 550,
    allowLegacy: true,
  });
  if (fromRaw != null) return String(fromRaw);

  const fromTokenId = toMainNftIndexFromTokenId(tokenId, {
    maxSupply: 550,
    allowLegacy: true,
  });
  if (fromTokenId != null) return String(fromTokenId);

  const fallback = String(rawMainId ?? "").trim();
  return /^\d+$/.test(fallback) ? fallback : "";
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

const normalizeBlockName = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (DEFAULT_BLOCKS.includes(upper)) return upper;
  for (const name of DEFAULT_BLOCKS) {
    if (upper.includes(name)) return name;
  }
  return null;
};

const getAttrValue = (attrs, keys) => {
  if (!Array.isArray(attrs) || !attrs.length) return null;
  const keySet = new Set(keys.map((key) => String(key).toLowerCase()));
  const hit = attrs.find((attr) =>
    keySet.has(String(attr?.trait_type ?? "").toLowerCase()),
  );
  return hit?.value ?? null;
};

const rarityTierFromBlockRank = (blockRank) => {
  if (!Number.isFinite(Number(blockRank))) return null;
  const rank = Number(blockRank);
  if (rank <= 2) return "legendary";
  if (rank <= 4) return "epic";
  if (rank <= 6) return "rare";
  if (rank <= 8) return "uncommon";
  return "common";
};

const formatRarityLabel = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (!RARITY_TIERS.includes(normalized)) return null;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const normalizeCandidate = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const trimIpfsPath = (value) => String(value || "").replace(/^\/+|\/+$/g, "");

const extractIpfsPayload = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^ipfs:\/\//i.test(raw)) {
    return trimIpfsPath(raw.replace(/^ipfs:\/\//i, ""));
  }
  try {
    const parsed = new URL(raw);
    const match = String(parsed.pathname || "").match(/\/ipfs\/([^?#]+)/i);
    if (match?.[1]) return trimIpfsPath(match[1]);
  } catch {
    // ignore malformed URLs
  }
  return "";
};

const buildImageFallbackCandidates = (...values) => {
  const out = [];
  const seen = new Set();
  const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];
  const push = (candidate) => {
    const normalized = normalizeCandidate(candidate);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(String(candidate));
  };
  const pushWithAlternatives = (candidate) => {
    const raw = String(candidate || "").trim();
    if (!raw) return;
    push(raw);
    const extMatch = raw.match(/\.(png|jpe?g|webp)(\?.*)?$/i);
    if (!extMatch) return;
    const currentExt = String(extMatch[1] || "").toLowerCase();
    const query = extMatch[2] || "";
    const base = raw.slice(0, extMatch.index);
    for (const ext of IMAGE_EXTENSIONS) {
      if (ext === currentExt) continue;
      push(`${base}.${ext}${query}`);
    }
  };

  for (const value of values) {
    const raw = String(value || "").trim();
    if (!raw) continue;
    const payload = extractIpfsPayload(raw);
    if (payload) {
      for (const base of IPFS_HTTP_GATEWAYS) {
        pushWithAlternatives(`${base}${payload}`);
      }
      pushWithAlternatives(ipfsToHttp(raw));
      continue;
    }
    if (/^https?:\/\//i.test(raw)) pushWithAlternatives(raw);
  }

  return out;
};

const normaliseAttributes = (meta) => {
  if (!meta) return [];
  const attrs = Array.isArray(meta.attributes) ? meta.attributes : [];
  return attrs
    .filter((e) => e && e.trait_type != null && e.value != null)
    .map((e) => ({ trait_type: String(e.trait_type), value: String(e.value) }));
};

const metadataFingerprint = (meta) => {
  if (!meta || typeof meta !== "object") return "";
  const attrs = normaliseAttributes(meta)
    .map((entry) => `${entry.trait_type}:${entry.value}`)
    .sort()
    .join("|");
  return [
    String(meta?.name || ""),
    String(meta?.description || ""),
    String(meta?.image || ""),
    String(meta?.image_url || ""),
    String(meta?.external_url || ""),
    attrs,
  ].join("::");
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

const formatTraitPrice = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return `${numeric.toFixed(4)} POL`;
};

const parseMatic = (value) => {
  if (value == null) return null;
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  const m = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isNaN(n) ? null : n;
};

const isPositivePrice = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const normalizeTraitType = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const looksLikeTicketMeta = (meta) => {
  if (!meta) return false;
  const name = String(meta?.name || "").toLowerCase();
  const desc = String(meta?.description || "").toLowerCase();
  return name.includes("ticket") || desc.includes("ticket");
};

const normalizeExternalUrl = (value) => {
  if (!value) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (/^[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(raw)) return `https://${raw}`;
  return "";
};

const pickSeedImageFromNft = (nft) => {
  const direct = String(nft?.image || "").trim();
  if (direct && direct !== PLACEHOLDER_IMG) return direct;
  const fromMeta = String(
    nft?.meta?.image || nft?.meta?.image_url || "",
  ).trim();
  if (fromMeta) return fromMeta;
  if (direct) return direct;
  return null;
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
  liveTicketPrice = null,
  activeTicketChapterId = null,
  activeTicketChapterCount = 0,
  dynamicTraits = {},
  onOpenDetails,
  fallbackContractAddress = null,
  highlight = false,
  promoted = false,
}) {
  // HOOKS must be called deterministically; keep outside conditionals
  const contracts = useOptionalContracts();

  const tokenId = nft?.tokenId != null ? String(nft.tokenId) : null;
  const ticketChapterId = Number.isSafeInteger(Number(nft?.chapterId))
    ? Number(nft.chapterId)
    : null;
  const ticketAvailability = React.useMemo(() => {
    if (!nft?.isTicket) return null;
    if (activeTicketChapterCount === 0) return "Waiting for chapter";
    if (activeTicketChapterCount > 1) return "Unavailable";
    return ticketChapterId === activeTicketChapterId
      ? "Redeemable"
      : "Future chapter";
  }, [
    nft?.isTicket,
    ticketChapterId,
    activeTicketChapterId,
    activeTicketChapterCount,
  ]);
  const displayTokenId = React.useMemo(() => {
    if (!tokenId) return null;
    const mainIdx = toMainNftIndexFromTokenId(tokenId, {
      maxSupply: 550,
      allowLegacy: true,
    });
    if (mainIdx != null) return String(mainIdx);
    return tokenId;
  }, [tokenId]);
  const seedImage = React.useMemo(
    () => pickSeedImageFromNft(nft),
    [nft?.image, nft?.meta?.image, nft?.meta?.image_url],
  );

  const [metadata, setMetadata] = React.useState(nft.meta || null);
  const [image, setImage] = React.useState(nft.image || null);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  const [isOffline, setIsOffline] = React.useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [mintData, setMintData] = React.useState(() => {
    if (nft?.mint) {
      const initialTicket = parseMatic(
        nft.mint.ticketPrice ?? nft.mint.mintTicket,
      );
      return {
        ticketPrice: isPositivePrice(initialTicket) ? initialTicket : null,
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
  const [imageZoomed, setImageZoomed] = React.useState(false);
  const metadataRef = React.useRef(metadata);
  const syncedTokenIdRef = React.useRef(tokenId);
  const onchainFallbackRef = React.useRef(new Set());
  const failedImageCandidatesRef = React.useRef(new Set());

  const contractAddress = React.useMemo(() => {
    if (nft?.contractAddress) return nft.contractAddress;
    if (fallbackContractAddress) return fallbackContractAddress;
    try {
      const main = contracts?.mainRead?.();
      return main?.target ?? main?.address ?? null;
    } catch {
      return null;
    }
  }, [contracts, nft?.contractAddress, fallbackContractAddress]);

  const metadataContract = React.useMemo(() => {
    if (!contracts) return null;
    try {
      const resolved = contracts?.collectionReadByAddress?.(contractAddress);
      if (resolved) return resolved;
    } catch {
      // Fall back to the original chapter contracts below.
    }
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
    const target = contractAddress ? String(contractAddress).toLowerCase() : "";
    if (target) {
      if (
        main &&
        String(main.target || main.address || "").toLowerCase() === target
      )
        return main;
      if (
        main2 &&
        String(main2.target || main2.address || "").toLowerCase() === target
      )
        return main2;
    }
    return main || main2 || null;
  }, [contracts, contractAddress]);

  const forcedRefreshRef = React.useRef(new Set());

  React.useEffect(() => {
    if (syncedTokenIdRef.current !== tokenId) {
      syncedTokenIdRef.current = tokenId;
      setMetadata(nft.meta || null);
      return;
    }

    const nextMeta = nft.meta || null;
    if (!nextMeta) return;
    const nextFingerprint = metadataFingerprint(nextMeta);
    setMetadata((prev) =>
      metadataFingerprint(prev) === nextFingerprint ? prev : nextMeta,
    );
  }, [tokenId, nft.meta]);

  React.useEffect(() => {
    setImage(seedImage);
    setImageLoaded(false);
    setImageFailed(false);
    setImageZoomed(false);
    failedImageCandidatesRef.current = new Set();
  }, [seedImage, tokenId]);

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

      const needsImage = !image || image === PLACEHOLDER_IMG || imageFailed;
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
        info = await main.nftInfo(displayTokenId).catch(() => null);
      }
      if (!info) return;

      const blockIdx = info?.blockIdx ?? info?.[2];
      const background = info?.background ?? info?.[1];
      const mainIdRaw = info?.mainId ?? info?.[3];
      const mainId = normalizeMainImageId(mainIdRaw, tokenId);

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
    displayTokenId,
    image,
    imageFailed,
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
            const { mainId: parsedMainId, blockName, bgCode } = parsed;
            const mainId = normalizeMainImageId(parsedMainId, tokenId);
            const bgName = bgNameFromCode(bgCode) || bgCode;
            const mainLabel = mainId || displayTokenId || tokenId;
            const fallbackMeta = {
              name: `Biggi NFT #${mainLabel}`,
              description: "Metadata is updating on-chain.",
              attributes: [
                blockName ? { trait_type: "Block", value: blockName } : null,
                bgName ? { trait_type: "Background", value: bgName } : null,
              ].filter(Boolean),
            };
            setMetadata((prev) => prev || fallbackMeta);
            const fallbackImage = buildBlockImageUrl(
              null,
              blockName,
              bgCode,
              mainId,
            );
            if (fallbackImage) setImage(fallbackImage);
          }
          return;
        }
        const ticketLike = !nft?.isTicket && looksLikeTicketMeta(json);
        const fixedMeta = ticketLike
          ? {
              ...(json || {}),
              name: `Biggi NFT #${displayTokenId || tokenId}`,
              description: "Metadata is updating on-chain.",
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
          const shouldUpdateImage = !nft.image || nft.image === PLACEHOLDER_IMG;
          if (shouldUpdateImage && img) {
            const resolved = await resolveImageUrl(img, uri).catch(() => null);
            setImage(resolved || ipfsToHttp(img));
          }
        }
      } catch (err) {
        const name = err?.errorName || "";
        const msg = String(err?.message || "");
        if (name === "NoToken" || /not exist|nonexistent|NoToken/i.test(msg)) {
          if (!cancelled) {
            setMetadata({
              name: displayTokenId ? `#${displayTokenId}` : "Biggi NFT",
              description: "Metadata unavailable (token burned or not minted).",
              image: PLACEHOLDER_IMG,
            });
            setImage(PLACEHOLDER_IMG);
          }
          return;
        }
        if (!cancelled && !nft?.isTicket && !currentMeta) {
          setMetadata({
            name: displayTokenId ? `Biggi NFT #${displayTokenId}` : "Biggi NFT",
            description: "Metadata is updating on-chain.",
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
    displayTokenId,
    nft?.isTicket,
    nft?.isPending,
  ]);

  React.useEffect(() => {
    let cancelled = false;
    const fetchMintData = async () => {
      if (!tokenId) return;
      const reader = metadataContract ? null : contracts?.readerRead?.();
      const main = metadataContract || contracts?.mainRead?.();
      try {
        setLoadingMint(true);
        let ticketPrice = null;
        let blockPrice = null;
        let finalPrice = null;

        if (reader && typeof reader.getMintDataByTokenId === "function") {
          const res = await reader
            .getMintDataByTokenId(tokenId)
            .catch(() => null);
          if (res) {
            const tp = fmtEtherNum(res?.[0] ?? 0);
            if (isPositivePrice(tp)) ticketPrice = tp;
            blockPrice = fmtEtherNum(res?.[1] ?? 0);
            finalPrice = fmtEtherNum(res?.[2] ?? 0);
          }
        }

        // Some deployments expose per-index mint data only.
        if (
          ticketPrice == null &&
          reader &&
          typeof reader.getMintData === "function"
        ) {
          const res = await reader
            .getMintData(displayTokenId)
            .catch(() => null);
          if (res) {
            const tp = fmtEtherNum(res?.[0] ?? 0);
            if (isPositivePrice(tp)) ticketPrice = tp;
            if (blockPrice == null) blockPrice = fmtEtherNum(res?.[1] ?? 0);
            if (finalPrice == null) finalPrice = fmtEtherNum(res?.[2] ?? 0);
          }
        }

        if (
          ticketPrice == null &&
          main &&
          typeof main.getMintData === "function"
        ) {
          const res = await main.getMintData(displayTokenId).catch(() => null);
          if (res) {
            const tp = fmtEtherNum(res?.[0] ?? 0);
            if (isPositivePrice(tp)) ticketPrice = tp;
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

        if (
          blockPrice == null &&
          main &&
          typeof main.getCurrentBlockPriceByTokenId === "function"
        ) {
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

        if (ticketPrice == null && blockPrice == null && finalPrice == null)
          return;
        if (!cancelled) {
          setMintData((prev) => ({
            ticketPrice:
              ticketPrice ??
              (isPositivePrice(prev?.ticketPrice) ? prev.ticketPrice : null),
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
  }, [contracts, metadataContract, tokenId, displayTokenId]);

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
      const reader = metadataContract ? null : contracts?.readerRead?.();
      const main = metadataContract || contracts?.mainRead?.();

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
    metadataContract,
    tokenId,
    blockIdFromTraits,
    mintData?.blockPrice,
    dynamicTraits?.currentBlockPrice,
    dynamicTraits?.mintBlock,
  ]);

  const liveTicketPriceValue = React.useMemo(() => {
    const parsed = parseMatic(liveTicketPrice);
    return isPositivePrice(parsed) ? parsed : null;
  }, [liveTicketPrice]);
  const hasLiveTicketPrice =
    nft?.isTicket && isPositivePrice(liveTicketPriceValue);

  const derivedTicketPrice = React.useMemo(() => {
    if (nft?.isTicket && isPositivePrice(liveTicketPriceValue)) {
      return liveTicketPriceValue;
    }
    const fromMintData = mintData?.ticketPrice;
    if (isPositivePrice(fromMintData)) return fromMintData;
    const fromTraits = parseMatic(dynamicTraits?.mintTicket);
    if (isPositivePrice(fromTraits)) return fromTraits;
    return null;
  }, [
    nft?.isTicket,
    liveTicketPriceValue,
    mintData?.ticketPrice,
    dynamicTraits?.mintTicket,
  ]);

  const derivedMintData = React.useMemo(
    () => ({
      ticketPrice: derivedTicketPrice,
      blockPriceNow:
        currentBlockPrice != null
          ? currentBlockPrice
          : (mintData?.blockPrice ?? parseMatic(dynamicTraits?.mintBlock)),
      finalPrice:
        mintData?.finalPrice ??
        parseMatic(dynamicTraits?.mintFinal ?? dynamicTraits?.finalPrice),
    }),
    [derivedTicketPrice, mintData, dynamicTraits, currentBlockPrice],
  );

  const priceAttributes = React.useMemo(() => {
    const out = [];
    const ticketPriceTraitLabel = nft?.isTicket
      ? "Current Ticket Price"
      : "Ticket Price";
    const ticketPriceValue = formatTraitPrice(derivedMintData?.ticketPrice);
    const blockPriceValue = formatTraitPrice(
      mintData?.blockPrice ?? parseMatic(dynamicTraits?.mintBlock),
    );
    const finalPriceValue = formatTraitPrice(
      mintData?.finalPrice ??
        parseMatic(dynamicTraits?.mintFinal ?? dynamicTraits?.finalPrice),
    );

    if (ticketPriceValue) {
      out.push({ trait_type: ticketPriceTraitLabel, value: ticketPriceValue });
    }
    if (!nft?.isTicket && blockPriceValue) {
      out.push({ trait_type: "Block Price", value: blockPriceValue });
    }
    if (!nft?.isTicket && finalPriceValue) {
      out.push({ trait_type: "Final Price", value: finalPriceValue });
    }

    return out;
  }, [
    derivedMintData?.ticketPrice,
    mintData?.blockPrice,
    mintData?.finalPrice,
    dynamicTraits?.mintBlock,
    dynamicTraits?.mintFinal,
    dynamicTraits?.finalPrice,
    nft?.isTicket,
  ]);

  const attributes = React.useMemo(() => {
    const base = normaliseAttributes(metadata);
    const dyn = Array.isArray(dynamicTraits?.attributes)
      ? dynamicTraits.attributes
      : [];
    const dynamicAttributeList = dyn
      .map((e) => ({
        trait_type: String(e?.trait_type ?? ""),
        value: String(e?.value ?? ""),
      }))
      .filter((e) => e.trait_type);
    let mergedBase = mergeAttrs(base, dynamicAttributeList);
    if (nft?.isTicket) {
      mergedBase = mergedBase.filter((attr) => {
        const key = normalizeTraitType(attr?.trait_type);
        return (
          key !== "ticket price" &&
          key !== "current ticket price" &&
          key !== "type" &&
          key !== "status" &&
          key !== "utility"
        );
      });
    }
    let merged = mergeAttrs(mergedBase, priceAttributes);
    if (merged.length) {
      if (nft?.isTicket && priceAttributes.length) {
        const priceKeys = new Set(
          priceAttributes.map((attr) => normalizeTraitType(attr?.trait_type)),
        );
        const priceFirst = [];
        const rest = [];
        merged.forEach((attr) => {
          if (priceKeys.has(normalizeTraitType(attr?.trait_type))) {
            priceFirst.push(attr);
          } else {
            rest.push(attr);
          }
        });
        return [...priceFirst, ...rest];
      }
      return merged;
    }
    if (nft?.isTicket) {
      return [];
    }
    return merged;
  }, [metadata, dynamicTraits, nft?.isTicket, nft?.isPending, priceAttributes]);

  const visibleAttributes = React.useMemo(
    () => (detailsOpen ? attributes : attributes.slice(0, 4)),
    [attributes, detailsOpen],
  );

  const title =
    metadata?.name ||
    nft?.name ||
    (displayTokenId ? `#${displayTokenId}` : "Biggi NFT");
  const rarityTier = React.useMemo(() => {
    if (nft?.isTicket) return null;
    const attrs = normaliseAttributes(metadata);
    const explicitRarity = String(
      nft?.rarity ?? getAttrValue(attrs, ["rarity", "tier"]) ?? "",
    )
      .trim()
      .toLowerCase();
    if (RARITY_TIERS.includes(explicitRarity)) return explicitRarity;

    const blockValue =
      getAttrValue(attrs, [
        "block/eye color",
        "block",
        "eye color",
        "linked block",
        "block color",
      ]) ??
      dynamicTraits?.linkedBlock ??
      dynamicTraits?.block ??
      dynamicTraits?.blockName;
    const blockName = normalizeBlockName(blockValue);
    const blockRank =
      blockName && ROWS_BY_BLOCK?.[blockName]
        ? Number(ROWS_BY_BLOCK[blockName])
        : null;
    return rarityTierFromBlockRank(blockRank);
  }, [
    nft?.isTicket,
    nft?.rarity,
    metadata,
    dynamicTraits?.linkedBlock,
    dynamicTraits?.block,
    dynamicTraits?.blockName,
  ]);
  const rarityLabel = formatRarityLabel(rarityTier);
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
  const externalHref = React.useMemo(() => {
    const metaUrl = normalizeExternalUrl(metadata?.external_url);
    if (metaUrl) return metaUrl;

    if (!contractAddress || !tokenId) return "";
    const chainIdCandidate = Number(nft?.chainId || metadata?.chainId || 137);
    const explorerBase =
      explorerBaseFor(chainIdCandidate) ||
      explorerBaseFor(137) ||
      "https://polygonscan.com";
    if (!explorerBase) return "";

    const token = encodeURIComponent(String(tokenId));
    return `${explorerBase}/token/${String(contractAddress)}?a=${token}`;
  }, [
    metadata?.external_url,
    metadata?.chainId,
    contractAddress,
    tokenId,
    nft?.chainId,
  ]);

  const handleToggleDetails = () => {
    setDetailsOpen((prev) => !prev);
    if (typeof onOpenDetails === "function") onOpenDetails(nft);
  };

  const handleZoom = () => setImageZoomed((prev) => !prev);

  React.useEffect(() => {
    if (!imageZoomed || typeof window === "undefined") return;
    const handleEsc = (event) => {
      if (event.key === "Escape") setImageZoomed(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [imageZoomed]);

  const cardClassName = `nft-card${
    detailsOpen ? " nft-card--open" : ""
  }${highlight ? " nft-card--highlight" : ""}${
    promoted ? " nft-card--promoted" : ""
  }${imageZoomed ? " nft-card--image-zoomed" : ""}`;

  return (
    <article className={cardClassName}>
      <div className="nft-card__figure">
        <button
          type="button"
          className="nft-card__zoom"
          aria-pressed={imageZoomed ? "true" : "false"}
          onClick={handleZoom}
        >
          {imageZoomed ? "Close" : "Zoom"}
        </button>
        {nft.isTicket && (
          <span className="nft-card__badge">
            Ticket{ticketChapterId ? ` / Chapter ${ticketChapterId}` : ""}
          </span>
        )}
        {!nft.isTicket && promoted && (
          <span className="nft-card__fresh">Fresh redeem</span>
        )}
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
              const failed = failedImageCandidatesRef.current;
              const currentKey = normalizeCandidate(imageSrc);
              if (currentKey) failed.add(currentKey);

              const nextCandidate = buildImageFallbackCandidates(
                imageSrc,
                image,
                nft?.image,
                metadata?.image,
                metadata?.image_url,
                nft?.meta?.image,
                nft?.meta?.image_url,
              ).find((candidate) => !failed.has(normalizeCandidate(candidate)));

              if (nextCandidate) {
                setImage(nextCandidate);
                return;
              }

              if (image !== PLACEHOLDER_IMG) setImage(PLACEHOLDER_IMG);
            }}
          />
          {showImageFallback && (
            <div className="nft-card__image-fallback">IPFS image offline</div>
          )}
        </div>
      </div>

      <div className="nft-card__body">
        <div className="nft-card__header">
          <h3 className="nft-card__title" title={title}>
            {title}
          </h3>
          {rarityLabel && (
            <span
              className={`nft-card__rarity nft-card__rarity--${rarityTier}`}
            >
              {rarityLabel}
            </span>
          )}
        </div>

        <div className="nft-card__section">
          <div className="nft-card__section-title">
            {nft?.isTicket ? "Ticket status" : "Mint summary"}
          </div>
          <div
            className={`nft-card__stats${nft?.isTicket ? " nft-card__stats--ticket" : ""}`}
          >
            <div>
              <span>{nft?.isTicket ? "Ticket price" : "Ticket"}</span>
              <strong>
                {loadingMint && !hasLiveTicketPrice
                  ? "..."
                  : formatMatic(derivedMintData?.ticketPrice)}
              </strong>
            </div>
            {nft?.isTicket && (
              <div>
                <span>Availability</span>
                <strong>{ticketAvailability}</strong>
              </div>
            )}
            {!nft?.isTicket && (
              <div title="Current block price">
                <span>Block (now)</span>
                <strong>
                  {loadingBlockNow
                    ? "..."
                    : formatMatic(derivedMintData?.blockPriceNow)}
                </strong>
              </div>
            )}
            {!nft?.isTicket && (
              <div>
                <span>Final</span>
                <strong>
                  {loadingMint
                    ? "..."
                    : formatMatic(derivedMintData?.finalPrice)}
                </strong>
              </div>
            )}
          </div>
        </div>

        <div className="nft-card__section">
          {detailsOpen && loadingMeta && !attributes.length && (
            <div className="nft-card__placeholder">Loading metadata...</div>
          )}
          {detailsOpen && !loadingMeta && attributes.length === 0 && (
            <div className="nft-card__placeholder">No details available.</div>
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
          {externalHref && (
            <a
              className="nft-card__external"
              href={externalHref}
              target="_blank"
              rel="noreferrer"
            >
              Explorer
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
