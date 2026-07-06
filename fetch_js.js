const fs = require('fs');

async function run() {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    const res = await fetch('https://pelisplus.upns.pro/assets/index-D1za30JL.js', { headers: { 'User-Agent': userAgent } });
    const js = await res.text();
    fs.writeFileSync('temp_js.js', js);
    console.log("Saved JS file. Size:", js.length);
  } catch (e) {
    console.error(e);
  }
}
run();
