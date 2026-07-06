const cheerio = require('cheerio');
const unpacker = require('../unpacker');
const TOKEN_CONCURRENCY = 4;

function cleanText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function extractSlug(url) {
  const match = url.match(/\/(?:pelicula|serie)\/([^/?#]+)/);
  return match?.[1] || '';
}

function scoreCandidate(result, targetTitle, originalTargetTitle, year) {
  const cleanTargetTitle = cleanText(targetTitle);
  const cleanOriginalTitle = cleanText(originalTargetTitle);
  const cleanResultTitle = cleanText(result.title);
  const cleanSlug = cleanText(extractSlug(result.url).replace(/-/g, ' '));
  let score = 0;

  if (cleanTargetTitle && (cleanResultTitle.includes(cleanTargetTitle) || cleanTargetTitle.includes(cleanResultTitle))) {
    score += 3;
  }
  if (cleanOriginalTitle && (cleanResultTitle.includes(cleanOriginalTitle) || cleanOriginalTitle.includes(cleanResultTitle))) {
    score += 2;
  }
  if (cleanSlug && (cleanSlug === cleanTargetTitle || cleanSlug === cleanOriginalTitle)) {
    score += 4;
  }
  if (cleanSlug && (cleanTargetTitle.includes(cleanSlug) || cleanOriginalTitle.includes(cleanSlug))) {
    score += 1;
  }

  if (year) {
    const yearStr = year.toString();
    if (result.title.includes(yearStr) || cleanResultTitle.includes(yearStr) || cleanSlug.includes(yearStr)) {
      score += 2;
    }
  }

  return score;
}

function slugifyTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\by\b/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildFallbackUrls(type, title, originalTitle) {
  const basePath = type === 'series' ? 'serie' : 'pelicula';
  const candidates = [];
  const seen = new Set();

  for (const value of [title, originalTitle]) {
    const slug = slugifyTitle(value);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    candidates.push({
      url: `https://tioplus.app/${basePath}/${slug}`,
      title: value || slug
    });
  }

  return candidates;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = [];
  let index = 0;

  async function runNext() {
    while (index < items.length) {
      const currentIndex = index++;
      const result = await worker(items[currentIndex], currentIndex);
      if (result) {
        results.push(result);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runNext())
  );

  return results;
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
async function scrape(title, originalTitle, year, type, season, episode) {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async function performSearch(searchQuery) {
    const searchUrl = `https://tioplus.app/api/search/${encodeURIComponent(searchQuery)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent': userAgent,
        'x-requested-with': 'XMLHttpRequest'
      }
    });
    console.log(`TioPlus search HTTP status for ${searchQuery}:`, res.status);
    if (!res.ok) return [];

    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];

    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      const isMovieLink = href.includes('/pelicula/');
      const isSeriesLink = href.includes('/serie/');

      if (href && (isMovieLink || isSeriesLink)) {
        if ((type === 'movie' && isMovieLink) || (type === 'series' && isSeriesLink)) {
          results.push({ url: href, title: text });
        }
      }
    });
    console.log(`TioPlus performSearch("${searchQuery}") found:`, results);

    let bestMatch = null;
    let bestScore = 0;

    for (const r of results) {
      const score = scoreCandidate(r, title, originalTitle, year);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = r;
      }
    }

    return bestMatch;
  }

  try {
    let bestMatch = await performSearch(title);

    if (!bestMatch && originalTitle && cleanText(originalTitle) !== cleanText(title)) {
      console.log(`TioPlus: No match for "${title}", trying originalTitle "${originalTitle}"`);
      bestMatch = await performSearch(originalTitle);
    }

    if (!bestMatch) {
      for (const candidate of buildFallbackUrls(type, title, originalTitle)) {
        try {
          const probeRes = await fetch(candidate.url, {
            headers: { 'User-Agent': userAgent }
          });
          if (probeRes.ok) {
            console.log(`TioPlus: Using direct URL fallback ${candidate.url}`);
            bestMatch = candidate;
            break;
          }
        } catch (err) {
          console.warn(`TioPlus: Fallback probe failed for ${candidate.url}:`, err.message);
        }
      }
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

    // 3. For each token, resolve player redirect
    const streams = await mapWithConcurrency(serverTokens, TOKEN_CONCURRENCY, async (sInfo) => {
      try {
        const ol = b64_to_utf8(sInfo.token);
        if (!ol) return null;

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
          if (!playerRes.ok) return null;

          const playerHtml = await playerRes.text();

          // Extract redirect URL using Regex
          const redirectMatch = playerHtml.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/);
          if (redirectMatch && redirectMatch[1]) {
            directStreamUrl = redirectMatch[1];
          }
        }

        if (!directStreamUrl) return null;
          
        let resolvedDirectUrl = null;
        try {
          resolvedDirectUrl = await unpacker.resolvePlayerStream(directStreamUrl, userAgent, 'https://tioplus.app/');
        } catch (e) {
          console.error(`TioPlus: Error resolving hosting redirect for ${sInfo.name}:`, e.message);
        }

        if (resolvedDirectUrl) {
          return {
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
        }
      } catch (err) {
        console.error(`TioPlus: Error resolving player token for ${sInfo.name}:`, err.message);
      }
      return null;
    });

    return streams;
  } catch (error) {
    console.error(`TioPlus scrape error for "${title}":`, error.message);
    return [];
  }
}

module.exports = { scrape };
