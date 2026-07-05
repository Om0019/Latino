const html = require('fs').readFileSync('vidhide.html', 'utf8');
const packerRegex = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\}\s*\(\s*(['"])([\s\S]*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\5\.split\(['"]\|['"]\)/gi;

let m;
while ((m = packerRegex.exec(html)) !== null) {
  const p = m[2];
  const a = parseInt(m[3]);
  const c = parseInt(m[4]);
  const k = m[6].split('|');
  console.log(`Matched! a=${a}, c=${c}, k.length=${k.length}`);
  
  const unpacker = require('./src/unpacker');
  const unpacked = unpacker.unpack(p, a, c, k, {}, {});
  console.log("Unpacked length:", unpacked.length);
  
  const directUrls = unpacked.match(/https?:[^'"]+\.m3u8/g);
  console.log("Direct URLs:", directUrls);
}
