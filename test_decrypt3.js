// Test decrypting with the derived key
// Key is derived from the hash fragment, not from the URL itself
// S() key derivation only uses one char from the hash (window.location.hash[1])
// _() IV derivation uses the protocol + host

const crypto = require('crypto');

function p(str, n) {
  return str.charCodeAt(n) || 0;
}
function m(...args) {
  return String.fromCharCode(...args);
}
const te = new (require('util').TextEncoder || (() => ({ encode: (s) => Buffer.from(s, 'utf8') })))();

function deriveKey(hash) {
  // hash is like "#ikfbmp"
  const v = hash;
  const P = "10";
  const O = 110;
  const G = 1;
  let N = "";
  
  const B = 'ᵟ'.charCodeAt(0).toString().split("");  // "7519"
  for (let ye = 0; ye < B.length; ye++) {
    N += m(parseInt(P + B[ye]));
  }
  N += m(p(v, parseInt(P) / 10));  // p(hash, 1) = hash[1].charCodeAt(0)
  N += N.substring(1, 3);
  N += m(O, O - 1, O + 7);
  const oe = "3579".split("");
  N += m(oe[3] + oe[2], oe[1] + oe[2]);  // "97" and "57" parsed as numbers by String.fromCharCode
  const val1 = oe[0]*G + G + oe[3];   // "49" 
  N += m(val1, val1);
  const val2 = oe[3]*P + oe[3]*G;     // 99
  oe.reverse();
  const val3 = parseInt(oe.join("").substring(0, 2));  // 97
  N += m(val2, val3);
  
  return Buffer.from(N, 'utf8');
}

function deriveIV(protocol, host) {
  // _() in the obfuscated code
  // v = protocol (e.g. "https:")
  // O = host (e.g. "pelisplus.upns.pro")
  const v = protocol;
  const P = v + "//";
  const O = host;
  const G = v.length * P.length;  // "https:".length * "https://".length
  const N_base = 1;
  let B = "";
  for (let Ie = N_base; Ie < 10; Ie++) B += m(Ie + G);
  
  let oe = "1" + "" + "1" + "" + "1";  // "111"
  const ye = oe.length * p(O, G);
  const He = parseInt(oe) * N_base + v.length;
  const k = He + 4;
  const se = p(v, N_base);
  const Pe = se * N_base - 2;
  B += m(G, parseInt(oe), ye, He, k, se, Pe);
  return Buffer.from(B, 'utf8');
}

async function fetchAndDecrypt(host, hash) {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const url = `https://${host}/api/v1/video?id=${hash}`;
  
  const keyBuf = deriveKey(`#${hash}`);
  const ivBuf = deriveIV('https:', host);
  
  console.log(`\nHost: ${host}, Hash: ${hash}`);
  console.log('Key:', keyBuf.toString('hex'), 'len:', keyBuf.length);
  console.log('IV:', ivBuf.toString('hex'), 'len:', ivBuf.length);
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    const hexData = await res.text();
    console.log('Got hex data len:', hexData.length);
    
    const buf = Buffer.from(hexData.trim(), 'hex');
    
    // Try with derived key and IV
    const key16 = keyBuf.slice(0, 16);
    const iv16 = ivBuf.slice(0, 16);
    
    console.log('Key16:', key16.toString('hex'));
    console.log('IV16:', iv16.toString('hex'));
    
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', key16, iv16);
      decipher.setAutoPadding(true);
      const dec = decipher.update(buf, undefined, 'utf8') + decipher.final('utf8');
      console.log('✓ DECRYPTED:', dec.substring(0, 300));
    } catch(e) {
      console.log('Decryption failed:', e.message);
    }
  } catch(e) {
    console.error(e.message);
  }
}

async function run() {
  await fetchAndDecrypt('pelisplus.upns.pro', 'ikfbmp');
  await fetchAndDecrypt('pelisplus.strp2p.com', 'tusozc');
  await fetchAndDecrypt('pelisplusto.4meplayer.pro', '18oqz');
}

run().catch(console.error);
