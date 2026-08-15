# AGENTS.md — Agent instructions for this repository

Purpose: provide brief, actionable guidance for AI coding agents to be immediately productive in this repository. Keep this file minimal and link to existing docs for details.

Key facts
- Node engine: see `package.json` (`engines.node`): **>=18.18**
- Primary build: `npm run build` (uses `vite`).
- Local dev: `npm run dev` or `npm run dev:host`.
- Tests: unit tests via `npm test` (Vitest). CI/Jest coverage via `npm run test:ci`.
- Lint/format: `npm run lint`, `npm run lint:fix`, `npm run format`.
- Mobile/Capacitor: android flows use `npm run android:sync`, `npm run android:run`, and `npm run android:build:release`.

Important locations (linking, not duplicating):
- Repository README: [README.md](README.md)
- Developer guide: [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)
- Architecture overview: [ARCHITECTURE.md](ARCHITECTURE.md)
- Frontend architecture notes: [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md)
- Smart contract notes: [SMART_CONTRACTS.md](SMART_CONTRACTS.md)
- Contribution rules: [CONTRIBUTING.md](CONTRIBUTING.md)
- Build/test config: [package.json](package.json)
- Test files: [__tests__](__tests__)

Agent guidance (concise)
- Link, don't embed: prefer linking to existing docs above rather than copying content.
- Repro steps: use `npm ci` then `npm run dev` / `npm run build` / `npm test` as appropriate.
- Environment: assume Node >=18.18; do not modify global system configuration.
- Tests: prefer `npm test` (Vitest) for quick dev feedback and `npm run test:ci` for full CI-compatible run.
- Android: only run Android/Capacitor commands when the environment has Android SDK configured.

If you'd like additional per-area agent customizations (frontend, smart-contracts, CI hooks, or scripted checks), request `/create-agent` or `/create-instruction` and specify the target area.
