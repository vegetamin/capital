from pathlib import Path
import re
root=Path(__file__).resolve().parents[1]
s=(root/'index.html').read_text()
assert '<style>' not in s and '<script>' not in s
paths=re.findall(r'(?:href|src)="\./([^"#]+)"',s)
assert len(paths)>=11,paths
for p in paths:assert (root/p).is_file(),p
assert (root/'legacy/capital-main/js/modules/reading.js').exists()
print('OK',len(paths),'referenced assets; original source preserved')
