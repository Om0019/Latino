// Live test: fetch the API, try to decrypt it with all keys from the JS file
const crypto = require('crypto');
const fs = require('fs');

const keys = [
  '1077efecc0b24d02ace33c1e52e2fb4b',
  'e2719d58a985b3c9781ab030af78d30e',
];

async function tryDecrypt(hexOrBuf, label) {
  const buf = typeof hexOrBuf === 'string' ? Buffer.from(hexOrBuf.trim(), 'hex') : hexOrBuf;
  
  for (const keyHex of keys) {
    const key = Buffer.from(keyHex, 'hex');
    
    // Try AES-128-CBC with first 16 bytes as IV
    for (const ivLen of [0, 16]) {
      try {
        const iv = ivLen ? buf.slice(0, ivLen) : Buffer.alloc(16, 0);
        const ciphertext = ivLen ? buf.slice(ivLen) : buf;
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(true);
        const dec = decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
        if (dec.includes('http') || dec.includes('.m3u8') || dec.includes('.mp4') || dec.includes('{')) {
          console.log(`✓ ${label} | key=${keyHex} | iv_from_data=${!!ivLen}`);
          console.log('Decrypted:', dec.substring(0, 500));
          console.log('---');
          return dec;
        }
      } catch (e) {}
    }
  }
  console.log(`✗ ${label} - Could not decrypt`);
  return null;
}

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function run() {
  // upns
  const domains = [
    { host: 'pelisplus.upns.pro', hash: 'ikfbmp' },
    { host: 'pelisplus.strp2p.com', hash: 'tusozc' },
    { host: 'pelisplusto.4meplayer.pro', hash: '18oqz' },
  ];
  
  for (const { host, hash } of domains) {
    const url = `https://${host}/api/v1/video?id=${hash}`;
    console.log(`\nFetching ${url}`);
    try {
      const res = await fetch(url, {
        headers: { 
          'User-Agent': userAgent, 
          'Referer': `https://${host}/#${hash}`,
          'Origin': `https://${host}`,
        }
      });
      const text = await res.text();
      console.log(`Status: ${res.status}, body length: ${text.length}`);
      fs.writeFileSync(`${host.replace(/\./g, '_')}.hex`, text);
      await tryDecrypt(text, host);
    } catch(e) {
      console.error(e.message);
    }
  }
  
  // Also test emturbovid - we know the URL already
  console.log('\n=== emturbovid - found direct URL in data-hash ===');
  console.log('https://cdn3.turboviplay.com/data3/6a28e144785cb/6a28e144785cb.m3u8');
}

run().catch(console.error);
