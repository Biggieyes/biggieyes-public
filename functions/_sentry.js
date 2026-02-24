import * as Sentry from "@sentry/node";

let initialized = false;

export const initSentry = () => {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN || "";
  if (!dsn) return;
  const tracesSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0);
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENV || process.env.NODE_ENV || "production",
    tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0,
  });
  initialized = true;
};

export const captureException = (err, extra = {}) => {
  if (!err) return;
  const dsn = process.env.SENTRY_DSN || "";
  if (!dsn) return;
  initSentry();
  Sentry.withScope((scope) => {
    if (extra && typeof extra === "object") {
      Object.entries(extra).forEach(([key, value]) => {
        scope.setExtra(key, value);
      });
    }
    scope.setTag("runtime", "netlify");
    Sentry.captureException(err);
  });
};
