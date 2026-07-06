// Let me check: the key uses `window.crypto.subtle.importKey` not `createDecipheriv`
// The real flow is:
// 1. keyBytes = TextEncoder.encode(S())  <- the N string we computed
// 2. cryptoKey = await window.crypto.subtle.importKey('raw', keyBytes, {name: 'AES-CBC'}, true, ['decrypt'])
// 3. iv = TextEncoder.encode(_())   <- 16 bytes of IV string
// 4. plaintext = await window.crypto.subtle.decrypt({name:'AES-CBC', iv}, cryptoKey, fromHex(hexData))
//
// NOTE: the data IS the WHOLE hex string (not first 16 bytes as IV!)
// The IV comes from _() separately.
//
// The issue with my previous attempt:
// - For "strp2p" it succeeded (returned JSON with control chars in version string)
// - For "upns" it failed - different key or different host-based IV
//
// Let me verify the IV calculation is truly host-independent.
// _() code:
//   v = window.location.protocol  = "https:"
//   P = v + "//" = "https://"
//   O = window.location.host = "pelisplus.upns.pro" etc
//   G = v.length * P.length = 6 * 8 = 48  (SAME regardless of host)
//   N_base = 1
//   B = m(49)+m(50)+...+m(57) = "123456789"
//   oe = "111"
//   ye = oe.length * p(O, G)   <-- p(O, 48) = O.charCodeAt(48)
//   "pelisplus.upns.pro" has length 18, so charCodeAt(48) = 0 (undefined index)
//   ye = 3 * 0 = 0
//   He = parseInt("111") * 1 + v.length = 111 + 6 = 117
//   k = 117 + 4 = 121
//   se = p(v, 1) = "https:".charCodeAt(1) = 116 ('t')
//   Pe = 116 * 1 - 2 = 114
//   B += m(48, 111, 0, 117, 121, 116, 114) = "0o\0uytr"
//   Final B = "123456789" + "0o\0uytr" = 16 bytes  ✓
//
// So IV IS the same for all https:// hosts. My IV is correct.
//
// Then why does "upns" fail but "strp2p" succeeds?
// Let me check the exact data received.

const crypto = require('crypto');
const fs = require('fs');

function p(str, n) { return str.charCodeAt(n) || 0; }
function m(...args) { return String.fromCharCode(...args); }

function deriveKey(hashId) {
  const hash = '#' + hashId;
  const P = "10";
  const O = 110;
  const G = 1;
  let N = "";
  const B = 'ᵟ'.charCodeAt(0).toString().split("");
  for (let ye = 0; ye < B.length; ye++) {
    N += m(parseInt(P + B[ye]));
  }
  N += m(p(hash, 1));  // hash[1] = hashId[0]
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
  console.log(`  N string: "${N}" (${[...N].map(c=>c.charCodeAt(0)).join(',')})`);
  return Buffer.from(N, 'utf8').slice(0, 16);
}

function deriveIV() {
  let B = "";
  for (let Ie = 1; Ie < 10; Ie++) B += m(Ie + 48);
  B += m(48, 111, 0, 117, 121, 116, 114);
  return Buffer.from(B, 'utf8').slice(0, 16);
}

async function test(host, hash) {
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const res = await fetch(`https://${host}/api/v1/video?id=${hash}`, { headers: { 'User-Agent': ua } });
  const hex = await res.text();
  
  const key = deriveKey(hash);
  const iv = deriveIV();
  const buf = Buffer.from(hex.trim(), 'hex');
  
  console.log(`\n=== ${host} ===`);
  console.log('  hashId[0]:', hash[0], '(', hash.charCodeAt(0), ')');
  console.log('  key:', key.toString('hex'));
  console.log('  iv:', iv.toString('hex'));
  console.log('  data len:', buf.length);
  
  // Try: maybe importKey uses the raw UTF-8 bytes and the IV is the raw UTF-8 bytes too
  // Let me try every combination  
  for (const tryIvHex of [
    '313233343536373839306f0075797472', // our computed IV
    '3132333435363738393000756f797472', // maybe null byte in different position
  ]) {
    const tryIv = Buffer.from(tryIvHex, 'hex');
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', key, tryIv);
      decipher.setAutoPadding(true);
      const dec = decipher.update(buf, undefined, 'utf8') + decipher.final('utf8');
      if (dec.length > 0) {
        console.log('  ✓ IV', tryIvHex, '=>', dec.substring(0, 200));
      }
    } catch(e) {}
  }
}

async function run() {
  await test('pelisplus.upns.pro', 'ikfbmp');
  // Now let's compare the working strp2p with CORRECT raw bytes
  const iv = deriveIV();
  console.log('\nIV hex:', iv.toString('hex'));
  console.log('IV str:', [...iv].map(b => b === 0 ? '\\0' : String.fromCharCode(b)).join(''));
}

run().catch(console.error);
