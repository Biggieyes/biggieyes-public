export const ADMIN_SIGNATURE_TTL_MS = 2 * 60 * 1000;
export const ADMIN_SIGNATURE_FUTURE_SKEW_MS = 30 * 1000;
export const MAX_CHAT_MESSAGE_LENGTH = 280;
export const MAX_CHAT_RULES_LENGTH = 4000;

const SIGNATURE_DOMAIN = "biggieeyes.com";
const SIGNATURE_VERSION = 1;

function normalizeTimestamp(value) {
  const timestamp = Number(value);
  return Number.isSafeInteger(timestamp) ? timestamp : null;
}

export function isFreshAdminTimestamp(value, now = Date.now()) {
  const timestamp = normalizeTimestamp(value);
  if (timestamp == null) return false;
  return (
    timestamp <= now + ADMIN_SIGNATURE_FUTURE_SKEW_MS &&
    now - timestamp <= ADMIN_SIGNATURE_TTL_MS
  );
}

export function buildChatModerationMessage({
  action,
  messageId,
  newContent = "",
  timestamp,
}) {
  return JSON.stringify({
    domain: SIGNATURE_DOMAIN,
    version: SIGNATURE_VERSION,
    purpose: "chat-moderation",
    action: String(action || ""),
    messageId: Number(messageId),
    newContent: String(newContent || ""),
    timestamp: normalizeTimestamp(timestamp),
  });
}

export function buildChatRulesMessage({ rulesText, timestamp }) {
  return JSON.stringify({
    domain: SIGNATURE_DOMAIN,
    version: SIGNATURE_VERSION,
    purpose: "chat-rules-update",
    rulesText: String(rulesText || ""),
    timestamp: normalizeTimestamp(timestamp),
  });
}
