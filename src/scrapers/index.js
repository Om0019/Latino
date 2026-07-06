const tmdb = require('../tmdb');
const sololatino = require('./sololatino');
const cinecalidad = require('./cinecalidad');
const tioplus = require('./tioplus');
const cinehdplus = require('./cinehdplus');

/**
 * Combined scraping orchestrator.
 * Accepts IMDb ID or TMDB ID and queries all sources concurrently.
 */
async function getStreams(type, id, season, episode) {
  let title = '';
  let year = null;
  let tmdbId = '';
  let imdbId = '';

  try {
    // 1. Resolve metadata (Title, Year, ID mapping) using TMDB API
    if (id.startsWith('tmdb:')) {
      // ID format: tmdb:movie:12345 or tmdb:series:12345:1:1
      const parts = id.split(':');
      tmdbId = parts[2];
      const meta = await tmdb.getMetaDetails(type, tmdbId);
      if (meta) {
        title = meta.name;
        year = meta.releaseInfo ? parseInt(meta.releaseInfo) : null;
        imdbId = meta.imdb_id;
      }
    } else if (id.startsWith('tt')) {
      // IMDb ID format: tt1234567 or tt1234567:1:1
      // If it contains season and episode, split them
      const parts = id.split(':');
      imdbId = parts[0];
      const details = await tmdb.findByImdbId(imdbId);
      if (details) {
        title = details.title;
        year = details.year;
        tmdbId = details.id;
      }
    } else {
      // Fallback: If it's a raw TMDB ID number
      const meta = await tmdb.getMetaDetails(type, id);
      if (meta) {
        title = meta.name;
        year = meta.releaseInfo ? parseInt(meta.releaseInfo) : null;
        imdbId = meta.imdb_id;
      }
    }

    if (!title) {
      console.warn(`Scraper orchestrator: Could not resolve title/details for ID ${id} using TMDB.`);
      return [];
    }

    console.log(`Orchestrator matching: "${title}" (${year}), Type: ${type}, Season: ${season}, Episode: ${episode}`);

    // 2. Invoke scrapers in parallel
    const scraperPromises = [
      sololatino.scrape(title, year, type, season, episode),
      cinecalidad.scrape(title, year, type, season, episode),
      tioplus.scrape(title, year, type, season, episode),
      cinehdplus.scrape(title, year, type, season, episode)
    ];

    const results = await Promise.allSettled(scraperPromises);
    const streams = [];

    results.forEach((res, index) => {
      const scraperNames = ['SoloLatino', 'Cinecalidad', 'TioPlus', 'CineHDPlus'];
      const name = scraperNames[index];
      
      if (res.status === 'fulfilled') {
        if (res.value && res.value.length > 0) {
          console.log(`${name} returned ${res.value.length} streams`);
          streams.push(...res.value);
        } else {
          console.log(`${name} returned 0 streams`);
        }
      } else {
        console.error(`${name} failed during execution:`, res.reason);
      }
    });

    // 3. Verify stream playability concurrently to filter out dead 404 links
    const verifiedStreams = [];
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    const verificationPromises = streams.map(async (stream) => {
      const streamUrl = stream.url;
      if (!streamUrl) return;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout
        
        const checkRes = await fetch(streamUrl, {
          method: 'GET',
          headers: {
            'User-Agent': userAgent,
            'Referer': 'https://sololatino.net/'
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (checkRes.status === 404) {
          console.log(`Scraper orchestrator: Filtering out dead link (404): ${streamUrl}`);
          return; // Discard
        }
      } catch (err) {
        // Keep in case of timeout/network errors to prevent false negatives
      }
      verifiedStreams.push(stream);
    });

    await Promise.all(verificationPromises);
    return verifiedStreams;

  } catch (err) {
    console.error('Error in combined getStreams:', err.message);
    return [];
  }
}

module.exports = { getStreams };
