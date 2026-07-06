const tmdb = require('../tmdb');
const sololatino = require('./sololatino');
const cinecalidad = require('./cinecalidad');
const tioplus = require('./tioplus');
const cinehdplus = require('./cinehdplus');

const SCRAPER_TIMEOUT_MS = 6500;
const STREAM_VERIFICATION_TIMEOUT_MS = 1200;
const ENABLE_CINEHDPLUS = false;

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;

  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => {
        console.warn(`${label} timed out after ${timeoutMs}ms`);
        resolve([]);
      }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function verifyStream(stream, userAgent) {
  if (!stream.url) return stream;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), STREAM_VERIFICATION_TIMEOUT_MS);
    const headers = {
      'User-Agent': userAgent,
      'Referer': stream?.behaviorHints?.proxyHeaders?.request?.Referer || 'https://sololatino.net/'
    };
    const headRes = await fetch(stream.url, {
      method: 'HEAD',
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (headRes.status === 404) {
      console.log(`Scraper orchestrator: Filtering out dead link (404): ${stream.url}`);
      return null;
    }
  } catch (err) {
    // Keep stream on transient verification failures to avoid hiding good sources.
  }

  return stream;
}

/**
 * Combined scraping orchestrator.
 * Accepts IMDb ID or TMDB ID and queries all sources concurrently.
 */
async function getStreams(type, id, season, episode) {
  let title = '';
  let originalTitle = '';
  let year = null;
  let tmdbId = '';
  let imdbId = '';

  try {
    // 1. Resolve metadata (Title, Year, ID mapping) using TMDB API
    if (id.startsWith('tmdb:')) {
      // ID format: tmdb:movie:12345 or tmdb:series:12345:1:1
      const parts = id.split(':');
      tmdbId = parts[2];
      const meta = await tmdb.getMetaDetails(type, tmdbId, { includeEpisodes: false });
      if (meta) {
        title = meta.name;
        originalTitle = meta.originalTitle;
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
        originalTitle = details.originalTitle;
        year = details.year;
        tmdbId = details.id;
      }
    } else {
      // Fallback: If it's a raw TMDB ID number
      const meta = await tmdb.getMetaDetails(type, id, { includeEpisodes: false });
      if (meta) {
        title = meta.name;
        originalTitle = meta.originalTitle;
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
      withTimeout(sololatino.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'SoloLatino'),
      withTimeout(cinecalidad.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'Cinecalidad'),
      withTimeout(tioplus.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'TioPlus')
    ];

    if (ENABLE_CINEHDPLUS) {
      scraperPromises.push(
        withTimeout(cinehdplus.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'CineHDPlus')
      );
    }

    const results = await Promise.allSettled(scraperPromises);
    const streams = [];

    results.forEach((res, index) => {
      const scraperNames = ENABLE_CINEHDPLUS
        ? ['SoloLatino', 'Cinecalidad', 'TioPlus', 'CineHDPlus']
        : ['SoloLatino', 'Cinecalidad', 'TioPlus'];
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

    // 3. Light verification pass to filter obvious 404s without delaying response too much
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const verifiedStreams = (await Promise.all(streams.map((stream) => verifyStream(stream, userAgent)))).filter(Boolean);
    return verifiedStreams;

  } catch (err) {
    console.error('Error in combined getStreams:', err.message);
    return [];
  }
}

module.exports = { getStreams };
