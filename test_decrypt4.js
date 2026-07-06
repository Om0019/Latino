// SUCCESS! The decryption works. Key insight:
// - The key is derived from hash[1] (the FIRST char of the hash ID) 
// - Different IDs starting with different chars = different keys
// 
// ikfbmp -> hash[1] = 'i' (charCode 105) => key includes 'i' at position 4
// tusozc -> hash[1] = 't' (charCode 116) => key includes 't' at position 4  
// 18oqz -> hash[1] = '1' (charCode 49) => key includes '1' at position 4
//
// The IV is the SAME across all hosts (based on protocol only, not host!)
// Wait - let me recheck: the _() function uses window.location.protocol AND window.location.host
// But the IV was the same for all three... let me verify

// Actually looking at the output: all IVs are the same: 313233343536373839306f0075797472
// This means _() result doesn't vary by host. Let me check why.

// Let me look at _() more carefully:
// v = "https:"
// P = "https://"
// O = host (e.g. "pelisplus.upns.pro")
// G = v.length * P.length = 6 * 8 = 48
// N_base = 1
// B = ""
// for Ie 1..9: B += m(Ie + G) = m(49)='1', m(50)='2', ..., m(57)='9'  => "123456789"
// oe = "111"
// ye = oe.length * p(O, G) = 3 * O.charCodeAt(48) = 3*0 (host is shorter than 48) = 0
// He = parseInt("111") * 1 + "https:".length = 111 + 6 = 117
// k = 117 + 4 = 121
// se = p("https:", 1) = "https:"[1].charCodeAt(0) = 116 ('t')
// Pe = 116*1 - 2 = 114
// B += m(48, 111, 0, 117, 121, 116, 114)
// = m(48)='0', m(111)='o', m(0)='\0', m(117)='u', m(121)='y', m(116)='t', m(114)='r'
// B = "1234567890o\0uytr"
// 
// This confirms IV is the same for all hosts on https! Great.

const crypto = require('crypto');

function p(str, n) {
  return str.charCodeAt(n) || 0;
}
function m(...args) {
  return String.fromCharCode(...args);
}

function deriveKey(hashId) {
  // hashId is just the id part (e.g. "ikfbmp"), NOT including #
  const hash = '#' + hashId;
  const v = hash;
  const P = "10";
  const O = 110;
  const G = 1;
  let N = "";
  
  const B = 'ᵟ'.charCodeAt(0).toString().split("");  // "7519"
  for (let ye = 0; ye < B.length; ye++) {
    N += m(parseInt(P + B[ye]));
  }
  N += m(p(v, parseInt(P) / 10));  // p(hash, 1) = hash[1].charCodeAt(0) = hashId[0].charCodeAt(0)
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

function deriveIV() {
  // Always the same for https:// protocol
  let B = "";
  for (let Ie = 1; Ie < 10; Ie++) B += m(Ie + 48); // 48 = 6*8
  B += m(48, 111, 0, 117, 121, 116, 114);
  return Buffer.from(B, 'utf8').slice(0, 16);
}

async function fetchAndDecrypt(host, hash) {
  const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const url = `https://${host}/api/v1/video?id=${hash}`;
  
  const key = deriveKey(hash);
  const iv = deriveIV();
  
  console.log(`\n=== ${host} / #${hash} ===`);
  console.log('Key:', key.toString('hex'));
  
  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    const hexData = await res.text();
    const buf = Buffer.from(hexData.trim(), 'hex');
    
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
    decipher.setAutoPadding(true);
    const dec = decipher.update(buf, undefined, 'utf8') + decipher.final('utf8');
    const parsed = JSON.parse(dec);
    console.log('✓ SUCCESS! Keys:', Object.keys(parsed));
    if (parsed.hlsVideo) console.log('hlsVideo:', parsed.hlsVideo);
    if (parsed.hlsVideoTiktok) console.log('hlsVideoTiktok:', parsed.hlsVideoTiktok.replace(/\\/g, ''));
    if (parsed.mp4Video) console.log('mp4Video:', parsed.mp4Video);
    if (parsed.cfStream) console.log('cfStream:', parsed.cfStream);
    if (parsed.p2pManifest) console.log('p2pManifest:', parsed.p2pManifest);
    return parsed;
  } catch(e) {
    console.log('Failed:', e.message);
    return null;
  }
}

async function run() {
  await fetchAndDecrypt('pelisplus.upns.pro', 'ikfbmp');
  await fetchAndDecrypt('pelisplus.strp2p.com', 'tusozc');
  await fetchAndDecrypt('pelisplusto.4meplayer.pro', '18oqz');
}

run().catch(console.error);
