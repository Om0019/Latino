const html = require('fs').readFileSync('vidhide.html', 'utf8');
const packerRegex = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\}\s*\(\s*([\s\S]*?)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\s\S]*?)\.split\(['"]\|['"]\)/i;
const match = html.match(packerRegex);
console.log(match ? match[0].substring(match[0].length - 100) : 'No match');
