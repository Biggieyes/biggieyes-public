// src/components/LiveChatPanel.jsx
// Live chat UI backed by Supabase realtime and a serverless signature-verified API.
import * as React from "react";
import { BrowserProvider } from "ethers";
import { supabase, supabaseReady } from "../services/chatClient";
import { getInjectedProvider } from "@/shared/utils/contract";
import "./LiveChatPanel.css";

const API_BASE = import.meta.env.VITE_CHAT_API_BASE || "";
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

const buildApiUrl = (path) => {
  if (!API_BASE) return `/api${path}`;
  if (API_BASE.includes("/.netlify/functions")) return `${API_BASE}${path}`;
  return `${API_BASE}/api${path}`;
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

function LiveChatPanel({ walletAddress = "" }) {
  const [messages, setMessages] = React.useState([]);
  const [rulesText, setRulesText] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState("");
  const [content, setContent] = React.useState("");
  const [name, setName] = React.useState("");
  const [chatDisabled, setChatDisabled] = React.useState(false);
  const listRef = React.useRef(null);
  const rulesWarnedRef = React.useRef(false);
  const loadWarnedRef = React.useRef(false);

  const isConnected = Boolean(walletAddress);

  const sortedMessages = React.useMemo(() => {
    return [...messages].sort((a, b) => {
      const aTime = new Date(a.created_at || 0).getTime();
      const bTime = new Date(b.created_at || 0).getTime();
      return aTime - bTime;
    });
  }, [messages]);

  const loadInitial = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (!supabaseReady) {
        setError("Live chat is not configured (missing Supabase env vars).");
        setChatDisabled(true);
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

      if (rulesRes?.error && !rulesWarnedRef.current) {
        console.warn(
          "LiveChatPanel rules load failed",
          formatChatError(rulesRes.error),
        );
        rulesWarnedRef.current = true;
      }

      const missingTables =
        rulesRes?.error?.code === "PGRST205" ||
        msgsRes?.error?.code === "PGRST205";
      if (missingTables) {
        setError(
          "Live chat tables are missing in Supabase. Run sql/migration_init.sql.",
        );
        setChatDisabled(true);
        return;
      }
      if (rulesRes?.data?.text) {
        setRulesText(String(rulesRes.data.text));
      }

      if (msgsRes?.error) {
        if (!loadWarnedRef.current) {
          console.warn(
            "LiveChatPanel load failed",
            formatChatError(msgsRes.error),
          );
          loadWarnedRef.current = true;
        }
        setError(`Failed to load chat: ${formatChatError(msgsRes.error)}`);
        setChatDisabled(true);
        return;
      }
      const list = Array.isArray(msgsRes?.data) ? msgsRes.data : [];
      setMessages(list.reverse());
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
  }, []);

  React.useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  React.useEffect(() => {
    if (chatDisabled || !supabaseReady) return;
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
  }, [chatDisabled]);

  React.useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [sortedMessages.length]);

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

      const nonceRes = await fetch(buildApiUrl("/nonce"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: signerAddress }),
      });
      if (!nonceRes.ok) throw new Error("Nonce request failed");
      const nonceData = await nonceRes.json();
      const nonce = nonceData?.nonce;
      if (!nonce) throw new Error("Nonce missing");

      const timestamp = Date.now();
      const payload = buildPayload(nonce, trimmed, timestamp);
      const signature = await signer.signMessage(payload);

      const msgRes = await fetch(buildApiUrl("/message"), {
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
      const msgJson = await msgRes.json().catch(() => ({}));
      if (!msgRes.ok || !msgJson?.ok) {
        throw new Error(msgJson?.error || "Message send failed");
      }

      setContent("");
    } catch (err) {
      console.error("LiveChatPanel send failed", err);
      setError(err?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }, [API_BASE, content, isConnected, name, sending]);

  return (
    <section className="live-chat-panel">
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
        {!loading && sortedMessages.length === 0 && (
          <div className="live-chat-panel__status">No messages yet.</div>
        )}
        {sortedMessages.map((msg) => {
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

