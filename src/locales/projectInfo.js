// src/content/projectInfo.cz.js
export const projectInfoCZ = {
  overview: `
**Overview & How It Works**

BiggiEyes works simply: you buy a ticket (with ETH or BIGGI), redeem the ticket, and Chainlink VRF fairly draws your NFT. Redeeming the ticket triggers verifiable randomness that assigns a block, background color, and mainId, and we immediately mint the NFT to your wallet.

Pricing is calculated transparently at every mint. The background color permanently increases the price of its corresponding block by a preset percentage, so blocks with “in-demand” backgrounds grow faster over time. Your NFT’s final price is the current price of its block at the moment of mint **plus a one-time bonus** based on the background color. For every NFT, we store three values in the metadata: how much the ticket cost, the block’s current price at mint time, and the resulting final price.

A portion of ETH payments automatically feeds the rewards pool and liquidity, with the remainder going to developers; when paying in BIGGI, part of the tokens can be routed to a token sink. Closing out an entire block grants a special Character NFT, and additional rewards can be earned by meeting collecting requirements. Everything runs on-chain and is easy to audit.
`,

  pricing: `
**Pricing, Blocks & Mechanics**

Our economy is dynamic and on-chain auditable. Every mint stores three numbers in the NFT metadata: \`ticketPrice\`, \`blockPrice\` (the current block price at mint time) and \`finalPrice\`. This makes it always clear how the final price was derived and how blocks evolved over time.

**Blocks & pricing (in detail)**

- **Permanent increase by background (bg):** on each mint the background (bg 1–10) raises the price of its own block by a fixed % (e.g., 2–10% depending on bg). This is a permanent effect that impacts all future mints from that block.  
- **Basis for calculation:** after applying the permanent increase, we use the **current price of the NFT’s block (blk)** as the base. If \`blk == bg\`, the increase applies immediately.  
- **One-time bonus for finalPrice:** we add a **one-time bonus** based on bg to the current block price (e.g., +5 to +50%).  
- **Formula:** \`finalPrice = currentBlockPriceAtMint + oneOffBonus(bg)\` — where \`currentBlockPriceAtMint\` already includes any permanent increase applied in this mint.  
- **Ticket curve:** the ticket price rises gradually with every mint (e.g., ~0.33%), independently of blocks.  
- **Base price vs. evolution:** each block starts at a base price, but its current price changes according to which backgrounds have been minted over time (more “strong” bgs ⇒ faster growth).

**Frontend (what we show and why)**

- **Block overview:**  
  - Current price of each block (after the latest mint),  
  - Base price (starting value),  
  - Minted / Capacity (how many items are out vs. the maximum),  
  - Deviation from base in % (how much the block has risen from its start).  
- **Recent mints:**  
  - the background used,  
  - the \`blockPrice\` and \`finalPrice\` stored on the NFT,  
  - tooltips explaining: “bg first permanently increased its own block, then the one-time bonus was added to compute finalPrice.”  
- **Block comparisons:** quick leaderboard by % over base so users can see which blocks “pull ahead.”  
- **Clarity for users:** each number includes an icon/tooltip with short definitions (Base, Current, Final, Bonus, bg).  
- **Real-time updates:** after every mint, values recalculate and the UI updates immediately.

**Practical examples (to understand behavior)**

- **Example A (\`blk == bg\`):** The mint permanently increases its block, and the already increased price becomes the base for \`finalPrice\`.  
- **Example B (\`blk ≠ bg\`):** The permanent increase hits a different block (bg), while the minted NFT uses the **current price of its own block** (unchanged by this mint). \`finalPrice\` then adds only the one-time bg bonus.

**Consequence:** rarer/“stronger” backgrounds accelerate growth of their blocks and simultaneously lift the finalPrice of the specific mint.

**Mechanics goals**

- **Transparency:** everything is explainable and stored on the NFT.  
- **Game-economy factor:** collectors can see which blocks are “leading” and why.  
- **Sustainability:** gradual ticket growth + bg-driven block growth spread demand over time and reward active minters.
`,

  transparency: `
**Transparency & On-Chain Proofs**

Everything important happens on-chain, so anyone can verify it independently in a block explorer. The contract exposes live, read-only data that the frontend renders without altering it: current ticket price and its incremental growth, each block’s base and current price, minted/remaining supply per block, background-driven permanent increases, rewards-pool balance, and a user’s claim eligibility. For every minted NFT, we also store a clear price breakdown in metadata—\`ticketPrice\`, \`blockPrice\` (the block’s current price at mint time), and \`finalPrice\` (\`blockPrice\` plus the one-time background bonus)—so users can always see how the final number was formed.

Chainlink VRF provides provably fair randomness, and its request/response can be audited. You can trace the full path from buying a ticket, redeeming it, requesting VRF, receiving the random word, and minting the resulting NFT. The contract emits events for each major step—ticket mints, redeems, VRF requests and fulfillments, NFT mints, Character NFT awards, and reward claims—creating a chronological audit trail with timestamps, addresses, token IDs, block indices, backgrounds, and amounts. Configuration changes (URIs, rewards settings, VRF parameters) and payment routing (ETH splits, BIGGI token sink) are also logged through events.

In the UI, we surface these proofs in context. A VRF card links to the request and fulfillment transactions and shows the random word. An NFT detail view explains the price math in order—ticket cost, permanent background increase applied to its block, current block price at mint, and the one-time background bonus—each step linking to the specific transaction or event. A block dashboard compares current versus base price, shows minted versus capacity, highlights the latest background that moved the block, and calculates deviation from base. A claim center checks eligibility on-chain, explains exactly why a claim is or isn’t available, and links to the claim transaction once executed.

The result is a system that doesn’t ask for trust: calculations are deterministic, proofs are embedded in the chain, and every action—from the first ticket to the last reward—leaves a verifiable, permanent record.
`,

  trading: `
**Trading & User Experience**

**UX.** A clean gallery lets users browse all revealed items by block, background, and mainId, with trait filters and quick search. Each item shows live **redeem/VRF status** (e.g., “Ticket held”, “VRF requested”, “VRF fulfilled”) so users always know where they are in the flow. The **NFT detail** explains the price breakdown (\`ticketPrice → current blockPrice at mint → one-time background bonus → finalPrice\`) and links to on-chain proofs. A **claim preview** checks eligibility in real time and tells the user exactly what’s missing if they can’t claim yet. Every card includes **market links** (View/List/Buy) and a compact activity feed (mint, transfers, claims) for context.

**Trading.** Once metadata is published, items are **compatible with standard NFT marketplaces**. The app provides direct deep-links to list or buy on popular markets and a “refresh metadata” hint if a venue needs to pull the latest attributes. Users can sort by price, rarity signals (block/background), or recent sales, and jump from our gallery straight to a listing flow. We surface floor snapshots and recent trades per block to help price discovery, and we keep ownership, transfers, and claims **verifiable on-chain**, so buyers have full confidence in what they’re purchasing.
`,

  roadmap: `
**Roadmap, Community & Legal**

The frontend is fully expanded: detailed block statistics, a timeline of recent mints, a VRF view, and a fully functional claim center with clear conditions are all live. **Liquidity tools** are deployed—you can see the current LP state (BIGGI/ETH), the history of **bootstrap** and **add-liquidity** transactions, and metrics like TVL, pool share, and deviation from base. Practical “how to add liquidity” guides are available, along with **alerts** for parameter changes (token sink, slippage, recipient). Token tools are active: token sink routing, conversion rate settings, and educational walkthroughs. Community features are enabled—leaderboards, missions, seasonal events, and rewards. Integrations with additional marketplaces are running, mobile optimization is complete, and the partner **API** is open for analytics platforms.

**Community & Legal**  
The community space is moderated and safe: no spam, scams, or impersonation; links and contract addresses are verified, and sensitive data isn’t shared publicly. The project is experimental and carries typical crypto/NFT risks—prices fluctuate and past performance doesn’t guarantee future results. Content in the app does not constitute financial advice. By using the app you agree to the terms of service and privacy policy; both documents are available directly in the app. Any suspicious activity can be reported to moderators or support—and we respond immediately.
`,

  faq: `
`,

  token: `
**BIGGI ECOSYSTEM & Weekly Rewards**

BIGGI is our rewards token. In the app you’ll see the **token address**, **name/symbol/decimals**, and **how much BIGGI remains before the total emission cap is reached**. Everything is read directly from the smart contract, so the data is current and verifiable.

**How weekly rewards work**

- Each of your NFTs can earn BIGGI **once per week**.  
- The reward amount depends on the **block weight** (blocks 1–10; higher block = higher weight).  
- The app shows **which reward week we’re in** and **when a specific NFT can claim again** (if it already claimed this week).

**Preview & claim**

- Before confirming, you’ll see an **exact preview** of how many units and how much **BIGGI** you can claim **right now** for the selected NFTs.  
- For every NFT it clearly states **whether it’s claimable today**, its **weight**, and which **block** it belongs to.  
- When you confirm, the system **calculates the reward for all eligible NFTs and pays you BIGGI**—everything **respects the token’s overall cap** (the maximum supply is never exceeded).

**Summary**

- **Transparent token data** (address, metadata, remaining emission).  
- **Once-a-week reward** per NFT, **based on block weight**.  
- **Predictable preview** before confirmation and a **secure on-chain claim**.
`,

  liquidity: `
**Liquidity, router, and LP — explained simply**

**What are the router and “path”?**  
- The app uses a DEX router to execute swaps.  
- You’ll see the router address and the wrapped native token (e.g., WETH).  
- We also show the swap route (path), typically **WNATIVE → BIGGI**. That’s the path used to convert part of your coins to BIGGI when adding liquidity.

**How liquidity (LP) is created and topped up**  
- **First pool setup (bootstrap):** With one action we create the **BIGGI/WNATIVE** pair and you receive LP tokens (your share of the pool).  
- **Further top-ups (add liquidity):** The app takes **a portion of your balance**, swaps **half** to BIGGI, keeps the **other half** in the native coin, then deposits both into the pool. You receive new LP tokens.  
- How much of your balance is used is controlled by a simple **“what % to use”** setting (e.g., 50%).

**Preview before you confirm**  
- Before confirming you’ll see an exact **preview**:  
  - **useAmount** – total to be used,  
  - **half** – amount swapped to BIGGI,  
  - **otherHalf** – amount added as native coin.  
- You know precisely what will happen to your funds.

**Safety and control**  
- The team can **switch the router** (e.g., to another DEX) or adjust the **percentage of balance** used for liquidity top-ups if needed.  
- There are **emergency actions** for exceptional cases (e.g., DEX downtime): safely withdrawing ETH or tokens from the contract so funds don’t get stuck.

**Summary**  
You clearly see **how the swap flows**, **exactly how much is used**, and **what you receive** (LP tokens). Everything is **previewed upfront**, and if anything changes in the background (router, percentages, safety actions), the app explains it clearly.
`,
};
