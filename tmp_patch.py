from pathlib import Path
path = Path('src/components/panels/RewardsPanel.jsx')
text = path.read_text(encoding='utf-8')
start = '  const collectionTab = ('
end = '  const nftTab = ('
start_idx = text.find(start)
end_idx = text.find(end, start_idx)
if start_idx == -1 or end_idx == -1:
    raise SystemExit('markers not found')
print('start', start_idx, 'end', end_idx)
