const tmdb = require('../tmdb');
const sololatino = require('./sololatino');
const cinecalidad = require('./cinecalidad');
const tioplus = require('./tioplus');
const cinehdplus = require('./cinehdplus');
const cuevana3i = require('./cuevana3i');

const SCRAPER_TIMEOUT_MS = 6500;
const SOLOLATINO_TIMEOUT_MS = 9000;
const STREAM_VERIFICATION_TIMEOUT_MS = 1200;
const ENABLE_CINEHDPLUS = false;

function getStreamHost(stream) {
  try {
    return new URL(stream.url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isKnownBadStream(stream) {
  const url = (stream.url || '').toLowerCase();
  return url.includes('test-videos.co.uk') || url.includes('big_buck_bunny');
}

function scoreStream(stream) {
  const host = getStreamHost(stream);
  const title = (stream.title || '').toLowerCase();
  const name = (stream.name || '').toLowerCase();

  if (name === 'sololatino' && title.includes('premium')) return 0;
  if (name === 'cinecalidad' && title.includes('vimeos')) return 1;
  if (host.includes('mediafire.com') || host.includes('fireload.com')) return 2;
  if (name === 'sololatino') return 3;
  if (name === 'cinecalidad' && title.includes('goodstream')) return 7;
  if (name === 'tioplus' && title.includes('opción 1')) return 8;
  if (host.includes('dramiyos-cdn.com') || host.includes('cfglobalcdn.com') || host.includes('turboviplay.com') || host.includes('premilkyway.com')) return 4;
  if (host.includes('acek-cdn.com')) return 5;
  if (host.includes('vimeos') || host.includes('goodstream')) return 6;
  return 9;
}

function sortStreams(streams) {
  return [...streams].sort((a, b) => scoreStream(a) - scoreStream(b));
}

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

  if (isKnownBadStream(stream)) {
    console.log(`Scraper orchestrator: Filtering suspicious placeholder stream: ${stream.url}`);
    return null;
  }

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

    if ([403, 404, 410].includes(headRes.status)) {
      console.log(`Scraper orchestrator: Filtering out dead/protected link (${headRes.status}): ${stream.url}`);
      return null;
    }
  } catch (err) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), STREAM_VERIFICATION_TIMEOUT_MS);
      const headers = {
        'User-Agent': userAgent,
        'Referer': stream?.behaviorHints?.proxyHeaders?.request?.Referer || 'https://sololatino.net/',
        'Range': 'bytes=0-1'
      };
      const getRes = await fetch(stream.url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if ([403, 404, 410].includes(getRes.status)) {
        console.log(`Scraper orchestrator: Filtering out dead/protected link after GET fallback (${getRes.status}): ${stream.url}`);
        return null;
      }
    } catch (fallbackErr) {
      console.log(`Scraper orchestrator: Filtering out unreachable link: ${stream.url}`);
      return null;
    }
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
      withTimeout(sololatino.scrape(title, originalTitle, year, type, season, episode), SOLOLATINO_TIMEOUT_MS, 'SoloLatino'),
      withTimeout(cinecalidad.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'Cinecalidad'),
      withTimeout(tioplus.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'TioPlus'),
      withTimeout(cuevana3i.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'Cuevana3i')
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
        ? ['SoloLatino', 'Cinecalidad', 'TioPlus', 'Cuevana3i', 'CineHDPlus']
        : ['SoloLatino', 'Cinecalidad', 'TioPlus', 'Cuevana3i'];
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

    const directStreams = streams.filter((stream) => Boolean(stream?.url));

    // 3. Light verification pass to filter obvious 404s without delaying response too much
    const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    const verifiedStreams = (await Promise.all(directStreams.map((stream) => verifyStream(stream, userAgent)))).filter(Boolean);
    return sortStreams(verifiedStreams);

  } catch (err) {
    console.error('Error in combined getStreams:', err.message);
    return [];
  }
}

module.exports = { getStreams };
