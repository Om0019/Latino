const crypto = require('crypto');

async function decryptEmbed69(html) {
    const powChallengeMatch = html.match(/const POW_CHALLENGE = '([^']+)';/);
    const powDifficultyMatch = html.match(/const POW_DIFFICULTY = (\d+);/);
    const powSaltMatch = html.match(/const POW_SALT = '([^']+)';/);
    const dataLinkMatch = html.match(/let dataLink = (\[.*?\]);/);
    
    if (!powChallengeMatch || !powDifficultyMatch || !powSaltMatch || !dataLinkMatch) {
        return null;
    }
    
    const challenge = powChallengeMatch[1];
    const difficulty = parseInt(powDifficultyMatch[1]);
    const salt = powSaltMatch[1];
    let dataLink = JSON.parse(dataLinkMatch[1]);
    
    const prefix = '0'.repeat(difficulty);
    let nonce = 0;
    
    let aesKey = null;
    while (true) {
        const hash = crypto.createHash('sha256').update(challenge + nonce).digest('hex');
        if (hash.startsWith(prefix)) {
            aesKey = crypto.createHash('sha256').update(challenge + nonce + salt).digest();
            break;
        }
        nonce++;
    }
    
    const decryptedLinks = [];
    
    for (const file of dataLink) {
        if (file.sortedEmbeds) {
            for (const embed of file.sortedEmbeds) {
                if (embed.link) {
                    try {
                        const raw = Buffer.from(embed.link, 'base64');
                        const iv = raw.slice(0, 16);
                        const ciphertext = raw.slice(16);
                        const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
                        decipher.setAutoPadding(false); // They use subtle crypto which might use pkcs7
                        let decrypted = decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
                        // Remove PKCS7 padding
                        const pad = decrypted.charCodeAt(decrypted.length - 1);
                        decrypted = decrypted.slice(0, -pad);
                        decryptedLinks.push({ server: embed.servername, url: decrypted });
                    } catch (e) {
                        console.error("Embed69 decrypt error:", e.message);
                    }
                }
            }
        }
    }
    return decryptedLinks;
}

async function test() {
    const html = require('fs').readFileSync('embed69.html', 'utf8');
    const links = await decryptEmbed69(html);
    console.log(links);
}
test();
