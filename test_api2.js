const fs = require('fs');
const js = fs.readFileSync('temp_js.js', 'utf-8');
const endpoints = js.match(/"\/api\/[^"]+"/g);
if (endpoints) {
  const unique = [...new Set(endpoints)];
  console.log(unique);
}
