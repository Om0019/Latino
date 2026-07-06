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
 * SoloLatino Scraper
 */
async function scrape(title, year, type, season, episode) {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const searchUrl = `https://sololatino.net/buscar?q=${encodeURIComponent(title)}`;

  try {
    // 1. Search for the content
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': userAgent }
    });
    if (!res.ok) {
      console.warn(`SoloLatino search returned status ${res.status}`);
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
        // Only collect links that match the requested type
        if ((type === 'movie' && isMovieLink) || (type === 'series' && isSeriesLink)) {
          results.push({
            url: href,
            title: text
          });
        }
      }
    });

    // Remove duplicates
    const uniqueResults = [];
    const seenUrls = new Set();
    for (const r of results) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        uniqueResults.push(r);
      }
    }

    // Find the best match
    const cleanTargetTitle = cleanText(title);
    let bestMatch = null;

    for (const r of uniqueResults) {
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

    if (!bestMatch && uniqueResults.length > 0) {
      bestMatch = uniqueResults[0];
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

    const streams = [];

    // 4. Query the /api/player-url endpoint for each token
    for (const pInfo of playerTokens) {
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
              const streamObj = {
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
              streams.push(streamObj);
            }
          }
        } else {
          console.warn(`SoloLatino: API /api/player-url returned status ${apiRes.status} for server ${pInfo.name}`);
        }
      } catch (err) {
        console.error(`SoloLatino: Error requesting player URL for server ${pInfo.name}:`, err.message);
      }
    }

    return streams;
  } catch (error) {
    console.error(`SoloLatino scrape error for "${title}":`, error.message);
    return [];
  }
}

module.exports = { scrape };
