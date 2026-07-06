const fs = require('fs');
async function run() {
  const url = 'https://pamelachangemission.com/e/iwh9zzst5ezc';
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
    const html = await res.text();
    fs.writeFileSync('voe2.html', html);
    console.log("Status code:", res.status);
    console.log("Written to voe2.html");
  } catch (e) {
    console.error(e);
  }
}
run();
