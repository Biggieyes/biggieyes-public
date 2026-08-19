// src/components/ModeratorLogin.jsx
import * as React from "react";

export default function ModeratorLogin({
  onLogin,
  loading,
  error,
}) {
  const [password, setPassword] = React.useState("");

  return (
    <section className="moderator-center__card moderator-center__card--focus">
      <div className="moderator-center__card-head">
        <h3>Sign in</h3>
        <span className="moderator-center__chip">Password only</span>
      </div>
      <p className="moderator-center__copy muted">
        Moderator login uses only the slot password. Wallet connection is
        optional and is used only for extra on-chain context in the panel.
      </p>

      <div className="moderator-center__field">
        <label>Password</label>
        <input
          type="password"
          placeholder="Enter your moderator password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !loading) onLogin?.(password);
          }}
        />
      </div>

      {error && <div className="moderator-center__error">{error}</div>}

      <div className="moderator-center__actions">
        <button
          type="button"
          className="biggi-btn biggi-btn--accent"
          disabled={!password || loading}
          onClick={() => onLogin?.(password)}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>

      <div className="moderator-center__hint">
        Use the password assigned to your moderator slot. If you do not know it,
        the owner must set a new one in{" "}
        <code>Admin Panel &gt; Moderator Ops</code>.
      </div>
    </section>
  );
}

