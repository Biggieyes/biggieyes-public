const ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

function normalizeConfiguredOwner(value, name) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!ADDRESS_PATTERN.test(raw)) {
    throw new Error(`${name} is not a valid EVM address`);
  }
  return raw.toLowerCase();
}

export function resolveConfiguredAdminOwner({
  chatOwnerAddress,
  communityOwnerAddress,
} = {}) {
  const chatOwner = normalizeConfiguredOwner(
    chatOwnerAddress,
    "CHAT_OWNER_ADDRESS",
  );
  const communityOwner = normalizeConfiguredOwner(
    communityOwnerAddress,
    "COMMUNITY_OWNER_ADDRESS",
  );

  if (chatOwner && communityOwner && chatOwner !== communityOwner) {
    throw new Error("Admin owner environment variables do not match");
  }

  return communityOwner || chatOwner;
}
