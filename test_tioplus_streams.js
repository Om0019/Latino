const fs = require('fs');

async function checkURL(url) {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  try {
    console.log("Fetching:", url);
    const res = await fetch(url, { headers: { 'User-Agent': userAgent, 'Referer': 'https://tioplus.app/' } });
    const html = await res.text();
    const isPacked = html.includes('eval(function(p,a,c,k,e,d)');
    const hasRedirect = html.match(/window\.location\.href\s*=\s*['"](.*?)['"]/);
    const hasIframe = html.match(/<iframe[^>]+src=['"]([^'"]+)['"]/);
    console.log("Status:", res.status);
    console.log("Packed:", isPacked);
    console.log("Redirect:", hasRedirect ? hasRedirect[1] : "None");
    console.log("Iframe:", hasIframe ? hasIframe[1] : "None");
    
    fs.writeFileSync('temp_debug.html', html.substring(0, 5000)); // write first 5000 chars for manual inspection if needed
  } catch (e) {
    console.error(e);
  }
}

async function run() {
  await checkURL('https://emturbovid.com/t/6a28e144785cb');
  console.log("---");
  await checkURL('https://pelisplus.upns.pro/#ikfbmp');
}
run();
