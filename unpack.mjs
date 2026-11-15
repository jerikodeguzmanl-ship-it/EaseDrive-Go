// Usage: node unpack.mjs EASEDRIVE-GO-FULL-CODE.txt  -> recreates every file exactly as written.
import fs from 'node:fs'; import path from 'node:path'
const txt = fs.readFileSync(process.argv[2], 'utf8'); const parts = txt.split(/^===== FILE: (.+?) =====\n/m)
for (let i = 1; i < parts.length; i += 2) { const p = parts[i]; fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, parts[i + 1].slice(0, -1)); console.log('wrote', p) }
