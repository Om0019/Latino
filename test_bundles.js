// Let's fetch the JS bundle from each host and compare the S() and _() functions
const fs = require('fs');
const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36';

async function getJSHash(host) {
  const res = await fetch(`https://${host}/`, { headers: { 'User-Agent': ua }});
  const html = await res.text();
  const m = html.match(/src="(\/assets\/index[^"]+\.js)"/);
  if (!m) { console.log(`${host}: no bundle`); return; }
  console.log(`${host}: bundle = ${m[1]}`);
  
  const jsRes = await fetch(`https://${host}${m[1]}`, { headers: { 'User-Agent': ua }});
  const js = await jsRes.text();
  
  // Find S() function - look for the magic 'ᵟ' char
  const magicIdx = js.indexOf('ᵟ');
  if (magicIdx > -1) {
    console.log(`  S() context: ...${js.substring(magicIdx-100, magicIdx+200)}...`);
  } else {
    // might be unicode escaped
    const unicodeIdx = js.indexOf('\\u1d5f');
    if (unicodeIdx > -1) {
      console.log(`  S() (unicode escaped): ...${js.substring(unicodeIdx-100, unicodeIdx+200)}...`);
    } else {
      console.log(`  Could not find magic char. Bundle size: ${js.length}`);
    }
  }
}

async function run() {
  await getJSHash('pelisplus.upns.pro');
  await getJSHash('pelisplusto.4meplayer.pro');
}
run().catch(console.error);
