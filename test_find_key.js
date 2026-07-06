// Search the bundled JS for the decryption function
const fs = require('fs');
const js = fs.readFileSync('temp_js.js', 'utf-8');

// Look for atob, fromCharCode, key derivation patterns
const patterns = [
  /(?:key|KEY|secret|SECRET)\s*[=:]\s*["']([^"']{16,64})["']/g,
  /createDecipheriv\([^)]+\)/g,
  /CryptoJS\.AES\.decrypt[^;]+/g,
  /atob\([^)]+\)/g,
  /fromCharCode[^;]{0,100}/g,
  /hex(?:To|From|2)[^(]+\([^)]+\)/gi,
];

for (const p of patterns) {
  const matches = js.match(p);
  if (matches) {
    console.log(`Pattern: ${p.source}`);
    matches.slice(0, 5).forEach(m => console.log('  ', m.substring(0, 150)));
    console.log();
  }
}
