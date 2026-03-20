# Contributing

## Principles

Contributions to BIGGIEYES should preserve three properties:

- technical correctness
- on-chain transparency
- documentation parity with the live implementation

## Workflow

1. create a focused branch
2. make the smallest coherent change that solves the problem
3. update tests and docs together with code
4. open a PR with a clear summary of protocol, frontend, and deployment impact

## Expected PR Content

Every meaningful PR should describe:

- what changed
- why it changed
- whether contract addresses, ABIs, or readers changed
- whether frontend env vars changed
- what tests were run
- whether docs were updated

## Documentation Requirements

If you modify any of the following, update the corresponding docs in the same change set:

- token flows
- reward logic
- contract responsibilities
- deployment steps
- frontend contract integration

## Code Quality Expectations

- keep contract wiring explicit
- do not hardcode addresses outside the registry
- prefer reader-first data access
- fail safely on RPC degradation and third-party outages
- keep economic logic explainable in plain English

## Testing Expectations

Run relevant checks before merging:

```bash
npm run lint
npm run test
npm run build
npm run check:abis
npm run check:contracts
```

If a change affects deployment or RPC behavior, also run:

```bash
npm run check:rpc
```

## Security Disclosure

Do not open a public issue for critical vulnerabilities affecting:

- contract ownership and admin control
- reward over-distribution
- buyback or reserve accounting
- VRF integrity
- treasury or vault custody

Report critical findings privately to the project maintainers through the designated security channel.

## Review Priorities

Reviews should focus on:

- user fund safety
- accounting correctness
- compatibility with the address and ABI registry
- operational safety under RPC or automation failure
- documentation accuracy

## Merge Standard

Changes are ready to merge when:

- the implementation is coherent
- the change is testable
- documentation reflects the new behavior
- deployment implications are clearly described
