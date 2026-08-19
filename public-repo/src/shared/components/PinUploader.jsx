import * as React from "react";

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024;
const DEFAULT_ALLOWED = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/json",
];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / (1024 * 102.4)) / 10} MB`;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || "");
    reader.onerror = () =>
      reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export default function PinUploader({
  onDone,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  allowedTypes = DEFAULT_ALLOWED,
}) {
  const [file, setFile] = React.useState(null);
  const [previewUrl, setPreviewUrl] = React.useState("");
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const validateFile = React.useCallback(
    (nextFile) => {
      if (!nextFile) return "";
      if (!allowedTypes.includes(nextFile.type)) {
        return `Unsupported type: ${nextFile.type || "unknown"}`;
      }
      if (nextFile.size > maxSizeBytes) {
        return `File too large (${formatBytes(nextFile.size)} > ${formatBytes(maxSizeBytes)})`;
      }
      return "";
    },
    [allowedTypes, maxSizeBytes],
  );

  const onFileChange = (e) => {
    const nextFile =
      e.target.files && e.target.files[0] ? e.target.files[0] : null;
    const err = validateFile(nextFile);
    setError(err);
    setFile(err ? null : nextFile);
    setStatus("");
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Pick a file first.");
      return;
    }
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }

    setUploading(true);
    setError("");
    setStatus("Reading file...");

    try {
      const dataUrl = await fileToDataUrl(file);

      setStatus("Uploading to Pinata...");
      const pinFileRes = await fetch("/.netlify/functions/pinFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          contentBase64: dataUrl,
          metadata: { mime: file.type, size: file.size },
        }),
      });
      const pinFileJson = await pinFileRes.json();
      if (!pinFileRes.ok || !pinFileJson?.success) {
        throw new Error(pinFileJson?.error || "Pinata file upload failed");
      }

      const imageCid = pinFileJson.cid;
      const tokenMetadata = {
        name: file.name,
        description: "",
        image: `ipfs://${imageCid}`,
        attributes: [],
      };

      setStatus("Uploading metadata...");
      const pinJsonRes = await fetch("/.netlify/functions/pinJson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: tokenMetadata }),
      });
      const pinJson = await pinJsonRes.json();
      if (!pinJsonRes.ok || !pinJson?.success) {
        throw new Error(pinJson?.error || "Pinata metadata upload failed");
      }

      const metadataCid = pinJson.cid;
      const tokenURI = `ipfs://${metadataCid}`;
      setStatus("Done.");
      if (typeof onDone === "function") {
        onDone({ imageCid, metadataCid, tokenURI });
      }
    } catch (uploadErr) {
      setError(uploadErr?.message || "Upload failed");
      setStatus("");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label style={{ display: "grid", gap: 6 }}>
        <span>Upload file</span>
        <input
          type="file"
          accept={allowedTypes.join(",")}
          onChange={onFileChange}
          disabled={uploading}
        />
      </label>

      {previewUrl ? (
        <img
          src={previewUrl}
          alt="Preview"
          style={{
            width: 240,
            height: "auto",
            borderRadius: 10,
            border: "1px solid #2b2b2b",
          }}
        />
      ) : null}

      <button
        type="button"
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? "Uploading..." : "Pin to Pinata"}
      </button>

      {status ? <div style={{ fontSize: 13 }}>{status}</div> : null}
      {error ? (
        <div style={{ color: "#e25b5b", fontSize: 13 }}>{error}</div>
      ) : null}
    </div>
  );
}

