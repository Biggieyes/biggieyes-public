// src/components/LiveChatPanel.jsx
// Live chat UI backed by Supabase realtime and a serverless signature-verified API.
import * as React from "react";
import { BrowserProvider } from "ethers";
import { supabase, supabaseReady } from "../services/chatClient";
import { getInjectedProvider } from "@/shared/utils/contract";
import "./LiveChatPanel.css";

const API_BASE = import.meta.env.VITE_CHAT_API_BASE || "";
const API_BASE_FALLBACKS = [
  import.meta.env.VITE_API_BASE_URL || "",
  import.meta.env.VITE_MOD_API_BASE || "",
].filter(Boolean);
const API_TIMEOUT_MS = (() => {
  const parsed = Number(
    import.meta.env.VITE_CHAT_API_TIMEOUT_MS ||
      import.meta.env.VITE_API_TIMEOUT_MS,
  );
  if (Number.isFinite(parsed) && parsed > 0) return Math.trunc(parsed);
  return 12_000;
})();
const MAX_LEN = 280;
const BAD_WORDS = ["spam", "scam", "phish"]; // basic default list for expansion

const shortAddress = (addr) => {
  if (!addr) return "0x----";
  const s = String(addr);
  return `${s.slice(0, 6)}...${s.slice(-4)}`;
};

const formatTime = (iso) => {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const hasProfanity = (value) => {
  const text = String(value || "").toLowerCase();
  return BAD_WORDS.some((word) => text.includes(word));
};

const buildPayload = (nonce, content, timestamp) =>
  `${nonce}|${content}|${timestamp}`;

const normalizeApiPath = (path) => {
  const safe = String(path || "").trim();
  if (!safe) return "";
  return safe.startsWith("/") ? safe : `/${safe}`;
};

const buildApiCandidates = (path) => {
  const safePath = normalizeApiPath(path);
  if (!safePath) return [];

  const add = (list, value) => {
    const item = String(value || "").trim();
    if (item && !list.includes(item)) list.push(item);
  };

  const buildFromBase = (baseInput) => {
    const list = [];
    const base = String(baseInput || "").replace(/\/+$/, "");
    if (!base) {
      add(list, `/api${safePath}`);
      add(list, `/.netlify/functions${safePath}`);
      return list;
    }

    if (base.includes("/.netlify/functions")) {
      add(list, `${base}${safePath}`);
      const root = base.replace(/\/\.netlify\/functions$/i, "");
      add(list, `${root || ""}/api${safePath}`);
      return list;
    }

    if (/\/api$/i.test(base)) {
      add(list, `${base}${safePath}`);
      const root = base.replace(/\/api$/i, "");
      add(list, `${root}/.netlify/functions${safePath}`);
      return list;
    }

    add(list, `${base}/api${safePath}`);
    add(list, `${base}/.netlify/functions${safePath}`);
    add(list, `${base}${safePath}`);
    return list;
  };

  const merged = [];
  buildFromBase(API_BASE).forEach((candidate) => add(merged, candidate));
  API_BASE_FALLBACKS.forEach((fallbackBase) => {
    buildFromBase(fallbackBase).forEach((candidate) => add(merged, candidate));
  });
  buildFromBase("").forEach((candidate) => add(merged, candidate));
  return merged;
};

const fetchJsonWithTimeout = async (
  urlOrUrls,
  { timeoutMs = API_TIMEOUT_MS, ...options } = {},
) => {
  const candidates = (Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  if (!candidates.length) {
    throw new Error("Chat API URL is not configured.");
  }

  const ms = Number.isFinite(Number(timeoutMs))
    ? Math.max(0, Math.trunc(Number(timeoutMs)))
    : 0;

  let lastError = null;
  for (let idx = 0; idx < candidates.length; idx += 1) {
    const url = candidates[idx];
    const controller =
      typeof AbortController !== "undefined" && ms > 0
        ? new AbortController()
        : null;
    const timer = controller ? setTimeout(() => controller.abort(), ms) : null;
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller?.signal,
        cache: "no-store",
      });
      const raw = await response.text();
      let json = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        json = {};
      }

      if (!response.ok) {
        const textSnippet =
          typeof raw === "string" && raw.trim()
            ? raw.trim().slice(0, 140)
            : "";
        const reason =
          json?.error ||
          json?.message ||
          textSnippet ||
          `HTTP ${response.status}`;
        const err = new Error(`HTTP ${response.status}: ${reason}`);
        err.status = response.status;
        throw err;
      }
      return json;
    } catch (error) {
      if (error?.name === "AbortError" && ms > 0) {
        lastError = new Error(`Endpoint timeout after ${ms} ms`);
        break;
      }
      lastError = error;
      const status = Number(error?.status);
      const shouldTryNext =
        idx < candidates.length - 1 && (status === 404 || status === 405);
      if (!shouldTryNext) break;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  if (
    !API_BASE &&
    Number(lastError?.status) === 404 &&
    typeof window !== "undefined"
  ) {
    throw new Error(
      "Chat API endpoint not reachable. Run with `npm run dev:netlify` or set VITE_CHAT_API_BASE.",
    );
  }

  throw lastError || new Error("Request failed");
};

const formatChatError = (err) => {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  const message =
    err.message || err.msg || err.error_description || err.details || err.hint;
  if (message) return message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
};

const isMissingTableError = (err) =>
  err?.code === "PGRST205" ||
  /Could not find the table/i.test(formatChatError(err));

function LiveChatPanel({ walletAddress = "" }) {
  const [messages, setMessages] = React.useState([]);
  const [rulesText, setRulesText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [content, setContent] = React.useState("");
  const [name, setName] = React.useState("");
  const [chatDisabled, setChatDisabled] = React.useState(false);
  const [preferApiPolling, setPreferApiPolling] = React.useState(false);
  const [isDesktopCompact, setIsDesktopCompact] = React.useState(false);
  const rootRef = React.useRef(null);
  const listRef = React.useRef(null);
  const rulesWarnedRef = React.useRef(false);
  const loadWarnedRef = React.useRef(false);
  const sendWarnedRef = React.useRef(false);

  const isConnected = Boolean(walletAddress);

  const sortedMessages = React.useMemo(() => {
    return [...messages].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return aTime - bTime;
    });
  }, [messages]);

  const loadFromApiBootstrap = React.useCallback(async () => {
    const json = await fetchJsonWithTimeout(buildApiCandidates("/chat-bootstrap"), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!json?.ok) {
      throw new Error(json?.error || "Chat bootstrap failed");
    }
    const list = Array.isArray(json?.messages) ? json.messages : [];
    setMessages(list);
    setRulesText(json?.rulesText ? String(json.rulesText) : "");
    setChatDisabled(false);
    setPreferApiPolling(true);
  }, []);

  const loadInitial = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!supabaseReady) {
        await loadFromApiBootstrap();
        return;
      }

      const [rulesRes, msgsRes] = await Promise.all([
        supabase.from("rules").select("text").eq("id", 1).maybeSingle(),
        supabase
          .from("messages")
          .select(
            "id,author_address,author_name,content,created_at,edited_at,deleted",
          )
          .order("created_at", { ascending: false })
          .limit(80),
      ]);

      const missingMessagesTable = isMissingTableError(msgsRes?.error);
      if (missingMessagesTable) {
        try {
          await loadFromApiBootstrap();
          return;
        } catch {
          setError(
            "Live chat tables are missing in Supabase. Run sql/migration_init.sql.",
          );
          setChatDisabled(true);
          return;
        }
      }

      const missingRulesTable = isMissingTableError(rulesRes?.error);
      if (
        rulesRes?.error &&
        !missingRulesTable &&
        !rulesWarnedRef.current
      ) {
        console.warn(
          "LiveChatPanel rules load failed",
          formatChatError(rulesRes.error),
        );
        rulesWarnedRef.current = true;
      }
      if (rulesRes?.data?.text) {
        setRulesText(String(rulesRes.data.text));
      } else if (missingRulesTable) {
        setRulesText("");
      }

      if (msgsRes?.error) {
        try {
          await loadFromApiBootstrap();
          return;
        } catch (apiErr) {
          if (!loadWarnedRef.current) {
            console.warn(
              "LiveChatPanel load failed",
              formatChatError(msgsRes.error),
            );
            loadWarnedRef.current = true;
          }
          setError(`Failed to load chat: ${formatChatError(apiErr)}`);
          return;
        }
      }
      const list = Array.isArray(msgsRes?.data) ? msgsRes.data : [];
      setMessages(list.reverse());
      setPreferApiPolling(false);
    } catch (err) {
      if (!loadWarnedRef.current) {
        console.error(
          "LiveChatPanel load failed",
          formatChatError(err),
        );
        loadWarnedRef.current = true;
      }
      setError(`Failed to load chat: ${formatChatError(err)}`);
      setChatDisabled(true);
    } finally {
      setLoading(false);
    }
  }, [loadFromApiBootstrap]);

  React.useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  React.useEffect(() => {
    if (chatDisabled || !supabaseReady || preferApiPolling) return;
    const channel = supabase
      .channel("biggi-chat")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          const next = payload.new || payload.old;
          if (!next?.id) return;
          setMessages((prev) => {
            const map = new Map(prev.map((row) => [row.id, row]));
            map.set(next.id, { ...map.get(next.id), ...next });
            const merged = Array.from(map.values());
            if (merged.length > 200) merged.splice(0, merged.length - 200);
            return merged;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatDisabled, preferApiPolling]);

  React.useEffect(() => {
    if (chatDisabled || !preferApiPolling) return;
    const id = setInterval(() => {
      loadInitial();
    }, 15000);
    return () => clearInterval(id);
  }, [chatDisabled, loadInitial, preferApiPolling]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateCompactMode = () => {
      const inDesktopFullscreen = Boolean(
        rootRef.current?.closest(".ls-fullscreen-chat"),
      );
      setIsDesktopCompact(inDesktopFullscreen);
    };
    updateCompactMode();
    window.addEventListener("resize", updateCompactMode);
    return () => window.removeEventListener("resize", updateCompactMode);
  }, []);

  React.useEffect(() => {
    if (!listRef.current) return;
    if (isDesktopCompact) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [isDesktopCompact, sortedMessages.length]);

  const visibleMessages = React.useMemo(() => {
    if (!isDesktopCompact) return sortedMessages;
    let limit = 6;
    if (rulesText) limit -= 1;
    if (error) limit -= 1;
    if (loading) limit = 4;
    return sortedMessages.slice(-Math.max(3, limit));
  }, [error, isDesktopCompact, loading, rulesText, sortedMessages]);

  const sendMessage = React.useCallback(async () => {
    if (sending) return;
    const trimmed = content.trim();
    const trimmedName = name.trim();
    setError("");

    if (!isConnected) {
      setError("Connect wallet to chat.");
      return;
    }
    if (!trimmed) {
      setError("Message is empty.");
      return;
    }
    if (trimmed.length > MAX_LEN) {
      setError(`Message too long (max ${MAX_LEN}).`);
      return;
    }
    if (hasProfanity(trimmed)) {
      setError("Message blocked by profanity filter.");
      return;
    }
    const injected = getInjectedProvider();
    if (!injected) {
      setError("Wallet provider not available.");
      return;
    }

    setSending(true);
    try {
      const provider = new BrowserProvider(injected, "any");
      const signer = await provider.getSigner();
      const signerAddress = await signer.getAddress();

      const nonceData = await fetchJsonWithTimeout(buildApiCandidates("/nonce"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: signerAddress }),
      });
      const nonce = nonceData?.nonce;
      if (!nonce) throw new Error("Nonce missing");

      const timestamp = Date.now();
      const payload = buildPayload(nonce, trimmed, timestamp);
      const signature = await signer.signMessage(payload);

      const msgJson = await fetchJsonWithTimeout(buildApiCandidates("/message"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: signerAddress,
          content: trimmed,
          signature,
          nonce,
          timestamp,
          name: trimmedName || null,
        }),
      });
      if (!msgJson?.ok) {
        throw new Error(msgJson?.error || "Message send failed");
      }

      setContent("");
    } catch (err) {
      const message = err?.message || "Failed to send message.";
      if (!sendWarnedRef.current && !/^HTTP 4\d{2}:/.test(message)) {
        console.error("LiveChatPanel send failed", err);
        sendWarnedRef.current = true;
      }
      setError(message);
    } finally {
      setSending(false);
    }
  }, [API_BASE, content, isConnected, name, sending]);

  return (
    <section
      ref={rootRef}
      className={`live-chat-panel${isDesktopCompact ? " live-chat-panel--desktop-compact" : ""}`}
    >
      <header className="live-chat-panel__header">
        <div>
          <div className="live-chat-panel__title">Live Chat</div>
          <div className="live-chat-panel__subtitle">
            {isConnected
              ? `Connected: ${shortAddress(walletAddress)}`
              : "Connect a wallet to chat"}
          </div>
        </div>
        <button
          type="button"
          className="live-chat-panel__refresh"
          onClick={loadInitial}
        >
          Refresh
        </button>
      </header>

      {rulesText && (
        <div className="live-chat-panel__rules">
          <strong>Rules:</strong> {rulesText}
        </div>
      )}

      {error && <div className="live-chat-panel__error">{error}</div>}

      <div className="live-chat-panel__list" ref={listRef} aria-live="polite">
        {loading && (
          <div className="live-chat-panel__status">Loading chat...</div>
        )}
        {!loading && visibleMessages.length === 0 && (
          <div className="live-chat-panel__status">No messages yet.</div>
        )}
        {visibleMessages.map((msg) => {
          const authorLabel =
            msg.author_name || shortAddress(msg.author_address);
          return (
            <div className="live-chat-panel__message" key={msg.id}>
              <div className="live-chat-panel__meta">
                <span className="live-chat-panel__author">{authorLabel}</span>
                <span className="live-chat-panel__time">
                  {formatTime(msg.created_at)}
                </span>
              </div>
              <div className="live-chat-panel__body">
                {msg.deleted ? (
                  <span className="live-chat-panel__deleted">
                    Message removed
                  </span>
                ) : (
                  msg.content
                )}
                {msg.edited_at && !msg.deleted && (
                  <span className="live-chat-panel__edited">edited</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="live-chat-panel__composer">
        <input
          type="text"
          className="live-chat-panel__input live-chat-panel__input--name"
          placeholder="Name (optional)"
          maxLength={24}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="text"
          className="live-chat-panel__input"
          placeholder={
            isConnected ? "Type your message..." : "Connect wallet to chat"
          }
          maxLength={MAX_LEN}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          disabled={!isConnected || sending}
        />
        <button
          type="button"
          className="live-chat-panel__send"
          onClick={sendMessage}
          disabled={!isConnected || sending}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </section>
  );
}

export default LiveChatPanel;

