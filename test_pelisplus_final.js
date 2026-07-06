const crypto = require('crypto');
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

function m(...args) { return String.fromCharCode(...args); }
function p(str, n) { return str.charCodeAt(n) || 0; }

// The server ALWAYS uses firstChar='t' for the AES key (confirmed by brute force)
function buildPelisplusKey() {
  const v = '#t'; // firstChar always 't'
  const P = "10";
  const O = 110;
  const G = 1;
  let N = "";
  const B = 'ᵟ'.charCodeAt(0).toString().split("");
  for (let ye = 0; ye < B.length; ye++) N += m(parseInt(P + B[ye]));
  N += m(p(v, 1));
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

function buildPelisplusIV() {
  let B = "";
  for (let Ie = 1; Ie < 10; Ie++) B += m(Ie + 48);
  B += m(48, 111, 0, 117, 121, 116, 114);
  return Buffer.from(B, 'utf8').slice(0, 16);
}

const PELISPLUS_KEY = buildPelisplusKey();
const PELISPLUS_IV = buildPelisplusIV();
console.log('Static key:', PELISPLUS_KEY.toString('hex'));

async function resolvePelisplus(embedUrl, referer) {
  // embedUrl is like https://pelisplus.upns.pro/#ikfbmp
  const urlObj = new URL(embedUrl);
  const hash = urlObj.hash.replace('#', ''); // "ikfbmp"
  const host = urlObj.hostname; // "pelisplus.upns.pro"
  
  const apiUrl = `https://${host}/api/v1/video?id=${hash}`;
  
  const res = await fetch(apiUrl, {
    headers: { 
      'User-Agent': ua,
      'Referer': referer || embedUrl,
      'Origin': `https://${host}`,
    }
  });
  if (!res.ok) return null;
  
  const hexData = await res.text();
  const buf = Buffer.from(hexData.trim(), 'hex');
  
  const decipher = crypto.createDecipheriv('aes-128-cbc', PELISPLUS_KEY, PELISPLUS_IV);
  decipher.setAutoPadding(true);
  const decrypted = decipher.update(buf, undefined, 'utf8') + decipher.final('utf8');
  
  // Clean up control characters from the decrypted string
  // Some hosts embed junk control chars inside JSON keys/values
  const cleaned = decrypted.replace(/[\x00-\x1F\x7F]/g, (c, i, s) => {
    // Allow whitespace inside strings only if it's valid JSON whitespace
    if (c === '\n' || c === '\r' || c === '\t') return c;
    return ''; // strip other control chars
  });
  let data;
  try {
    data = JSON.parse(cleaned);
  } catch(e) {
    // Try more aggressive cleaning: remove any non-printable chars
    const aggressive = decrypted.replace(/[^\x20-\x7E\x0A\x0D]/g, '');
    data = JSON.parse(aggressive);
  }

  
  // source is the primary m3u8
  if (data.source) {
    const source = data.source.replace(/\\\//g, '/').replace(/^\x01/, 'h');
    console.log('source m3u8:', source);
    return source;
  }
  return null;
}

async function run() {
  console.log('\nTest 1: upns');
  await resolvePelisplus('https://pelisplus.upns.pro/#ikfbmp', 'https://tioplus.app/');
  
  console.log('\nTest 2: 4meplayer');
  await resolvePelisplus('https://pelisplusto.4meplayer.pro/#18oqz', 'https://tioplus.app/');
  
  console.log('\nTest 3: strp2p');
  await resolvePelisplus('https://pelisplus.strp2p.com/#tusozc', 'https://tioplus.app/');
}
run().catch(console.error);
