import * as React from "react";

const cardStyle = {
  background: "#12141a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
  padding: 14,
  display: "grid",
  gap: 10,
};

const titleStyle = {
  margin: 0,
  fontSize: 16,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "#e6e9f2",
};

const linkStyle = {
  color: "#8fd3ff",
  textDecoration: "none",
  fontWeight: 700,
};

const getCommit = () => {
  try {
    return (
      import.meta?.env?.VITE_COMMIT_SHA ||
      import.meta?.env?.VITE_GIT_SHA ||
      import.meta?.env?.VITE_GIT_COMMIT ||
      ""
    );
  } catch {
    return "";
  }
};

export default function DevTransparency() {
  const commit = getCommit();
  const githubUrl = "https://github.com/BiggiEyes";

  return (
    <section style={cardStyle}>
      <h3 style={titleStyle}>Dev Transparency</h3>
      <div style={{ display: "grid", gap: 6, fontSize: 13, color: "#cfd6e6" }}>
        <div>
          Public GitHub: {" "}
          <a href={githubUrl} target="_blank" rel="noreferrer" style={linkStyle}>
            {githubUrl}
          </a>
        </div>
        <div>Built over 2+ years, ~3300 development hours.</div>
        {commit ? (
          <div>
            Commit: <span style={{ fontFamily: "ui-monospace" }}>{commit}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
