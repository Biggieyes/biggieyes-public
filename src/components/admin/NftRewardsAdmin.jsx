import * as React from "react";
import { RefreshCw, Gift, Shuffle, Send, RotateCcw, Save } from "lucide-react";
import { ADDR } from "@/shared/utils/addresses.js";
import { getROProvider } from "@/shared/utils/contract";
import NFTREWARDSService from "@/shared/services/nftRewardsService.js";
import { submitNftAdminAction } from "@/shared/services/nftRewardsAdmin.js";
import "./NftRewardsAdmin.css";

export default function NftRewardsAdmin({
  walletAddress,
  chainId,
  getVerifiedSigner,
}) {
  const [status, setStatus] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [readError, setReadError] = React.useState("");
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState(null);
  const [busy, setBusy] = React.useState("");
  const [values, setValues] = React.useState({
    winner: "",
    uri: "",
    uris: "",
    eligible: "",
    eventId: "",
    delay: "",
  });
  const lock = React.useRef(false);
  const request = React.useRef(0);
  const refresh = React.useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setReadError("");
    try {
      const provider = getROProvider();
      if (Number((await provider.getNetwork()).chainId) !== 137)
        throw new Error("Wrong RPC chain.");
      const blockTag = await provider.getBlockNumber();
      const service = new NFTREWARDSService(ADDR.NFT_REWARDS, provider, {
        blockTag,
      });
      const next = await service.getAllStats();
      if (id === request.current) setStatus(next);
    } catch {
      if (id === request.current) {
        setStatus(null);
        setReadError(
          "NFT Rewards V2 could not be read from Polygon. Refresh to retry.",
        );
      }
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    const sequence = request;
    refresh();
    return () => {
      sequence.current++;
    };
  }, [refresh]);
  const ownerConnected = Boolean(
    walletAddress &&
    status?.owner?.toLowerCase() === walletAddress.toLowerCase(),
  );
  const enabled =
    ownerConnected &&
    Number(chainId) === 137 &&
    !loading &&
    !readError &&
    !busy;
  const update = (key) => (event) =>
    setValues((old) => ({ ...old, [key]: event.target.value }));
  const submit = async (action) => {
    if (!enabled || lock.current) return;
    lock.current = true;
    setBusy(action);
    setError("");
    setResult(null);
    try {
      const { signer } = await getVerifiedSigner(status.owner);
      const next = await submitNftAdminAction({
        address: ADDR.NFT_REWARDS,
        action,
        values,
        signer,
        walletAddress,
      });
      setResult(next);
      if (next.eventId) setValues((old) => ({ ...old, eventId: next.eventId }));
      await refresh();
    } catch (err) {
      setError(
        err?.code === "ACTION_REJECTED"
          ? "Transaction cancelled."
          : err?.reason ||
              err?.shortMessage ||
              err?.message ||
              "Transaction failed.",
      );
    } finally {
      lock.current = false;
      setBusy("");
    }
  };
  const actionButton = (action, label, Icon) => (
    <button
      type="button"
      className="biggi-btn"
      disabled={!enabled}
      onClick={() => submit(action)}
    >
      <Icon size={16} aria-hidden="true" />
      {busy === action ? "Confirming..." : label}
    </button>
  );
  const explorer = (value) => (
    <a
      href={`https://polygonscan.com/address/${value}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      {value}
    </a>
  );

  return (
    <section className="nft-admin" aria-label="NFT Rewards V2 administration">
      <header className="nft-admin__header">
        <h3>NFT Rewards V2</h3>
        <button
          type="button"
          className="biggi-btn"
          aria-label="Refresh NFT configuration"
          title="Refresh NFT configuration"
          disabled={loading || Boolean(busy)}
          onClick={refresh}
        >
          <RefreshCw size={18} />
        </button>
      </header>
      <dl className="nft-admin__details">
        <div>
          <dt>Contract</dt>
          <dd>{explorer(ADDR.NFT_REWARDS)}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{status?.owner ? explorer(status.owner) : "--"}</dd>
        </div>
        <div>
          <dt>VRF router (immutable)</dt>
          <dd>{status?.vrfRouter ? explorer(status.vrfRouter) : "--"}</dd>
        </div>
        <div>
          <dt>Retry delay</dt>
          <dd>{status ? `${status.mysteryRetryDelay} seconds` : "--"}</dd>
        </div>
      </dl>
      {loading && <p role="status">Loading contract configuration...</p>}
      {readError && <p role="alert">{readError}</p>}
      {!loading && !readError && !enabled && !busy && (
        <p role="status">
          {Number(chainId) !== 137
            ? "Connect the owner wallet on Polygon mainnet (137)."
            : "Read-only: the connected wallet is not the NFT Rewards owner."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {result && (
        <div className="nft-admin__result" role="status">
          <a
            href={`https://polygonscan.com/tx/${result.hash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Transaction confirmed
          </a>
          {result.eventId && <span>Event #{result.eventId}</span>}
          {result.rewardId && <span>First reward #{result.rewardId}</span>}
          {result.requestId && <span>VRF request: {result.requestId}</span>}
        </div>
      )}
      <div className="nft-admin__forms">
        <fieldset disabled={!enabled}>
          <legend>Manual reward</legend>
          <label>
            Winner address
            <input
              value={values.winner}
              onChange={update("winner")}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label>
            Metadata URI
            <input
              value={values.uri}
              onChange={update("uri")}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {actionButton("createManualReward", "Assign reward", Gift)}
        </fieldset>
        <fieldset disabled={!enabled}>
          <legend>Mystery event</legend>
          <label>
            Metadata URIs (one per line)
            <textarea
              rows={3}
              value={values.uris}
              onChange={update("uris")}
              spellCheck={false}
            />
          </label>
          <label>
            Eligible wallets (one per line)
            <textarea
              rows={3}
              value={values.eligible}
              onChange={update("eligible")}
              spellCheck={false}
            />
          </label>
          {actionButton("createMysteryEvent", "Create event", Shuffle)}
        </fieldset>
        <fieldset disabled={!enabled}>
          <legend>Mystery draw</legend>
          <label>
            Event ID
            <input
              inputMode="numeric"
              value={values.eventId}
              onChange={update("eventId")}
            />
          </label>
          <div className="nft-admin__actions">
            {actionButton("requestMysteryRandom", "Request draw", Send)}
            {actionButton(
              "retryMysteryRandom",
              "Retry pending draw",
              RotateCcw,
            )}
          </div>
        </fieldset>
        <fieldset disabled={!enabled}>
          <legend>Retry settings</legend>
          <label>
            Retry delay (seconds)
            <input
              type="number"
              min="1"
              step="1"
              value={values.delay}
              onChange={update("delay")}
            />
          </label>
          {actionButton("setMysteryRetryDelay", "Save retry delay", Save)}
        </fieldset>
      </div>
    </section>
  );
}
