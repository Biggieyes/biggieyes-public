# Security Policy

Report suspected vulnerabilities privately to `eyesbiggi@gmail.com`. Do not
include private keys, seed phrases, API tokens, or user data in a public issue.

## Repository controls

- CI blocks high and critical npm advisories.
- CI scans tracked files for credential-like values without printing values.
- Local `.env` files and generated deployment/build artifacts are ignored.
- Contract and frontend address registries must pass the consistency gate.
- Contract changes must compile and pass the BIGGI_MASTER Hardhat suite.

The current low-severity advisory accepted for the development-only ethers v5
toolchain is documented in
[`docs/releases/2026-08-27-production-baseline.md`](docs/releases/2026-08-27-production-baseline.md).
