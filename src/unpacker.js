/**
 * Dean Edwards Unpacker Utility
 */

function unpack(p, a, c, k, e, d) {
  const e_func = function(c) {
    return (c < a ? '' : e_func(Math.floor(c / a))) + 
      ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
  };
  while (c--) {
    if (k[c]) {
      p = p.replace(new RegExp('\\b' + e_func(c) + '\\b', 'g'), k[c]);
    }
  }
  return p;
}

/**
 * Parses HTML, finds any packed scripts, unpacks them, and looks for .m3u8/.mp4 stream URLs.
 * Also scans the HTML directly for any un-packed stream URLs as a fallback.
 */
function extractDirectStream(html) {
  if (!html) return null;

  // 1. Check for un-packed HLS/MP4 links directly first (e.g. goodstream, emturbovid)
  const directRegex = /(https?:[^\s'"`<>]+?\.m3u8[^\s'"`<>]*|https?:[^\s'"`<>]+?\.mp4[^\s'"`<>]*)/gi;
  const directMatches = html.match(directRegex) || [];
  
  // Filter out non-video assets or ad servers
  const validDirect = directMatches.filter(link => {
    const l = link.toLowerCase();
    return !l.includes('google-analytics') && !l.includes('analytics.js') && !l.includes('tagmanager');
  });

  if (validDirect.length > 0) {
    return [...new Set(validDirect)][0];
  }

  // 2. Scan and unpack packed scripts (e.g. vidhide, hlswish, vimeos)
  const packerRegex = /eval\s*\(\s*function\s*\(\s*p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)[\s\S]*?\}\s*\(\s*(['"])([\s\S]*?)\1\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\5\.split\(['"]\|['"]\)/gi;
  
  let match;
  while ((match = packerRegex.exec(html)) !== null) {
    try {
      let p = match[2].trim();
      const a = parseInt(match[3]);
      const c = parseInt(match[4]);
      let kStr = match[6].trim();
      const k = kStr.split('|');
      
      const unpacked = unpack(p, a, c, k, {}, {});
      const streamMatches = unpacked.match(directRegex) || [];
      const validStreams = streamMatches.filter(link => {
        const l = link.toLowerCase();
        return !l.includes('analytics') && !l.includes('ads');
      });

      if (validStreams.length > 0) {
        return [...new Set(validStreams)][0];
      }
    } catch (err) {
      console.error('Unpacker: Failed to decode script block:', err.message);
    }
  }

  return null;
}

module.exports = { extractDirectStream, unpack };

const crypto = require('crypto');

function decryptEmbed69(html) {
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
  let dataLink = [];
  try {
      dataLink = JSON.parse(dataLinkMatch[1]);
  } catch(e) {
      return null;
  }
  
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
              if (embed.link && embed.type === 'video') {
                  try {
                      const raw = Buffer.from(embed.link, 'base64');
                      const iv = raw.slice(0, 16);
                      const ciphertext = raw.slice(16);
                      const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
                      decipher.setAutoPadding(false);
                      let decrypted = decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
                      const pad = decrypted.charCodeAt(decrypted.length - 1);
                      decrypted = decrypted.slice(0, -pad);
                      decryptedLinks.push({ server: embed.servername, url: decrypted });
                  } catch (e) {
                      // ignore
                  }
              }
          }
      }
  }
  return decryptedLinks;
}

module.exports.decryptEmbed69 = decryptEmbed69;

/**
 * Advanced recursive player resolver.
 * Handles known external players (like embed69, vidhide, etc) to extract the final direct .m3u8/.mp4
 */
async function resolvePlayerStream(url, userAgent, referer) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': userAgent, 'Referer': referer }
        });
        if (!res.ok) return null;
        
        const html = await res.text();
        
        // Check if it's embed69
        if (url.includes('embed69')) {
            const embed69Links = decryptEmbed69(html);
            if (embed69Links && embed69Links.length > 0) {
                // Try resolving the first valid video embed (e.g. vidhide)
                for (const embed of embed69Links) {
                    if (embed.server === 'vidhide' || embed.server === 'streamwish' || embed.server === 'voe') {
                        const directUrl = await resolvePlayerStream(embed.url, userAgent, url);
                        if (directUrl) return directUrl;
                    }
                }
            }
        }
        
        // Standard dean-edwards / direct extraction
        const directUrl = extractDirectStream(html);
        if (directUrl) return directUrl;

        return null;
    } catch (e) {
        console.error("resolvePlayerStream error for", url, e.message);
        return null;
    }
}

module.exports.resolvePlayerStream = resolvePlayerStream;
