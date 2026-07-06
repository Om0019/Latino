// The pelisplus players use their own encryption
// Let's look at the actual HTML they serve for a hash
const fs = require('fs');
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchPlayerPage(host, hash) {
  // First get the main SPA index
  const mainUrl = `https://${host}/`;
  const res = await fetch(mainUrl, { headers: { 'User-Agent': userAgent } });
  const html = await res.text();
  
  // Get the JS bundle name
  const jsBundleMatch = html.match(/src="(\/assets\/index[^"]+\.js)"/);
  if (!jsBundleMatch) {
    console.log(`No JS bundle found in ${host}`);
    console.log(html.substring(0, 500));
    return;
  }
  
  const jsBundleUrl = `https://${host}${jsBundleMatch[1]}`;
  console.log(`JS bundle URL: ${jsBundleUrl}`);
  
  const jsRes = await fetch(jsBundleUrl, { headers: { 'User-Agent': userAgent, 'Referer': mainUrl } });
  const js = await jsRes.text();
  
  // Look for decrypt function, fetch calls, API paths
  const apiPatterns = js.match(/"\/api\/v1\/[^"]+"/g);
  console.log('API patterns:', apiPatterns ? [...new Set(apiPatterns)] : 'none');
  
  // Look for any encryption/decryption logic specific to this player
  const encryptIdx = js.indexOf('decrypt');
  if (encryptIdx > -1) {
    console.log('Decrypt context:', js.substring(encryptIdx - 200, encryptIdx + 300));
  }
  
  // Look for fetch of video id
  const fetchPatterns = js.match(/fetch\([^)]{5,100}\)/g);
  if (fetchPatterns) {
    console.log('Fetch calls:', fetchPatterns.slice(0, 5));
  }
}

async function run() {
  await fetchPlayerPage('pelisplus.upns.pro', 'ikfbmp');
}
run().catch(console.error);
