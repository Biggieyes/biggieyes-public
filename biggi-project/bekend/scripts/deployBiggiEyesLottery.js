// Deploys BiggiEyesLottery (VRF) and performs initial configuration.
// Required env (scripts/.env):
//   SUBSCRIPTION_ID         - VRF v2+ subscription ID (uint256)
//   VRF_COORDINATOR         - coordinator address
//   OWNER                   - initial owner
//   KEY_HASH                - VRF keyHash
//   TICKET_PRICE_WEI        - initial ticket price in wei
// Optional env:
//   BIGGI_TOKEN             - BIGGI ERC20 address
//   BIGGI_PER_ETH           - price oracle ratio (BIGGI per 1 ETH, 18 decimals)
//   TOKEN_SINK              - address to route BIGGI
//   TOKEN_SINK_BPS          - bps (<=10000)
//   LIQUIDITY_SINK          - BiggiRewardsAndLiquidity address (receives ETH)
//   LIQUIDITY_BPS           - bps for liquiditySink (<=10000)
// Gas: override via MAX_PRIORITY_GWEI, MAX_FEE_GWEI.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const hre = require('hardhat');
const { ethers } = hre;

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main() {
  const subId = requireEnv('SUBSCRIPTION_ID');
  const coordinator = requireEnv('VRF_COORDINATOR');
  const owner = requireEnv('OWNER');
  const keyHash = requireEnv('KEY_HASH');
  const ticketPrice = requireEnv('TICKET_PRICE_WEI');

  const gasPrio = ethers.utils.parseUnits(process.env.MAX_PRIORITY_GWEI || '40', 'gwei');
  const gasFee = ethers.utils.parseUnits(process.env.MAX_FEE_GWEI || '80', 'gwei');

  console.log('Deploying BiggiEyesLottery with:');
  console.log('  subscriptionId :', subId);
  console.log('  vrfCoordinator :', coordinator);
  console.log('  owner          :', owner);
  console.log('  keyHash        :', keyHash);
  console.log('  ticketPriceWei :', ticketPrice);

  const Factory = await ethers.getContractFactory('BiggiEyesLottery');
  const contract = await Factory.deploy(subId, coordinator, owner, keyHash, {
    maxPriorityFeePerGas: gasPrio,
    maxFeePerGas: gasFee,
  });
  console.log('tx hash:', contract.deployTransaction.hash);
  await contract.deployed();
  console.log('Deployed at:', contract.address);

  const txs = [];

  // Set ticket price
  txs.push({
    label: 'setTicketPrice',
    fn: () => contract.setTicketPrice(ticketPrice, { maxPriorityFeePerGas: gasPrio, maxFeePerGas: gasFee }),
  });

  // Optional configs
  if (process.env.BIGGI_TOKEN) {
    txs.push({ label: 'setBiggiToken', fn: () => contract.setBiggiToken(process.env.BIGGI_TOKEN, { maxPriorityFeePerGas: gasPrio, maxFeePerGas: gasFee }) });
  }
  if (process.env.BIGGI_PER_ETH) {
    txs.push({ label: 'setBiggiRate', fn: () => contract.setBiggiRate(process.env.BIGGI_PER_ETH, { maxPriorityFeePerGas: gasPrio, maxFeePerGas: gasFee }) });
  }
  if (process.env.TOKEN_SINK) {
    const bps = process.env.TOKEN_SINK_BPS || '10000';
    txs.push({ label: 'setTokenSink', fn: () => contract.setTokenSink(process.env.TOKEN_SINK, bps, { maxPriorityFeePerGas: gasPrio, maxFeePerGas: gasFee }) });
  }
  if (process.env.LIQUIDITY_SINK) {
    const bps = process.env.LIQUIDITY_BPS || '500';
    txs.push({ label: 'setLiquiditySink', fn: () => contract.setLiquiditySink(process.env.LIQUIDITY_SINK, bps, { maxPriorityFeePerGas: gasPrio, maxFeePerGas: gasFee }) });
  }

  for (const step of txs) {
    console.log('Calling', step.label, '...');
    const tx = await step.fn();
    console.log('  tx:', tx.hash);
    await tx.wait();
  }

  console.log('Done. Remember to pin new address and update .env/frontends.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
