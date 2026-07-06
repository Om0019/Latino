const fs = require('fs');
const js = fs.readFileSync('temp_js.js', 'utf-8');
const strings = js.match(/(["'])(?:(?=(\\?))\2.)*?\1/g);
if (strings) {
  const potentials = strings.map(s => s.slice(1, -1)).filter(s => s.length === 32 || s.length === 16);
  const unique = [...new Set(potentials)];
  console.log(unique);
}
