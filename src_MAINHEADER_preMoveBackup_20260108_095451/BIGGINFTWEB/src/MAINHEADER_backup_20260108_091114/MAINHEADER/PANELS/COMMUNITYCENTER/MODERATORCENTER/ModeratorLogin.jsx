// src/components/ModeratorLogin.jsx
import * as React from "react";

export default function ModeratorLogin({
  walletAddress,
  onLogin,
  onConnect,
  loading,
  error,
}) {
  const [secret, setSecret] = React.useState("");

  return (
    <section className="moderator-center__card">
      <h3>Moderator access</h3>
      <p className="muted">
        Login uses a wallet signature + slot secret. The session token is
        short-lived and comes from the backend API.
      </p>

      <div className="moderator-center__field">
        <label>Slot secret code</label>
        <input
          type="password"
          placeholder="Enter the secret for your slot"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
        />
      </div>

      {error && <div className="moderator-center__error">{error}</div>}

      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--ghost"
          onClick={onConnect}
        >
          Connect wallet
        </button>
        <button
          type="button"
          className="biggi-btn biggi-btn--accent"
          disabled={!walletAddress || loading}
          onClick={() => onLogin?.(secret)}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </section>
  );
}

