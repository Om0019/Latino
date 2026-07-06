const fs = require('fs');
const js = fs.readFileSync('temp_js.js', 'utf-8');
const urls = js.match(/https?:\/\/[a-zA-Z0-9./_-]+/g);
if (urls) {
  const uniqueUrls = [...new Set(urls)].filter(u => !u.includes('w3.org') && !u.includes('googletag') && !u.includes('react'));
  console.log(uniqueUrls);
}
