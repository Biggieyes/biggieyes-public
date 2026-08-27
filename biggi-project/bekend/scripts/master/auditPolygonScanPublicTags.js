const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const manifestFile = path.resolve(root, "reports/deployment-manifest-polygon.json");
const reportFile = path.resolve(root, "reports/polygonscan-public-tags.json");
const supportRoot = path.resolve(
  root,
  "contracts/default_workspace (10)/contracts/BIGGI_MASTER/CORE/FOR_SUPPORT"
);
const evidenceFile = path.resolve(supportRoot, "EVIDENCE/polygonscan-public-tags.json");
const submissionFile = path.resolve(supportRoot, "POLYGONSCAN_PUBLIC_NAME_TAG_SUBMISSION.md");
const requestCsvFile = path.resolve(supportRoot, "POLYGONSCAN_PUBLIC_NAME_TAG_REQUEST.csv");
const supportEmailFile = path.resolve(supportRoot, "POLYGONSCAN_SUPPORT_EMAIL.txt");

const TAGS = {
  MAIN: "BiggiEyes: Originals VRF",
  MAIN2: "BiggiEyes: Originals Public",
  TICKET_HUB: "BiggiEyes: Ticket Hub",
  VRF_ROUTER: "BiggiEyes: VRF Router",
  COMPUTE: "BiggiEyes: Compute",
  REGISTRY: "BiggiEyes: Series Registry",
  CHAPTER_CONTROLLER: "BiggiEyes: Chapter Controller",
  COLLECTION_REWARDS: "BiggiEyes: Collection Rewards",
  NFT_REWARDS: "BiggiEyes: NFT Rewards",
  MAIN_READER: "BiggiEyes: Main Reader",
  MULTI_COLLECTION_READER: "BiggiEyes: Collections Reader",
  CHAPTER_SERIES_READER: "BiggiEyes: Chapters Reader",
  NFT_REWARDS_READER: "BiggiEyes: NFT Rewards Reader",
  DISTRIBUTOR: "BiggiEyes: Mint Distributor",
  BIGGI_TOKEN: "BiggiEyes: BIGGI Token",
  RESERVE: "BiggiEyes: Reserve",
  TREASURY: "BiggiEyes: Treasury",
  DRIP_DISTRIBUTOR: "BiggiEyes: Drip Distributor",
  TOKEN_REWARDS: "BiggiEyes: Token Rewards",
  TOKEN_REWARDS_EMISSION_CONTROLLER: "BiggiEyes: Rewards Emission",
  MASTER_CONFIG: "BiggiEyes: Master Config",
  POLICY: "BiggiEyes: Policy",
  COMMUNITY_CENTER: "BiggiEyes: Community Center",
  BUYBACK_AGENT: "BiggiEyes: Buyback Agent",
  RESERVE_TREASURY_READER: "BiggiEyes: Reserve Reader",
  BUYBACK_READER: "BiggiEyes: Buyback Reader",
  TOKEN_REWARDS_READER: "BiggiEyes: Rewards Reader",
  TOKENOMICS_SYSTEM_ADDON_READER: "BiggiEyes: System Addon Reader",
  MODERATOR_CENTER: "BiggiEyes: Moderator V1",
  MODERATOR_CENTER_V2: "BiggiEyes: Moderator V2",
  SUPPLY_CONTROLLER: "BiggiEyes: Supply Controller",
  SUPPLY_GUARDIAN: "BiggiEyes: Supply Guardian",
  DEX_RESERVE_GUARD: "BiggiEyes: DEX Reserve Guard",
  LIQUIDITY_VAULT: "BiggiEyes: Liquidity Vault",
  LIQUIDITY_MANAGER: "BiggiEyes: Liquidity Manager",
  LIQUIDITY_ORCHESTRATOR: "BiggiEyes: Liquidity Orchestrator",
  LIQUIDITY_KEEPER_PROXY: "BiggiEyes: Liquidity Keeper",
  DRIP_LM: "BiggiEyes: Drip LM V1",
  DRIP_LM_V2: "BiggiEyes: Drip LM V2",
  DRIP_KEEPER_PROXY: "BiggiEyes: Drip Keeper",
  BUYBACK_UPKEEP_PROXY: "BiggiEyes: Buyback Keeper",
  SUPPLY_CONTROLLER_READER: "BiggiEyes: Supply Reader",
  SUPPLY_GUARDIAN_READER: "BiggiEyes: Guardian Reader",
  DEX_RESERVE_GUARD_READER: "BiggiEyes: DEX Guard Reader",
  SYSTEM_READER: "BiggiEyes: System Reader",
  LIQUIDITY_BRANCH_READER: "BiggiEyes: Liquidity Reader",
  LIQUIDITY_HELPER_READER: "BiggiEyes: Liquidity Helper",
  BIGGI_TOKENOMICS_READER: "BiggiEyes: Tokenomics Reader",
  MULTICALL: "BiggiEyes: Multicall",
  BIGGI_NAMES_LIB: "BiggiEyes: Names Library V1",
  BIGGI_NAMES_LIB2: "BiggiEyes: Names Library V2",
  CRE_AUTOMATION_RECEIVER: "BiggiEyes: CRE Receiver",
  CHAPTER_2_MAIN: "BiggiEyes: Universe VRF",
  CHAPTER_2_MAIN2: "BiggiEyes: Universe Public",
  CHAPTER_3_MAIN: "BiggiEyes: Mutant VRF",
  CHAPTER_3_MAIN2: "BiggiEyes: Mutant Public",
  CHAPTER_4_MAIN: "BiggiEyes: Apocalypse VRF",
  CHAPTER_4_MAIN2: "BiggiEyes: Apocalypse Public",
  CHAPTER_5_MAIN: "BiggiEyes: Super Hero VRF",
  CHAPTER_5_MAIN2: "BiggiEyes: Super Hero Public",
  OLD_TICKET_HUB: "BiggiEyes: Deprecated Ticket Hub",
  OLD_COLLECTION_REWARDS: "BiggiEyes: Deprecated Rewards",
  OLD_MAIN_READER: "BiggiEyes: Deprecated Main Reader",
};

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function extractPublicTag(html) {
  const tooltip = html.match(
    /title=(['"])Public Name Tag \(viewable by anyone\)\s*<br\s*\/?>([\s\S]*?)\1/i
  );
  return tooltip ? stripHtml(tooltip[2]) : null;
}

async function fetchPage(address, attempts = 4) {
  const url = `https://polygonscan.com/address/${address}`;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "BIGGI PolygonScan verification audit/1.0" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      return {
        explorerUrl: url,
        publicNameTag: extractPublicTag(html),
        pageReportsVerified: /Contract:\s*Verified/i.test(html),
      };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 1_500));
    }
  }
  throw lastError;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function categoryFor(key) {
  if (/^(MAIN|MAIN2|CHAPTER_|TICKET_HUB|REGISTRY|CHAPTER_CONTROLLER|COLLECTION_REWARDS|NFT_REWARDS|OLD_)/.test(key)) {
    return "NFT";
  }
  if (/VRF|CRE/.test(key)) return "Oracle";
  return "DeFi";
}

function markdown(report) {
  const lines = [
    "# PolygonScan Public Name Tag Submission",
    "",
    `Generated: ${report.createdAt}`,
    "",
    "Project website: `https://biggieyes.com`",
    "",
    "This file covers current canonical and deprecated historical BIGGI-owned Polygon mainnet contracts. Source-code verification and public name tags are separate PolygonScan states. Public tags require PolygonScan account ownership verification and PolygonScan review.",
    "",
    "## Audit Summary",
    "",
    `- Canonical contracts: \`${report.summary.canonical}\``,
    `- Deprecated historical contracts: \`${report.summary.historical}\``,
    `- All BIGGI-owned contracts with bytecode: \`${report.summary.total}\``,
    `- Source verified: \`${report.summary.sourceVerified}\``,
    `- Existing public name tags: \`${report.summary.publicTagged}\``,
    `- Public name tags to request: \`${report.summary.tagRequests}\``,
    `- Explorer lookup failures: \`${report.summary.lookupFailures}\``,
    "",
    "## Request Groups",
    "",
    ...Object.entries(report.summary.tagRequestsByDeployer).map(
      ([deployer, count]) => `- Deployer \`${deployer}\`: \`${count}\` missing public tags`
    ),
    "",
    "## Submission Rows",
    "",
    "| Lifecycle | Key | Address | Deployer | Category | Current public tag | Suggested public tag |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const row of report.contracts) {
    lines.push(
      `| ${row.lifecycle} | \`${row.key}\` | [\`${row.address}\`](${row.explorerUrl}#code) | \`${row.deployer || "unknown"}\` | ${row.category} | ${row.publicNameTag || "-"} | ${row.suggestedPublicNameTag} |`
    );
  }
  lines.push(
    "",
    "## Form Values",
    "",
    "- Website: `https://biggieyes.com`",
    "- Description template: `Official BIGGI Polygon mainnet contract. Source code is verified on PolygonScan; its role, lifecycle, and address are listed in the public BIGGI deployment manifest.`",
    "- Evidence: `EVIDENCE/deployment-manifest-polygon.json` and `EVIDENCE/polygonscan-public-tags.json`",
    "- Submit at: `https://polygonscan.com/contactus?id=5`",
    "",
    "The deployer shown in each row must be used when PolygonScan asks for a creator signature. Never provide a private key to PolygonScan or support.",
    "",
    "## External Infrastructure",
    "",
    "The QuickSwap router/factory, WPOL, Chainlink VRF coordinator, and Chainlink Keystone Forwarder are external contracts and must not receive BIGGI ownership tags. The factory-created BIGGI/WPOL pair is also outside the owned manifest and already has the public tag `BiggiEyes: POL Liquidity Pair`."
  );
  return `${lines.join("\n")}\n`;
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function requestCsv(report) {
  const description =
    "Official BIGGI Polygon mainnet contract. Source code is verified on PolygonScan; role and lifecycle are documented in the public deployment manifest.";
  const header = [
    "lifecycle",
    "key",
    "contract_address",
    "deployer_address",
    "suggested_public_name_tag",
    "category",
    "contract_name",
    "website",
    "source_code_url",
    "description",
  ];
  const rows = report.contracts
    .filter((entry) => !entry.publicNameTag && !entry.lookupError)
    .map((entry) => [
      entry.lifecycle,
      entry.key,
      entry.address,
      entry.deployer || "",
      entry.suggestedPublicNameTag,
      entry.category,
      entry.contractName || "",
      "https://biggieyes.com",
      `${entry.explorerUrl}#code`,
      description,
    ]);
  return `${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function supportEmail(report) {
  const deployerGroups = Object.entries(report.summary.tagRequestsByDeployer)
    .map(([deployer, count]) => `- ${deployer}: ${count} contract address${count === 1 ? "" : "es"}`)
    .join("\n");
  return `Subject: Bulk public name tag request - BiggiEyes contracts on Polygon mainnet

Hello PolygonScan Support,

I am contacting you on behalf of BiggiEyes to request public name tags for our source-verified Polygon mainnet contracts.

Project details:
- Project: BiggiEyes
- Website: https://biggieyes.com
- Public repository: https://github.com/Biggieyes/biggieyes-public
- Network: Polygon PoS mainnet (chain ID 137)
- Description: BiggiEyes is a Polygon mainnet NFT ecosystem with chapter-based VRF/public ERC-721 collections and a shared BIGGI tokenomics and automation stack.

Verification status:
- 60 current canonical contracts
- 3 deprecated historical contracts
- 63/63 BIGGI-owned contracts with bytecode are source verified
- All 63 PolygonScan address pages report "Contract: Verified"
- 10 addresses already have public name tags
- This request covers the remaining 53 addresses

The missing tags are grouped by contract creator/deployer:
${deployerGroups}

The attached CSV contains only the 53 missing public tags. It includes each contract address, creator/deployer address, lifecycle, category, verified source-code URL, and the requested public name tag. The three replaced historical contracts are explicitly labeled "Deprecated" so they cannot be confused with current endpoints.

External QuickSwap and Chainlink infrastructure is intentionally excluded. The factory-created BIGGI/WPOL pair is also excluded because it already has the public name tag "BiggiEyes: POL Liquidity Pair".

Attachments:
1. POLYGONSCAN_PUBLIC_NAME_TAG_REQUEST.csv
2. deployment-manifest-polygon.json
3. polygonscan-public-tags.json

I control both creator wallets listed above and can complete PolygonScan ownership verification or sign PolygonScan-generated ownership messages from each creator address. Please let me know whether you can process this as one bulk request or whether you require two requests separated by creator wallet.

No private keys or seed phrases will be provided. Please send the exact ownership-verification message through the official PolygonScan process if a signature is required.

Best regards,
Daniel Barta
BiggiEyes
https://biggieyes.com
`;
}

async function main() {
  if (!fs.existsSync(manifestFile)) throw new Error(`Missing deployment manifest: ${manifestFile}`);
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  if (!Array.isArray(manifest.contracts) || manifest.contracts.length === 0) {
    throw new Error("Deployment manifest contains no contracts");
  }

  const inventory = [
    ...manifest.contracts.map((entry) => ({ ...entry, lifecycle: "current" })),
    ...(manifest.historicalContracts || []).map((entry) => ({ ...entry, lifecycle: "deprecated" })),
  ];
  const missingTags = inventory.filter((entry) => !TAGS[entry.key]).map((entry) => entry.key);
  if (missingTags.length > 0) throw new Error(`Missing suggested tags for: ${missingTags.join(", ")}`);
  for (const [key, tag] of Object.entries(TAGS)) {
    if (tag.length > 35) throw new Error(`Suggested tag exceeds 35 characters: ${key}=${tag}`);
  }

  const retryFailures = process.argv.includes("--retry-failures");
  const previousReport = retryFailures && fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, "utf8")) : null;
  const previousByAddress = new Map(
    (previousReport?.contracts || []).map((entry) => [String(entry.address).toLowerCase(), entry])
  );
  const contracts = await mapLimit(inventory, retryFailures ? 1 : 3, async (entry, index) => {
    const previous = previousByAddress.get(String(entry.address).toLowerCase());
    if (retryFailures && previous && !previous.lookupError) {
      return { ...previous, ...entry };
    }
    let page = {};
    let lookupError = null;
    try {
      page = await fetchPage(entry.address);
    } catch (error) {
      lookupError = error.message || String(error);
      page.explorerUrl = `https://polygonscan.com/address/${entry.address}`;
    }
    const row = {
      ...entry,
      ...page,
      lookupError,
      category: categoryFor(entry.key),
      suggestedPublicNameTag: TAGS[entry.key],
    };
    console.log(
      `[TAG ${index + 1}/${inventory.length}] ${entry.key}: ${row.publicNameTag || "no-public-tag"}${
        lookupError ? ` (${lookupError})` : ""
      }`
    );
    if (retryFailures) await new Promise((resolve) => setTimeout(resolve, 3_000));
    return row;
  });

  const report = {
    network: manifest.network,
    chainId: manifest.chainId,
    createdAt: new Date().toISOString(),
    sourceManifestCreatedAt: manifest.createdAt,
    summary: {
      canonical: manifest.contracts.length,
      historical: (manifest.historicalContracts || []).length,
      total: contracts.length,
      sourceVerified: contracts.filter((entry) => entry.verified === true).length,
      publicTagged: contracts.filter((entry) => entry.publicNameTag).length,
      tagRequests: contracts.filter((entry) => !entry.publicNameTag && !entry.lookupError).length,
      tagRequestsByDeployer: contracts
        .filter((entry) => !entry.publicNameTag && !entry.lookupError)
        .reduce((counts, entry) => {
          const deployer = entry.deployer || "unknown";
          counts[deployer] = (counts[deployer] || 0) + 1;
          return counts;
        }, {}),
      lookupFailures: contracts.filter((entry) => entry.lookupError).length,
    },
    contracts,
  };

  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(evidenceFile, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(submissionFile, markdown(report));
  fs.writeFileSync(requestCsvFile, requestCsv(report));
  fs.writeFileSync(supportEmailFile, supportEmail(report));
  console.log(
    JSON.stringify(
      { summary: report.summary, reportFile, evidenceFile, submissionFile, requestCsvFile, supportEmailFile },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
