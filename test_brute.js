const crypto = require('crypto');
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

function p(str, n) { return str.charCodeAt(n) || 0; }
function m(...args) { return String.fromCharCode(...args); }

// Build all 36 possible keys (one per first char of hash)
function buildKey(firstChar) {
  const v = '#' + firstChar; // simulate hash
  const P = "10";
  const O = 110;
  const G = 1;
  let N = "";
  const B = 'ᵟ'.charCodeAt(0).toString().split("");  // "7519"
  for (let ye = 0; ye < B.length; ye++) N += m(parseInt(P + B[ye]));
  N += m(p(v, 1));  // first char of hash id
  N += N.substring(1, 3);
  N += m(O, O - 1, O + 7);
  const oe = "3579".split("");
  N += m(oe[3] + oe[2], oe[1] + oe[2]);
  const val1 = oe[0]*G + G + oe[3];
  N += m(val1, val1);
  const val2 = oe[3]*P + oe[3]*G;
  oe.reverse();
  const val3 = parseInt(oe.join("").substring(0, 2));
  N += m(val2, val3);
  return Buffer.from(N, 'utf8').slice(0, 16);
}

// IV is always the same for https
function buildIV() {
  let B = "";
  for (let Ie = 1; Ie < 10; Ie++) B += m(Ie + 48);
  B += m(48, 111, 0, 117, 121, 116, 114);
  return Buffer.from(B, 'utf8').slice(0, 16);
}

// Brute force: try all possible first chars
async function bruteForceDecrypt(hexData) {
  const buf = Buffer.from(hexData.trim(), 'hex');
  const iv = buildIV();
  
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (const c of chars) {
    const key = buildKey(c);
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      decipher.setAutoPadding(true);
      const dec = decipher.update(buf, undefined, 'utf8') + decipher.final('utf8');
      // Check if it looks like JSON
      if (dec.startsWith('{') || dec.startsWith('[')) {
        console.log(`  ✓ firstChar='${c}' => ${dec.substring(0, 200)}`);
        return dec;
      }
    } catch(e) {}
  }
  console.log('  ✗ No key found');
  return null;
}

async function run() {
  const iv = buildIV();
  console.log('IV:', iv.toString('hex'));

  for (const [host, hash] of [
    ['pelisplus.upns.pro', 'ikfbmp'],
    ['pelisplusto.4meplayer.pro', '18oqz'],
    ['pelisplus.strp2p.com', 'tusozc'],
  ]) {
    console.log(`\n=== ${host} / ${hash} ===`);
    const res = await fetch(`https://${host}/api/v1/video?id=${hash}`, { headers: { 'User-Agent': ua }});
    const hex = await res.text();
    console.log(`  hex len: ${hex.length}`);
    await bruteForceDecrypt(hex);
  }
}
run().catch(console.error);
