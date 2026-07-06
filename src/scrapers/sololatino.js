const cheerio = require('cheerio');
const unpacker = require('../unpacker');
const TOKEN_CONCURRENCY = 3;

function cleanText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function slugifyTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' y ')
    .replace(/\band\b/g, 'y')
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
      url: `https://sololatino.net/${basePath}/${slug}`,
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
 * SoloLatino Scraper
 */
async function scrape(title, originalTitle, year, type, season, episode) {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  async function performSearch(searchQuery) {
    const searchUrl = `https://sololatino.net/buscar?q=${encodeURIComponent(searchQuery)}`;
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': userAgent }
    });
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

    const uniqueResults = [];
    const seenUrls = new Set();
    for (const r of results) {
      if (r.url.includes('/serie/') && !/\/serie\/[^/]+\/?$/.test(r.url)) {
        continue;
      }

      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        uniqueResults.push(r);
      }
    }

    const cleanTargetTitle = cleanText(title);
    const cleanOriginalTitle = cleanText(originalTitle);
    let bestMatch = null;

    for (const r of uniqueResults) {
      const cleanResultTitle = cleanText(r.title);
      const matchesTitle = cleanTargetTitle && (cleanResultTitle.includes(cleanTargetTitle) || cleanTargetTitle.includes(cleanResultTitle));
      const matchesOriginal = cleanOriginalTitle && (cleanResultTitle.includes(cleanOriginalTitle) || cleanOriginalTitle.includes(cleanResultTitle));
      
      if (matchesTitle || matchesOriginal) {
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

    if (!bestMatch && uniqueResults.length > 0) {
      bestMatch = uniqueResults[0];
    }

    return bestMatch;
  }

  try {
    let bestMatch = await performSearch(title);

    if (!bestMatch && originalTitle && cleanText(originalTitle) !== cleanText(title)) {
      console.log(`SoloLatino: No match for "${title}", trying originalTitle "${originalTitle}"`);
      bestMatch = await performSearch(originalTitle);
    }

    if (!bestMatch) {
      for (const candidate of buildFallbackUrls(type, title, originalTitle)) {
        try {
          const probeRes = await fetch(candidate.url, {
            headers: { 'User-Agent': userAgent }
          });
          if (probeRes.ok) {
            console.log(`SoloLatino: Using direct URL fallback ${candidate.url}`);
            bestMatch = candidate;
            break;
          }
        } catch (err) {
          console.warn(`SoloLatino: Fallback probe failed for ${candidate.url}:`, err.message);
        }
      }
    }

    if (!bestMatch) {
      console.log(`SoloLatino: No matching content found for "${title}"`);
      return [];
    }

    // Determine target page URL based on movie vs TV series episode
    let targetPageUrl = bestMatch.url;
    if (type === 'series') {
      // Structure: https://sololatino.net/serie/slug/temporada-X/episodio-Y
      // Ensure there are no trailing slashes in bestMatch.url
      const baseUrlClean = bestMatch.url.replace(/\/$/, '');
      targetPageUrl = `${baseUrlClean}/temporada-${season}/episodio-${episode}`;
    }

    console.log(`SoloLatino: Matched content URL: ${targetPageUrl}`);

    // 2. Fetch Laravel Sanctum CSRF cookie to establish session cookies
    const csrfRes = await fetch('https://sololatino.net/sanctum/csrf-cookie', {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json'
      }
    });
    if (!csrfRes.ok) {
      console.warn(`SoloLatino: Sanctum handshake failed with status ${csrfRes.status}`);
      return [];
    }

    const setCookies = csrfRes.headers.getSetCookie();
    let xsrfCookieVal = '';
    let sessionCookieVal = '';
    for (const cookie of setCookies) {
      if (cookie.startsWith('XSRF-TOKEN=')) {
        xsrfCookieVal = cookie.split(';')[0].substring('XSRF-TOKEN='.length);
      } else if (cookie.startsWith('sololatinonet-session=')) {
        sessionCookieVal = cookie.split(';')[0].substring('sololatinonet-session='.length);
      }
    }

    if (!xsrfCookieVal) {
      console.warn('SoloLatino: Sanctum response did not return XSRF-TOKEN cookie.');
      return [];
    }

    const decodedXSRF = decodeURIComponent(xsrfCookieVal);
    const cookieString = `XSRF-TOKEN=${xsrfCookieVal}; sololatinonet-session=${sessionCookieVal}`;

    // 3. Fetch the actual content page (movie or episode details page) to get the CSRF token and player tokens
    const pageRes = await fetch(targetPageUrl, {
      headers: {
        'User-Agent': userAgent
      }
    });
    if (!pageRes.ok) {
      console.warn(`SoloLatino: Failed to fetch target page: ${targetPageUrl} (${pageRes.status})`);
      return [];
    }

    const pageHtml = await pageRes.text();
    const pageDoc = cheerio.load(pageHtml);

    // Read the CSRF token from HTML metadata
    const csrfToken = pageDoc('meta[name="csrf-token"]').attr('content');
    if (!csrfToken) {
      console.warn('SoloLatino: CSRF token not found in meta tags.');
      return [];
    }

    // Extract all player tokens from the server buttons
    const playerTokens = [];
    pageDoc('.server-btn').each((i, el) => {
      const token = pageDoc(el).attr('data-player-token');
      const serverName = pageDoc(el).text().trim() || `Servidor ${i + 1}`;
      if (token) {
        playerTokens.push({
          name: serverName,
          token: token
        });
      }
    });

    console.log(`SoloLatino: Found ${playerTokens.length} player tokens`);

    // 4. Query the /api/player-url endpoint for each token
    const streams = await mapWithConcurrency(playerTokens, TOKEN_CONCURRENCY, async (pInfo) => {
      try {
        const apiRes = await fetch('https://sololatino.net/api/player-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-XSRF-TOKEN': decodedXSRF,
            'User-Agent': userAgent,
            'Cookie': cookieString,
            'Referer': targetPageUrl,
            'Origin': 'https://sololatino.net'
          },
          body: JSON.stringify({ t: pInfo.token })
        });

        if (apiRes.status === 200) {
          const apiJson = await apiRes.json();
          if (apiJson && apiJson.url) {
            const streamUrl = apiJson.url;
            const isIframe = apiJson.type === 'iframe' || streamUrl.includes('embed') || streamUrl.includes('player') || streamUrl.includes('/f/');
            

            let directUrl = null;
            if (isIframe) {
              try {
                // If it is player.pelisserieshoy.com, perform the s.php handshake to fetch direct streams!
                if (streamUrl.includes('player.pelisserieshoy.com')) {
                  const pPageRes = await fetch(streamUrl, {
                    headers: { 'User-Agent': userAgent, 'Referer': 'https://sololatino.net/' }
                  });
                  if (pPageRes.ok) {
                    const pHtml = await pPageRes.text();
                    const tokenMatch = pHtml.match(/const\s+_t\s*=\s*['"]([^'"]+)['"]/);
                    if (tokenMatch) {
                      const tToken = tokenMatch[1];
                      
                      // 1. Register click
                      await fetch('https://player.pelisserieshoy.com/s.php', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded',
                          'User-Agent': userAgent,
                          'Referer': streamUrl,
                          'Origin': 'https://player.pelisserieshoy.com'
                        },
                        body: new URLSearchParams({ a: 'click', tok: tToken })
                      });

                      // 2. Fetch server list
                      const sListRes = await fetch('https://player.pelisserieshoy.com/s.php', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/x-www-form-urlencoded',
                          'User-Agent': userAgent,
                          'Referer': streamUrl,
                          'Origin': 'https://player.pelisserieshoy.com'
                        },
                        body: new URLSearchParams({ a: '1', tok: tToken })
                      });

                      if (sListRes.ok) {
                        const sListJson = await sListRes.json();
                        if (sListJson && sListJson.s && sListJson.s.length > 0) {
                          // Extract first server
                          const [sLabel, sVal] = sListJson.s[0];
                          // 3. Request direct file path
                          const playValRes = await fetch('https://player.pelisserieshoy.com/s.php', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/x-www-form-urlencoded',
                              'User-Agent': userAgent,
                              'Referer': streamUrl,
                              'Origin': 'https://player.pelisserieshoy.com'
                            },
                            body: new URLSearchParams({ a: '2', v: sVal, tok: tToken })
                          });

                          if (playValRes.ok) {
                            const playValJson = await playValRes.json();
                            if (playValJson && playValJson.u) {
                              const pathUrl = 'https://player.pelisserieshoy.com' + playValJson.u;
                              // 4. Resolve mediafire/direct redirect location header
                              const redirectCheck = await fetch(pathUrl, {
                                method: 'GET',
                                headers: { 'User-Agent': userAgent, 'Referer': streamUrl },
                                redirect: 'manual'
                              });
                              if (redirectCheck.status === 302 || redirectCheck.status === 301) {
                                directUrl = redirectCheck.headers.get('location');
                              } else {
                                directUrl = pathUrl;
                              }
                              if (directUrl && directUrl.includes('.bin')) {
                                directUrl += '#.mp4';
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                } else {
                  // Standard direct extraction / Dean Edwards unpacker fallback / Embed69 recursive resolution
                  directUrl = await unpacker.resolvePlayerStream(streamUrl, userAgent, 'https://sololatino.net/');
                }
              } catch (e) {
                console.error(`SoloLatino: Error unpacking iframe ${streamUrl}:`, e.message);
              }
            } else {
              directUrl = streamUrl;
            }


            if (directUrl) {
              return {
                name: `SoloLatino`,
                title: `🇲🇽 ${pInfo.name}`,
                url: directUrl,
                behaviorHints: {
                  notWebReady: true,
                  proxyHeaders: {
                    request: {
                      "User-Agent": userAgent,
                      "Referer": streamUrl || "https://sololatino.net/"
                    }
                  }
                }
              };
            }
          }
        } else {
          console.warn(`SoloLatino: API /api/player-url returned status ${apiRes.status} for server ${pInfo.name}`);
        }
      } catch (err) {
        console.error(`SoloLatino: Error requesting player URL for server ${pInfo.name}:`, err.message);
      }
      return null;
    });

    return streams;
  } catch (error) {
    console.error(`SoloLatino scrape error for "${title}":`, error.message);
    return [];
  }
}

module.exports = { scrape };
