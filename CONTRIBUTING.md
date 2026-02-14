# Contributing

Thanks for your interest in BiggiEyes. We welcome issues and pull requests.

## Ground rules
- Be respectful. Follow CODE_OF_CONDUCT.md.
- Keep security in mind. Never include secrets in commits.

## Getting started
1. Install Node 18.18+ and npm.
1. Install deps: `npm ci`
1. Copy `.env.example` to `.env.local` and set values.
1. Start dev server: `npm run dev` or `npm run dev:netlify` for functions.

## Pull requests
- Use a focused branch per change.
- Explain the why in the PR description.
- Add or update tests if behavior changes.
- Run: `npm run lint`, `npm run test`, `npm run typecheck`.

## Coding style
- Keep functions small and readable.
- Prefer explicit names over abbreviations.
- Avoid breaking changes without discussion.

## Reporting issues
- Use GitHub Issues with a clear repro and expected behavior.
