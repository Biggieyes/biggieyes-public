import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  BIGGIEYES_DEFAULT_DOC,
  BIGGIEYES_DOC_FILES,
  BIGGIEYES_DOC_SECTIONS,
} from "./biggieyesDocsManifest.js";

import "./biggieyes-docs.css";

const RAW_DOC_LOADERS = import.meta.glob("../../*.md", {
  query: "?raw",
  import: "default",
});

const DOC_ROUTE = "/docs/biggieyes";

const DOC_LOADERS = Object.entries(RAW_DOC_LOADERS).reduce(
  (acc, [path, loader]) => {
    const fileName = path.split("/").pop();
    if (BIGGIEYES_DOC_FILES.has(fileName)) {
      acc[fileName] = loader;
    }
    return acc;
  },
  {},
);

function normalizeDocName(value) {
  const raw = String(value || BIGGIEYES_DEFAULT_DOC)
    .trim()
    .replace(/^\.?\//, "");
  return BIGGIEYES_DOC_FILES.has(raw) ? raw : BIGGIEYES_DEFAULT_DOC;
}

function getDocFromLocation() {
  if (typeof window === "undefined") return BIGGIEYES_DEFAULT_DOC;
  const url = new URL(window.location.href);
  return normalizeDocName(url.searchParams.get("doc"));
}

function buildDocHref(file, hash = "") {
  const safeFile = normalizeDocName(file);
  const safeHash = hash && String(hash).startsWith("#") ? hash : "";
  return `${DOC_ROUTE}?doc=${encodeURIComponent(safeFile)}${safeHash}`;
}

function extractText(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node.props?.children) return extractText(node.props.children);
  return "";
}

function slugifyHeading(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[`*_~()[\].,:/]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function resolveMarkdownLink(href) {
  const rawHref = String(href || "").trim();
  if (!rawHref) return null;
  if (rawHref.startsWith("#")) {
    return { kind: "anchor", href: rawHref };
  }
  if (/^(https?:|mailto:|tel:)/i.test(rawHref)) {
    return { kind: "external", href: rawHref };
  }

  const [filePart, hash = ""] = rawHref.split("#");
  const cleaned = filePart.replace(/^\.?\//, "");
  if (!cleaned.toLowerCase().endsWith(".md")) return null;

  const file = normalizeDocName(cleaned);
  return {
    kind: "doc",
    file,
    href: buildDocHref(file, hash ? `#${hash}` : ""),
    hash: hash ? `#${hash}` : "",
  };
}

function Heading({ level, children }) {
  const Tag = `h${level}`;
  const text = extractText(children);
  const id = slugifyHeading(text);
  return <Tag id={id}>{children}</Tag>;
}

export default function BiggiEyesDocsApp() {
  const [docName, setDocName] = React.useState(() => getDocFromLocation());
  const [content, setContent] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const updateDoc = React.useCallback((nextDoc, options = {}) => {
    const safeDoc = normalizeDocName(nextDoc);
    const hash = options.hash && String(options.hash).startsWith("#")
      ? options.hash
      : "";
    const href = buildDocHref(safeDoc, hash);

    if (typeof window !== "undefined") {
      const method = options.replace ? "replaceState" : "pushState";
      window.history[method](null, "", href);
    }

    React.startTransition(() => {
      setDocName(safeDoc);
    });
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const current = new URL(window.location.href);
    if (!current.searchParams.get("doc")) {
      current.searchParams.set("doc", BIGGIEYES_DEFAULT_DOC);
      window.history.replaceState(null, "", current.toString());
    }

    const onPopState = () => {
      React.startTransition(() => {
        setDocName(getDocFromLocation());
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function loadDoc() {
      setLoading(true);
      setError("");

      const loader = DOC_LOADERS[docName];
      if (!loader) {
        setContent("");
        setError(`Document loader is missing for ${docName}.`);
        setLoading(false);
        return;
      }

      try {
        const nextContent = await loader();
        if (cancelled) return;
        setContent(String(nextContent || ""));
        setLoading(false);
        document.title = `BIGGIEYES Docs - ${docName.replace(/\.md$/i, "")}`;

        requestAnimationFrame(() => {
          const hash = window.location.hash;
          if (hash) {
            const target = document.getElementById(hash.slice(1));
            if (target) {
              target.scrollIntoView({ block: "start" });
              return;
            }
          }
          window.scrollTo({ top: 0, behavior: "auto" });
        });
      } catch (err) {
        if (cancelled) return;
        setContent("");
        setError(err instanceof Error ? err.message : "Failed to load document.");
        setLoading(false);
      }
    }

    loadDoc();

    return () => {
      cancelled = true;
    };
  }, [docName]);

  const markdownComponents = React.useMemo(
    () => ({
      h1(props) {
        return <Heading level={1} {...props} />;
      },
      h2(props) {
        return <Heading level={2} {...props} />;
      },
      h3(props) {
        return <Heading level={3} {...props} />;
      },
      h4(props) {
        return <Heading level={4} {...props} />;
      },
      a({ href, children, ...props }) {
        const resolved = resolveMarkdownLink(href);

        if (resolved?.kind === "doc") {
          return (
            <a
              {...props}
              href={resolved.href}
              onClick={(event) => {
                event.preventDefault();
                updateDoc(resolved.file, { hash: resolved.hash });
              }}
            >
              {children}
            </a>
          );
        }

        if (resolved?.kind === "external") {
          return (
            <a {...props} href={resolved.href} target="_blank" rel="noreferrer">
              {children}
            </a>
          );
        }

        return (
          <a {...props} href={resolved?.href || href}>
            {children}
          </a>
        );
      },
      table({ children, ...props }) {
        return (
          <div className="biggie-docs__table-wrap">
            <table {...props}>{children}</table>
          </div>
        );
      },
      code({ inline, className, children, ...props }) {
        if (inline) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
        return (
          <pre className="biggie-docs__pre">
            <code className={className} {...props}>
              {children}
            </code>
          </pre>
        );
      },
    }),
    [updateDoc],
  );

  return (
    <div className="biggie-docs">
      <aside className="biggie-docs__sidebar">
        <div className="biggie-docs__brand">
          <span className="biggie-docs__eyebrow">Polygon Protocol Docs</span>
          <h1>BIGGIEYES</h1>
          <p>
            Official-style project documentation, investor materials, and
            architecture references rendered locally in the app.
          </p>
          <div className="biggie-docs__actions">
            <a className="biggie-docs__action" href="/">
              Open App
            </a>
            <a
              className="biggie-docs__action biggie-docs__action--ghost"
              href={buildDocHref("WHITEPAPER.md")}
              onClick={(event) => {
                event.preventDefault();
                updateDoc("WHITEPAPER.md");
              }}
            >
              Whitepaper
            </a>
          </div>
        </div>

        <nav className="biggie-docs__nav" aria-label="BIGGIEYES documentation">
          {BIGGIEYES_DOC_SECTIONS.map((section) => (
            <section className="biggie-docs__nav-section" key={section.title}>
              <h2>{section.title}</h2>
              <ul>
                {section.docs.map((doc) => {
                  const isActive = doc.file === docName;
                  return (
                    <li key={doc.file}>
                      <a
                        href={buildDocHref(doc.file)}
                        className={isActive ? "is-active" : ""}
                        onClick={(event) => {
                          event.preventDefault();
                          updateDoc(doc.file);
                        }}
                      >
                        {doc.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>
      </aside>

      <main className="biggie-docs__content">
        <div className="biggie-docs__toolbar">
          <div>
            <span className="biggie-docs__toolbar-label">Current file</span>
            <strong>{docName}</strong>
          </div>
          <div className="biggie-docs__toolbar-links">
            <a href={buildDocHref(docName)}>
              Current route
            </a>
            <a href="/">
              Open App
            </a>
          </div>
        </div>

        <article className="biggie-docs__article">
          {loading ? (
            <div className="biggie-docs__state">Loading document...</div>
          ) : error ? (
            <div className="biggie-docs__state biggie-docs__state--error">
              {error}
            </div>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
          )}
        </article>
      </main>
    </div>
  );
}
