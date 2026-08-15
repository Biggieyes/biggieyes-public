const fs = require('fs');
const path = require('path');

const inFile = path.join(__dirname, 'reports', 'compareAbiToSource.report.json');
const outFile = path.join(__dirname, 'reports', 'compareAbiToSource.summary.md');
if (!fs.existsSync(inFile)) {
  console.error('Input report not found:', inFile);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(inFile, 'utf8'));
let md = `# ABI ↔ Source Comparison Summary\n\n`;
md += `Total contracts: ${report.summary.totalContracts}  \n`;
md += `Contracts with issues: ${report.summary.contractsWithIssues}  \n\n`;
for (const [name, c] of Object.entries(report.contracts)) {
  const hasMissing = (c.missingInAbi && c.missingInAbi.length) || (c.missingInSource && c.missingInSource.length) || (c.missingEventsInAbi && c.missingEventsInAbi.length) || (c.missingEventsInSource && c.missingEventsInSource.length);
  if (!hasMissing) continue;
  md += `## ${name}\n`;
  md += `- ABI file: ${c.abiFile}\n`;
  md += `- Source file: ${c.sourceFile || 'NOT FOUND'}\n`;
  if (c.missingInAbi && c.missingInAbi.length) md += `- Items present in source but missing in ABI: ${c.missingInAbi.map(x=>x.name).join(', ')}\n`;
  if (c.missingInSource && c.missingInSource.length) md += `- Items present in ABI but missing in source (or inherited): ${c.missingInSource.map(x=>x.name).join(', ')}\n`;
  if (c.missingEventsInAbi && c.missingEventsInAbi.length) md += `- Events missing in ABI: ${c.missingEventsInAbi.map(x=>x.name).join(', ')}\n`;
  if (c.missingEventsInSource && c.missingEventsInSource.length) md += `- Events in ABI but not in source: ${c.missingEventsInSource.map(x=>x.name).join(', ')}\n`;
  md += `\n**Suggested actions:**\n`;
  md += `- If the missing items are inherited (OpenZeppelin), consider ignoring; otherwise regenerate artifacts by running Hardhat compile and ensure contract names match.\n`;
  md += `- If \\\`sourceFile\\\` is null, locate the correct source or update MAINNET_CONTRACT_DOSSIERS to point to the artifact.\n\n`;
}

fs.writeFileSync(outFile, md);
console.log('Summary written to', outFile);
