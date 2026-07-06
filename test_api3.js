const fs = require('fs');
async function test(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(url, "=>", res.status);
    const text = await res.text();
    console.log(text.substring(0, 500));
  } catch(e) {}
}

async function run() {
  await test('https://pelisplus.upns.pro/api/v1/video?id=ikfbmp');
  await test('https://pelisplus.upns.pro/api/v1/info?id=ikfbmp');
}
run();
