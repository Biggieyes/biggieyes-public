// src/components/MerkleTool.jsx
import * as React from "react";
import copy from "clipboard-copy";
import { buildProofs } from "../utils/merkle";

export default function MerkleTool({ entries = [] }) {
  const [manualJson, setManualJson] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (entries.length) {
      try {
        setResult(buildProofs(entries));
        setError("");
      } catch (err) {
        setError("Merkle calculation failed.");
      }
    }
  }, [entries]);

  const buildFromManual = () => {
    try {
      const parsed = JSON.parse(manualJson);
      const list = Array.isArray(parsed) ? parsed : parsed?.entries;
      if (!Array.isArray(list)) throw new Error("Bad input");
      setResult(buildProofs(list));
      setError("");
    } catch (err) {
      setError("Invalid JSON.");
    }
  };

  const jsonOut = result ? JSON.stringify(result, null, 2) : "";

  return (
    <section className="moderator-center__card">
      <h3>Merkle tool</h3>
      <p className="muted">
        Leaf format: keccak256(abi.encodePacked(slotId, wallet, amountWei)).
      </p>

      <div className="moderator-center__field">
        <label>Input JSON (optional)</label>
        <textarea
          placeholder='[{ "slotId": 1, "wallet": "0x...", "amountWei": "1000" }]'
          value={manualJson}
          onChange={(e) => setManualJson(e.target.value)}
        />
      </div>
      <div className="moderator-center__actions">
        <button type="button" className="biggi-btn biggi-btn--ghost" onClick={buildFromManual}>
          Generovat z JSON
        </button>
        {result && (
          <button
            type="button"
            className="biggi-btn biggi-btn--ghost"
            onClick={() => copy(jsonOut)}
          >
            Copy JSON
          </button>
        )}
      </div>

      {error && <div className="moderator-center__error">{error}</div>}

      {result && (
        <div className="moderator-center__field">
          <label>Merkle root</label>
          <input type="text" readOnly value={result.root} />
          <label>Proofs</label>
          <textarea readOnly value={jsonOut} />
        </div>
      )}
    </section>
  );
}
