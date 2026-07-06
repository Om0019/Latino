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
 * Cinecalidad Scraper (Direct Streams)
 */
async function scrape(title, year, type, season, episode) {
  // Cinecalidad primarily hosts movies. Skip series.
  if (type !== 'movie') {
    return [];
  }

  const searchUrl = `https://www.cinecalidad.am/?s=${encodeURIComponent(title)}`;
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    const res = await fetch(searchUrl, {
      headers: { 'User-Agent': userAgent }
    });
    if (!res.ok) {
      console.warn(`Cinecalidad search returned status ${res.status}`);
      return [];
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const results = [];

    // Extract all movie links from the search results
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      const titleAttr = $(el).attr('title') || '';
      
      if (href && (href.includes('/ver-pelicula/') || href.includes('/pelicula/'))) {
        const fullTitle = titleAttr || text;
        if (fullTitle) {
          results.push({
            url: href,
            title: fullTitle
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
      console.log(`Cinecalidad: No matching movie found for "${title}"`);
      return [];
    }

    console.log(`Cinecalidad: Matched movie page: ${bestMatch.title} (${bestMatch.url})`);

    // Fetch movie page to get player tabs
    const movieRes = await fetch(bestMatch.url, {
      headers: { 'User-Agent': userAgent }
    });
    if (!movieRes.ok) return [];

    const movieHtml = await movieRes.text();
    const movieDoc = cheerio.load(movieHtml);

    const playerOptions = [];

    // Parse player options from the playeroptionsul list
    movieDoc('#playeroptionsul li').each((i, el) => {
      const playerUrl = movieDoc(el).attr('data-option');
      let serverName = movieDoc(el).text().trim() || `Servidor ${i + 1}`;
      
      // Skip trailer
      if (serverName.toLowerCase().includes('trailer') || (playerUrl && playerUrl.includes('youtube.com'))) {
        return;
      }

      if (playerUrl) {
        playerOptions.push({
          playerUrl,
          serverName: serverName.replace('Recomendado', '').trim()
        });
      }
    });

    console.log(`Cinecalidad: Found ${playerOptions.length} player options. Fetching stream sources...`);

    const streams = [];

    // Concurrently fetch player pages and extract direct video streams
    const playerPromises = playerOptions.map(async (opt) => {
      try {
        const directUrl = await unpacker.resolvePlayerStream(opt.playerUrl, userAgent, bestMatch.url);

        const streamObj = {
          name: `Flava 📺 Cinecalidad`,
          title: `Cinecalidad 🇪🇸 [Castellano/Latino]\nServer: ${opt.serverName}\nDirect HLS Play Stream`
        };

        if (directUrl) {
          streamObj.url = directUrl;
          streamObj.behaviorHints = {
            notWebReady: true,
            proxyHeaders: {
              request: {
                "User-Agent": userAgent,
                "Referer": opt.playerUrl
              }
            }
          };
        } else {
          streamObj.externalUrl = opt.playerUrl;
          streamObj.title = `Cinecalidad 🇪🇸 [Castellano/Latino]\nServer: ${opt.serverName}\nExternal Web Player (Fallback)`;
        }
        streams.push(streamObj);
      } catch (err) {
        console.error(`Cinecalidad: Error resolving direct stream for ${opt.serverName}:`, err.message);
      }
    });

    await Promise.all(playerPromises);

    console.log(`Cinecalidad: Resolved ${streams.length} direct streams`);
    return streams;

  } catch (error) {
    console.error(`Cinecalidad scrape error for "${title}":`, error.message);
    return [];
  }
}

module.exports = { scrape };
