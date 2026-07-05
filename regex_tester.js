const html = require('fs').readFileSync('vidhide.html', 'utf8');
const idx = html.indexOf('eval(function(p,a,c,k,e,d)');
const splitIdx = html.indexOf('.split(\'|\')', idx);
const wrapperIdx = html.lastIndexOf('}(', splitIdx);
console.log(html.substring(wrapperIdx, splitIdx + 11));
