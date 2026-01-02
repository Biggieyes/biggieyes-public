require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Najdi všechny KEY=0x.... ve .env (aby se nic nevynechalo)
const envPath = path.join(process.cwd(), '.env');
let dynamicKeys = [];
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  dynamicKeys = Array.from(
    new Set(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.split('=')[0])
        .filter((key) => /^[_A-Z0-9]+$/.test(key) && (process.env[key] || '').startsWith('0x'))
    )
  );
}

// Pevný seznam klíčů, které chceme mít na očích (fallback)
const baseline = [
  'FACTORY',
  'ROUTER',
  'WETH',
  'BIGGI',
  'PAIR',
  'BUYBACK_AGENT',
  'NEW_BUYBACK_AGENT',
  'DISTRIBUTOR',
  'TREASURY',
  'POLICY',
  'DRIP_LM',
  'DRIP_DISTRIBUTOR',
  'DRIP_KEEPER_PROXY',
  'RESERVE',
  'LIQUIDITY_MANAGER',
  'LIQUIDITY_VAULT',
  'LIQUIDITY_AUTOMATION',
  'LIQUIDITY_SETUP',
  'UPKEEP_PROXY',
  'KEEPER_PROXY',
  'KEEPER_ADDR',
  'COLLECTION',
  'COLLECTION2',
  'COLLECTION_REWARDS',
  'COMMUNITY_CENTER',
  'NFT_REWARDS',
  'TOKEN_REWARDS',
  'TOKENOMIK_READER',
  'MASTER_CONFIG',
];

const labels = Array.from(new Set([...baseline, ...dynamicKeys])).sort();
const rows = labels.map((key) => ({ key, address: process.env[key] || '' }));

console.table(rows);

const missing = rows.filter((r) => !r.address);
if (missing.length) {
  console.error('\nChybí hodnoty pro:', missing.map((m) => m.key).join(', '));
  process.exitCode = 1;
}
