from pathlib import Path
lines = Path('src/components/TOKEN/BiggiToken.jsx').read_text(encoding='utf-8').splitlines()
for idx,line in enumerate(lines, 1):
    if any(ord(ch) > 127 for ch in line):
        print(idx, line)
