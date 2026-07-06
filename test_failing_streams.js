const fs = require('fs');
const crypto = require('crypto');

const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function tryFetch(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': userAgent, ...opts.headers },
    redirect: opts.redirect || 'follow',
  });
  return res;
}

async function investigateEmturbovid() {
  console.log('\n=== emturbovid ===');
  const url = 'https://emturbovid.com/t/6a28e144785cb';
  const res = await tryFetch(url);
  const html = await res.text();
  console.log('Status:', res.status, 'URL:', res.url);
  fs.writeFileSync('emturbovid.html', html);
  console.log('Length:', html.length);
  // Look for meta refresh, data-source, jwplayer config etc
  const patterns = [
    /file\s*:\s*["']([^"']+\.m3u8[^"']*)/gi,
    /source\s*:\s*["']([^"']+\.(m3u8|mp4)[^"']*)/gi,
    /src\s*:\s*["']([^"']+\.(m3u8|mp4)[^"']*)/gi,
    /playerjs\.file\s*=\s*["']([^"']+)/gi,
    /"file"\s*:\s*"([^"]+)"/gi,
    /window\.location\.replace\s*\(\s*["']([^"']+)/gi,
    /iframe[^>]+src=["']([^"']+)/gi,
  ];
  for (const p of patterns) {
    const matches = html.match(p);
    if (matches) console.log(p.source, '=>', matches.slice(0, 3));
  }
}

async function investigatePelisplusUpns(hash) {
  console.log('\n=== pelisplus.upns.pro ===');
  // First, try calling the video API
  const videoApiUrl = `https://pelisplus.upns.pro/api/v1/video?id=${hash}`;
  const res = await tryFetch(videoApiUrl, { headers: { 'Origin': 'https://pelisplus.upns.pro', 'Referer': `https://pelisplus.upns.pro/#${hash}` } });
  const text = await res.text();
  console.log('Video API Status:', res.status);
  console.log('Response (hex):', text.substring(0, 100));
  
  // It's hex-encoded, try to decode it
  try {
    const buf = Buffer.from(text.trim(), 'hex');
    console.log('Hex decoded len:', buf.length);
    
    // Try some known keys from the JS
    const keys = [
      '1077efecc0b24d02ace33c1e52e2fb4b',
      'e2719d58a985b3c9781ab030af78d30e',
    ];
    for (const keyHex of keys) {
      try {
        const key = Buffer.from(keyHex, 'hex');
        const iv = buf.slice(0, 16);
        const ciphertext = buf.slice(16);
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        const decrypted = decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
        console.log(`Key ${keyHex}: DECRYPTED! =>`, decrypted.substring(0, 200));
      } catch(e) {
        // ignore
      }
    }
  } catch(e) {
    console.log('Not hex encoded:', e.message);
  }
}

async function investigateP2P(hash) {
  console.log('\n=== pelisplus.strp2p.com ===');
  const videoApiUrl = `https://pelisplus.strp2p.com/api/v1/video?id=${hash}`;
  const res = await tryFetch(videoApiUrl, { headers: { 'Origin': 'https://pelisplus.strp2p.com', 'Referer': `https://pelisplus.strp2p.com/#${hash}` } });
  const text = await res.text();
  console.log('API Status:', res.status, 'Response:', text.substring(0, 100));
  
  // Also try info API
  const infoUrl = `https://pelisplus.strp2p.com/api/v1/info?id=${hash}`;
  const res2 = await tryFetch(infoUrl, { headers: { 'Origin': 'https://pelisplus.strp2p.com', 'Referer': `https://pelisplus.strp2p.com/#${hash}` } });
  const text2 = await res2.text();
  console.log('Info API Status:', res2.status, 'Response:', text2.substring(0, 100));
}

async function investigate4mePlayer(hash) {
  console.log('\n=== 4meplayer.pro ===');
  // First fetch the main page
  const mainUrl = `https://pelisplusto.4meplayer.pro/api/v1/video?id=${hash}`;
  const res = await tryFetch(mainUrl, { headers: { 'Origin': 'https://pelisplusto.4meplayer.pro', 'Referer': `https://pelisplusto.4meplayer.pro/#${hash}` } });
  const text = await res.text();
  console.log('API Status:', res.status, 'Response (first 200):', text.substring(0, 200));
}

async function run() {
  await investigateEmturbovid();
  await investigatePelisplusUpns('ikfbmp');
  await investigateP2P('tusozc');
  await investigate4mePlayer('18oqz');
}

run().catch(console.error);
