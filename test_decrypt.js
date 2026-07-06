const crypto = require('crypto');

// Known keys from the bundled JS
const possibleKeys = [
  '1077efecc0b24d02ace33c1e52e2fb4b',
  'e2719d58a985b3c9781ab030af78d30e',
];

const hexData = '2111909af92f6d87788ccd4582c12affbcb2264725c88ad5d625bdf0e5a7ccdfef25407df136ddd71e245306e37a175e626203df44b4bfebf0b2cc2fc8ebe93bac18b1985a97e4af2dc6a5c2ffda16d2d6b1adee93c0e3e4e91c1deae5f2dde5d17e2bcb83c23d18e9c5b15c5fa978c2f33af4aabf1bd5c7ba8e8e1f5b1e7f8c45d5c5c6e8f7d3f8c5b59d3f4a47d7f6b3f5b6c5a2f3b6e8c5a3f3c6e8f3a4f3b6e8c5b6d6b6d5a2f8b6d5b6e8c5a3f3c6e8f3a4f3b6e8c5b6d6b6d5a2f8b6d5b6e8c5a3f3c6e8f3a4f3b6e8c5b6d6b6d5a2f8b6d5b6e8c5a3f3c6e8f3a4f3b6e8c5b6d6b6d5a2f8b6d5b6e8c5a3f3c6e8f3a4f3b6e8c5b6d6b6d5';

try {
  const buf = Buffer.from(hexData, 'hex');
  console.log('Buffer length:', buf.length);
  
  for (const keyHex of possibleKeys) {
    for (const algo of ['aes-128-cbc', 'aes-256-cbc', 'aes-128-ecb']) {
      try {
        const key = Buffer.from(keyHex, 'hex');
        let decrypted;
        if (algo === 'aes-128-ecb') {
          const decipher = crypto.createDecipheriv(algo, key, null);
          decrypted = decipher.update(buf, undefined, 'utf8') + decipher.final('utf8');
        } else {
          const iv = buf.slice(0, 16);
          const ciphertext = buf.slice(16);
          const decipher = crypto.createDecipheriv(algo, key, iv);
          decipher.setAutoPadding(true);
          decrypted = decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
        }
        console.log(`✓ Key: ${keyHex} | Algo: ${algo}`);
        console.log('Decrypted:', decrypted.substring(0, 300));
        console.log('---');
      } catch (e) {
        // mismatch
      }
    }
  }
} catch(e) {
  console.error(e);
}
