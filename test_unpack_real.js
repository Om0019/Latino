const fs = require('fs');
const unpacker = require('./src/unpacker');

const html = fs.readFileSync('vidhide.html', 'utf8');
const packerRegex = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\}\s*\(\s*([\s\S]*?)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\s\S]*?)\.split\(['"]\|['"]\)/gi;

let match;
while ((match = packerRegex.exec(html)) !== null) {
    let p = match[1].trim();
    if ((p.startsWith("'") && p.endsWith("'")) || (p.startsWith('"') && p.endsWith('"'))) {
      p = p.substring(1, p.length - 1);
    }
    const a = parseInt(match[2]);
    const c = parseInt(match[3]);
    let kStr = match[4].trim();
    if ((kStr.startsWith("'") && kStr.endsWith("'")) || (kStr.startsWith('"') && kStr.endsWith('"'))) {
      kStr = kStr.substring(1, kStr.length - 1);
    }
    const k = kStr.split('|');
    console.log(`Matched! a=${a}, c=${c}`);
    
    const unpacked = unpacker.unpack(p, a, c, k, {}, {});
    console.log("Unpacked length:", unpacked.length);
    console.log(unpacked.substring(0, 300));
    const m3u8s = unpacked.match(/https?:[^'"]+\.m3u8/g);
    console.log("M3u8 matches:", m3u8s);
}
