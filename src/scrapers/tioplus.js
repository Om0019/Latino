const cheerio = require('cheerio');
const unpacker = require('../unpacker');

function cleanText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Decodes base64 string to UTF-8.
 */
function b64_to_utf8(str) {
  try {
    return Buffer.from(str, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

/**
 * Encodes string to base64.
 */
function utf8_to_b64(str) {
  return Buffer.from(str, 'utf8').toString('base64');
}

/**
 * TioPlus Scraper
 */
async function scrape(title, year, type, season, episode) {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const searchUrl = `https://tioplus.app/api/search/${encodeURIComponent(title)}`;

  try {
    // 1. Search for the content via API
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': userAgent,
        'x-requested-with': 'XMLHttpRequest'
      }
    });
    if (!res.ok) {
      console.warn(`TioPlus search returned status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];

    // Extract links matching /pelicula/ or /serie/
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim().replace(/\s+/g, ' ');

      const isMovieLink = href.includes('/pelicula/');
      const isSeriesLink = href.includes('/serie/');

      if (href && (isMovieLink || isSeriesLink)) {
        if ((type === 'movie' && isMovieLink) || (type === 'series' && isSeriesLink)) {
          results.push({
            url: href,
            title: text
          });
        }
      }
    });

    // Find the best match
    const cleanTargetTitle = cleanText(title);
    let bestMatch = null;

    for (const r of results) {
      const cleanResultTitle = cleanText(r.title);
      if (cleanResultTitle.includes(cleanTargetTitle) || cleanTargetTitle.includes(cleanResultTitle)) {
        if (year) {
          const hasYear = r.title.includes(year.toString()) || cleanResultTitle.includes(year.toString());
          if (hasYear) {
            bestMatch = r;
            break;
          }
        }
        bestMatch = r;
      }
    }

    if (!bestMatch && results.length > 0) {
      bestMatch = results[0];
    }

    if (!bestMatch) {
      console.log(`TioPlus: No matching content found for "${title}"`);
      return [];
    }

    // Determine target page URL (movie page vs episode page)
    let targetPageUrl = bestMatch.url;
    if (type === 'series') {
      // Structure: https://tioplus.app/serie/slug/season/X/episode/Y
      const baseUrlClean = bestMatch.url.replace(/\/$/, '');
      targetPageUrl = `${baseUrlClean}/season/${season}/episode/${episode}`;
    }

    console.log(`TioPlus: Matched content URL: ${targetPageUrl}`);

    // 2. Fetch target page to extract player server tokens
    const pageRes = await fetch(targetPageUrl, {
      headers: { 'User-Agent': userAgent }
    });
    if (!pageRes.ok) {
      console.warn(`TioPlus: Failed to fetch target page: ${targetPageUrl} (${pageRes.status})`);
      return [];
    }

    const pageHtml = await pageRes.text();
    const pageDoc = cheerio.load(pageHtml);

    // Collect all data-server and data-tr tokens
    const serverTokens = [];
    
    // Check main player div data-tr
    const mainTr = pageDoc('#player-tr').attr('data-tr');
    if (mainTr) {
      serverTokens.push({
        name: 'Opción 1',
        token: mainTr
      });
    }

    // Check list item options
    pageDoc('li[data-server]').each((i, el) => {
      const token = pageDoc(el).attr('data-server');
      const name = pageDoc(el).text().trim() || `Opción ${i + 2}`;
      if (token && !serverTokens.some(t => t.token === token)) {
        serverTokens.push({ name, token });
      }
    });

    console.log(`TioPlus: Found ${serverTokens.length} server tokens`);

    const streams = [];

    // 3. For each token, resolve player redirect
    for (const sInfo of serverTokens) {
      try {
        const ol = b64_to_utf8(sInfo.token);
        if (!ol) continue;

        // Shortcut: if the decoded token is a pelisplus or emturbovid URL,
        // resolve it directly without going through the obfuscated tioplus player page
        const isPelisplus = ol.includes('pelisplus.upns.pro') || ol.includes('4meplayer.pro') || ol.includes('strp2p.com');
        const isEmturbovid = ol.includes('emturbovid') || ol.includes('turbovidhls') || ol.includes('turboviplay');

        let directStreamUrl = null;

        if (isPelisplus || isEmturbovid) {
          directStreamUrl = ol; // resolve directly below
        } else {
          // Double base64 encode for the tioplus player page
          const innerPath = utf8_to_b64(utf8_to_b64(ol));
          const playerUrl = `https://tioplus.app/player/${innerPath}`;

          // Fetch player page
          const playerRes = await fetch(playerUrl, {
            headers: {
              'User-Agent': userAgent,
              'Referer': 'https://tioplus.app/'
            }
          });
          if (!playerRes.ok) continue;

          const playerHtml = await playerRes.text();

          // Extract redirect URL using Regex
          const redirectMatch = playerHtml.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
          if (redirectMatch && redirectMatch[1]) {
            directStreamUrl = redirectMatch[1];
          }
        }

        if (!directStreamUrl) continue;
          
        let resolvedDirectUrl = null;
        try {
          resolvedDirectUrl = await unpacker.resolvePlayerStream(directStreamUrl, userAgent, 'https://tioplus.app/');
        } catch (e) {
          console.error(`TioPlus: Error resolving hosting redirect for ${sInfo.name}:`, e.message);
        }

        if (resolvedDirectUrl) {
          const streamObj = {
            name: `TioPlus`,
            title: `🇲🇽 ${sInfo.name}`,
            url: resolvedDirectUrl,
            behaviorHints: {
              notWebReady: true,
              proxyHeaders: {
                request: {
                  "User-Agent": userAgent,
                  "Referer": directStreamUrl || "https://tioplus.app/"
                }
              }
            }
          };
          streams.push(streamObj);
        }
      } catch (err) {
        console.error(`TioPlus: Error resolving player token for ${sInfo.name}:`, err.message);
      }
    }

    return streams;
  } catch (error) {
    console.error(`TioPlus scrape error for "${title}":`, error.message);
    return [];
  }
}

module.exports = { scrape };
