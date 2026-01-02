// src/utils/fallbackProvider.js
// Robustní fallback provider + health checks (ethers v5)
import { ethers } from "ethers";
import { PUBLIC_AMOY_RPCS } from "./contract.js";

const { JsonRpcProvider, FallbackProvider } = ethers.providers;

function _env(key) {
  try {
    return typeof import.meta !== "undefined" && import.meta.env ? import.meta.env[key] : process.env[key];
  } catch {
    return undefined;
  }
}

function parseCsvUrls() {
  const envSingle = _env("VITE_AMOY_RPC_URL");
  const envCsv = _env("VITE_ADDITIONAL_RPC_URLS");
  const urls = [];

  if (envSingle && String(envSingle).trim()) urls.push(String(envSingle).trim());
  if (envCsv && String(envCsv).trim()) {
    String(envCsv)
      .split(",")
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .forEach((u) => urls.push(u));
  }

  // add sensible public fallbacks (deduped later)
  urls.push(...PUBLIC_AMOY_RPCS);

  // dedupe preserving order
  return Array.from(new Set(urls));
}

async function checkRpcUrl(url, timeout = 2000) {
  try {
    const p = new JsonRpcProvider(url, 80002);
    // race provider call vs timeout
    const result = await Promise.race([
      p.getBlockNumber(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), timeout)),
    ]);
    // if numeric block number returned -> healthy
    return typeof result === "number";
  } catch {
    return false;
  }
}

let _provider = null;
let _healthyUrls = [];
let _allUrls = [];
let _healthIntervalHandle = null;

/**
 * buildProviderFromUrls(urls)
 *  - urls: array of RPC urls in prefered order
 * returns ethers provider (FallbackProvider or JsonRpcProvider)
 */
function buildProviderFromUrls(urls = []) {
  if (!urls || !urls.length) throw new Error("No RPC urls provided");

  if (urls.length === 1) {
    return new JsonRpcProvider(urls[0], 80002);
  }

  const configs = urls.map((u, i) => ({
    provider: new JsonRpcProvider(u, 80002),
    priority: i + 1,
    stallTimeout: 1500,
    weight: 1,
  }));

  try {
    return new FallbackProvider(configs, 1); // quorum 1
  } catch {
    // fallback to first url single provider
    return new JsonRpcProvider(urls[0], 80002);
  }
}

/** rebuild provider using current healthyUrls (preserve original ordering) */
function rebuildProvider() {
  const urls = _healthyUrls.length ? _healthyUrls : _allUrls;
  _provider = buildProviderFromUrls(urls);
  return _provider;
}

/** public init: run initial checks and start periodic health checking */
export async function initFallbackProvider({ healthCheckInterval = 45000, healthTimeout = 2000 } = {}) {
  _allUrls = parseCsvUrls();

  // initial health check (parallel)
  const checks = await Promise.all(_allUrls.map((u) => checkRpcUrl(u, healthTimeout).then((ok) => ({ u, ok }))));
  _healthyUrls = checks.filter((c) => c.ok).map((c) => c.u);

  // if none healthy, keep all as fallback (we'll still try)
  if (!_healthyUrls.length) _healthyUrls = [..._allUrls];

  rebuildProvider();

  // periodic health checks
  if (_healthIntervalHandle) clearInterval(_healthIntervalHandle);
  _healthIntervalHandle = setInterval(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      const results = await Promise.all(_allUrls.map((u) => checkRpcUrl(u, healthTimeout).then((ok) => ({ u, ok }))));
      const newHealthy = results.filter((r) => r.ok).map((r) => r.u);

      // keep original order from _allUrls
      _healthyUrls = _allUrls.filter((u) => newHealthy.includes(u));
      if (!_healthyUrls.length) _healthyUrls = [..._allUrls];

      // rebuild if changed
      rebuildProvider();
    } catch {
      // ignore interval errors
      // console.warn("health-check error", e);
    }
  }, healthCheckInterval);

  return _provider;
}

/** return the current provider (initFallbackProvider should be called first ideally) */
export function getProvider() {
  if (!_provider) {
    // lazy init with defaults if not initialized
    _allUrls = parseCsvUrls();
    _healthyUrls = [..._allUrls];
    _provider = buildProviderFromUrls(_healthyUrls);
  }
  return _provider;
}

/** force immediate rebuild (e.g. after you changed env at runtime) */
export async function forceRebuild({ timeout = 2000 } = {}) {
  _allUrls = parseCsvUrls();
  const checks = await Promise.all(_allUrls.map((u) => checkRpcUrl(u, timeout).then((ok) => ({ u, ok }))));
  _healthyUrls = checks.filter((c) => c.ok).map((c) => c.u);
  if (!_healthyUrls.length) _healthyUrls = [..._allUrls];
  return rebuildProvider();
}

/** stop periodic health checks (useful in tests) */
export function stopHealthChecks() {
  if (_healthIntervalHandle) {
    clearInterval(_healthIntervalHandle);
    _healthIntervalHandle = null;
  }
}

export default {
  initFallbackProvider,
  getProvider,
  forceRebuild,
  stopHealthChecks,
};
