const fs = require('fs');
const unpacker = require('./src/unpacker');

async function test() {
  const html = await (await fetch('https://vidhideplus.com/v/jwbzc2sk6vi4', { headers: { 'User-Agent': 'Mozilla/5.0' }})).text();
  fs.writeFileSync('vidhide.html', html);
  
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
      console.log(unpacked.substring(0, 500));
  }
}
test();
