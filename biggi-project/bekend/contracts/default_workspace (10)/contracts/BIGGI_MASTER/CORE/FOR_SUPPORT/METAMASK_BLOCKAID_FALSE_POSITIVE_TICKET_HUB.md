# MetaMask / Blockaid false-positive report: BiggiTicketHub

## Incident

MetaMask marks the Biggi Ticket ERC-721 contract as `Malicious` when its owner
tries to list token `3` from the official OpenSea website on Polygon.

- Request origin: `https://opensea.io`
- Network: Polygon mainnet (`chainId 137`)
- Flagged contract: `0x7b7e561173f498C8274b821090Da64E8ee653f6A`
- Contract name: `BiggiTicketHub`
- ERC-721 name / symbol: `Biggi Ticket` / `BGTICKET`
- OpenSea collection: https://opensea.io/collection/biggi-ticket-339884819

## Submission status

- Submitted to: Blockaid `Mistake` form
- Submitted at: `2026-08-28T22:57:20+02:00`
- Submitted email: `eyesbiggi@gmail.com`
- Portal confirmation: `Report Sent - Thank you for reporting! We'll review it thoroughly`
- Case/reference ID: not provided by the portal

The external classification remains pending until Blockaid completes its review.
Do not bypass the MetaMask warning before the classification is removed.

## Independent checks

The following checks were repeated against Polygon block `92825313`:

1. PolygonScan reports the Solidity source as verified.
2. Deployed runtime bytecode is 18,688 bytes and its Keccak-256 hash is
   `0x22f2b1ad462a9cfec1db17dd85f5fe1d44fb1527731bc23ce651492e92db951b`.
3. The local Hardhat artifact has the same byte length and runtime hash. The
   deployed runtime is an exact byte-for-byte match.
4. The contract reports ERC-721 (`0x80ac58cd`) and ERC-721 Metadata
   (`0x5b5e139f`) interface support.
5. `setApprovalForAll` is inherited from OpenZeppelin ERC-721 v5.1.0. The
   BiggiTicketHub source does not override that function.
6. The only transfer hook override calls `super._update` and maintains the
   owner's aggregate and per-chapter ticket counters.
7. The deployment transaction succeeded and created this exact address.

Evidence: [EVIDENCE/metamask-ticket-hub-false-positive-polygon.json](EVIDENCE/metamask-ticket-hub-false-positive-polygon.json)

## Decoded OpenSea request

OpenSea API v2 returned this approval action for token `3`:

```text
to:       0x7b7e561173f498C8274b821090Da64E8ee653f6A
method:   setApprovalForAll(address,bool)
operator: 0x1E0049783F008A0085193E00003D00cd54003c71
approved: true
```

The operator is the OpenSea Conduit. The NFT contract is the transaction
recipient because ERC-721 approvals are stored by the NFT contract. This is a
normal prerequisite for a Seaport listing; it is not a request to transfer a
ticket immediately.

## Report text

Use the following text in both the MetaMask transaction-alert report and the
Blockaid `Mistake` form:

```text
Please review a false-positive malicious-address classification on Polygon.

MetaMask flags our verified ERC-721 contract BiggiTicketHub at
0x7b7e561173f498C8274b821090Da64E8ee653f6A when the owner lists token #3 on
the official OpenSea website. The requested call is the standard OpenZeppelin
ERC-721 method setApprovalForAll(OpenSea Conduit, true). OpenSea API v2 returns
the same transaction: the NFT contract is the call target and
0x1E0049783F008A0085193E00003D00cd54003c71 is the approved conduit.

The Solidity source is verified on PolygonScan. We independently confirmed an
exact byte-for-byte match between the deployed runtime and our local Hardhat
artifact. Both runtime hashes are
0x22f2b1ad462a9cfec1db17dd85f5fe1d44fb1527731bc23ce651492e92db951b.
The contract supports ERC-721 and ERC-721 Metadata and does not override
setApprovalForAll.

Explorer:
https://polygonscan.com/address/0x7b7e561173f498C8274b821090Da64E8ee653f6A
Deployment transaction:
https://polygonscan.com/tx/0xb2d085d7cf2442dc9fd5c029872e838afad03260681a14b6e78e969781fca112
Official website: https://biggieyes.com
Repository: https://github.com/Biggieyes/biggieeyes-public
OpenSea collection: https://opensea.io/collection/biggi-ticket-339884819

Please remove the malicious classification and confirm the contract as a
legitimate BiggiEyes project address.
```

## Submission fields

### Blockaid mistake report

- Form: https://report.blockaid.io/mistake
- Domain: `opensea.io`
- Chain: `Polygon`
- Wallet: `MetaMask`
- Address: `0x7b7e561173f498C8274b821090Da64E8ee653f6A`
- Email: `eyesbiggi@gmail.com`
- Additional details: paste the report text above and attach the MetaMask alert
  screenshot when the form offers an attachment step.

### Blockaid developer verification

- Form: https://report.blockaid.io/verifiedProject
- Domain: `biggieyes.com`
- Chain: `Polygon`
- Wallet: `MetaMask`
- Address: `0x7b7e561173f498C8274b821090Da64E8ee653f6A`
- Email: `eyesbiggi@gmail.com`
- Additional details: paste the same report text.

### MetaMask

Open the blocked transaction, select `Review alerts` / `See details`, then
select `Report an issue`. Keep the automatically populated transaction data
unchanged and paste the report text above. If that option is absent, use
MetaMask Support and include the same address, network, screenshots, website,
repository, OpenSea collection, and PolygonScan links.
