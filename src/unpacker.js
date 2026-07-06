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
    return !l.includes('google-analytics')
      && !l.includes('analytics.js')
      && !l.includes('tagmanager')
      && !l.includes('test-videos.co.uk')
      && !l.includes('big_buck_bunny');
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
        return !l.includes('analytics')
          && !l.includes('ads')
          && !l.includes('test-videos.co.uk')
          && !l.includes('big_buck_bunny');
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

/**
 * Pelisplus AES decryptor.
 * Servers like pelisplus.upns.pro, pelisplusto.4meplayer.pro, pelisplus.strp2p.com
 * all encrypt their /api/v1/video?id=<hash> API responses with a static AES-128-CBC key.
 * The key is derived from the S() function in their JS bundle (always uses firstChar='t').
 * The IV is derived from the _() function (always the same on HTTPS).
 */
function _buildPelisplusKeyAndIV() {
  function m(...args) { return String.fromCharCode(...args); }
  function p(str, n) { return str.charCodeAt(n) || 0; }
  
  // S() with firstChar='t' (static)
  const v = '#t';
  const P = '10'; const O = 110; const G = 1;
  let N = '';
  const B = '\u1d5f'.charCodeAt(0).toString().split(''); // '7519'
  for (let ye = 0; ye < B.length; ye++) N += m(parseInt(P + B[ye]));
  N += m(p(v, 1));
  N += N.substring(1, 3);
  N += m(O, O - 1, O + 7);
  const oe = '3579'.split('');
  N += m(oe[3] + oe[2], oe[1] + oe[2]);
  const val1 = oe[0] * G + G + oe[3];
  N += m(val1, val1);
  const val2 = oe[3] * P + oe[3] * G;
  oe.reverse();
  const val3 = parseInt(oe.join('').substring(0, 2));
  N += m(val2, val3);
  const key = Buffer.from(N, 'utf8').slice(0, 16);
  
  // _() — always the same on https://
  let B2 = '';
  for (let Ie = 1; Ie < 10; Ie++) B2 += m(Ie + 48);
  B2 += m(48, 111, 0, 117, 121, 116, 114);
  const iv = Buffer.from(B2, 'utf8').slice(0, 16);
  
  return { key, iv };
}

const { key: PELISPLUS_KEY, iv: PELISPLUS_IV } = _buildPelisplusKeyAndIV();

/**
 * Resolves a pelisplus embed URL (upns.pro, 4meplayer.pro, strp2p.com) to a direct m3u8.
 */
async function resolvePelisplus(embedUrl, userAgent, referer) {
  try {
    const urlObj = new URL(embedUrl);
    const hash = urlObj.hash.replace('#', '');
    const host = urlObj.hostname;
    if (!hash) return null;
    
    const apiUrl = `https://${host}/api/v1/video?id=${hash}`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': userAgent, 'Referer': referer || embedUrl, 'Origin': `https://${host}` }
    });
    if (!res.ok) return null;
    
    const hexData = await res.text();
    const buf = Buffer.from(hexData.trim(), 'hex');
    
    const decipher = crypto.createDecipheriv('aes-128-cbc', PELISPLUS_KEY, PELISPLUS_IV);
    decipher.setAutoPadding(true);
    const decrypted = decipher.update(buf, undefined, 'utf8') + decipher.final('utf8');
    
    // Strip all control/non-printable characters that get embedded in the JSON
    const cleaned = decrypted.replace(/[^\x20-\x7E\x0A\x0D]/g, '');
    let data = null;
    try { data = JSON.parse(cleaned); } catch { /* try regex fallback below */ }
    
    // Regex fallback: extract source URL directly from the (possibly corrupted) JSON string
    let src = data && data.source ? data.source : null;
    if (!src) {
      const sourceMatch = cleaned.match(/"source"\s*:\s*"([^"]+)"/);
      if (sourceMatch) src = sourceMatch[1];
    }
    
    if (src) {
      src = src.split('\\/').join('/');
      if (src.startsWith('ttps://')) src = 'h' + src;
      if (!src.startsWith('http')) return null;
      console.log(`Unpacker: Pelisplus resolved ${host} => ${src.substring(0, 80)}...`);
      return src;
    }
    return null;
  } catch (e) {
    console.error('resolvePelisplus error:', e.message);
    return null;
  }
}

module.exports.resolvePelisplus = resolvePelisplus;



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
                      decryptedLinks.push({ server: embed.servername, url: decrypted, kind: 'video' });
                  } catch (e) {
                      // ignore
                  }
              }
          }
      }

      if (file.downloadEmbeds) {
          for (const embed of file.downloadEmbeds) {
              if (embed.link) {
                  try {
                      const raw = Buffer.from(embed.link, 'base64');
                      const iv = raw.slice(0, 16);
                      const ciphertext = raw.slice(16);
                      const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
                      decipher.setAutoPadding(false);
                      let decrypted = decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
                      const pad = decrypted.charCodeAt(decrypted.length - 1);
                      decrypted = decrypted.slice(0, -pad);
                      decryptedLinks.push({ server: embed.servername, url: decrypted, kind: 'download' });
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
 * Handles known external players (like embed69, vidhide, pelisplus, emturbovid etc)
 * to extract the final direct .m3u8/.mp4
 */
async function resolvePlayerStream(url, userAgent, referer) {
    try {
        // Netu/Waaw "f" pages usually wrap the actual embed page.
        if (url.includes('waaw.to/f/')) {
            const waawUrl = new URL(url);
            const match = waawUrl.pathname.match(/\/f\/([^/?#]+)/);
            if (match && match[1]) {
                const embedUrl = `https://waaw.to/e/${match[1]}?http_referer=${encodeURIComponent(referer || 'https://tioplus.app/')}`;
                return await resolvePlayerStream(embedUrl, userAgent, referer);
            }
        }

        // Pelisplus SPA players (upns, 4meplayer, strp2p)
        if (url.includes('pelisplus.upns.pro') || url.includes('4meplayer.pro') || url.includes('strp2p.com')) {
            const m3u8 = await resolvePelisplus(url, userAgent, referer);
            if (m3u8) return m3u8;
        }

        const res = await fetch(url, {
            headers: { 'User-Agent': userAgent, 'Referer': referer }
        });
        if (!res.ok) return null;
        
        const html = await res.text();
        
        // emturbovid / turbovidhls: extract m3u8 from data-hash attribute or urlPlay variable
        if (url.includes('emturbovid') || url.includes('turbovidhls') || url.includes('turboviplay')) {
            const dataHash = html.match(/data-hash=["']([^"']+\.m3u8[^"']*)/);
            if (dataHash) return dataHash[1];
            const urlPlay = html.match(/var\s+urlPlay\s*=\s*["']([^"']+\.m3u8[^"']*)/);
            if (urlPlay) return urlPlay[1];
        }

        // Check if it's embed69
        if (url.includes('embed69')) {
            const embed69Links = decryptEmbed69(html);
            if (embed69Links && embed69Links.length > 0) {
                // Try resolving the first valid video embed (e.g. vidhide)
                const rankedEmbeds = embed69Links.sort((a, b) => {
                    const kindScore = (value) => value.kind === 'download' ? 0 : 1;
                    const serverScore = (value) => {
                        if (value.server === 'vidhide' || value.server === 'streamwish') return 0;
                        if (value.server === 'filemoon' || value.server === 'rapidvideo') return 1;
                        if (value.server === 'voe') return 3;
                        return 2;
                    };
                    return kindScore(a) - kindScore(b) || serverScore(a) - serverScore(b);
                });

                for (const embed of rankedEmbeds) {
                    if (embed.server === 'vidhide' || embed.server === 'streamwish' || embed.server === 'voe' || embed.server === 'filemoon' || embed.server === 'rapidvideo') {
                        const directUrl = await resolvePlayerStream(embed.url, userAgent, url);
                        if (directUrl) return directUrl;
                    }
                }
            }
        }
        
        // Check for JS redirect (e.g. VOE initial page)
        const jsRedirectMatch = html.match(/window\.location\.href\s*=\s*['"](https?:\/\/[^'"]+)['"]/);
        if (jsRedirectMatch && jsRedirectMatch[1] !== url) {
            console.log(`Unpacker: Following JS redirect to ${jsRedirectMatch[1]}`);
            return await resolvePlayerStream(jsRedirectMatch[1], userAgent, referer);
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
