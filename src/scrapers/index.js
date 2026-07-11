const tmdb = require('../tmdb');
const sololatino = require('./sololatino');
const cinecalidad = require('./cinecalidad');
const tioplus = require('./tioplus');
const cinehdplus = require('./cinehdplus');
const cuevana3i = require('./cuevana3i');
const { fetchWithTimeout, normalizeUrl } = require('../http');

const SCRAPER_TIMEOUT_MS = 6500;
const SOLOLATINO_TIMEOUT_MS = 9000;
const SCRAPER_COLLECTION_TIMEOUT_MS = 7000;
const STREAM_VALIDATION_TIMEOUT_MS = 5000;
const STREAM_VALIDATION_TOTAL_TIMEOUT_MS = 6500;
const STREAM_CACHE_TTL_MS = 90 * 1000;
const ENABLE_CINEHDPLUS = false;

const streamCache = new Map();
const inFlightRequests = new Map();

function getStreamHost(stream) {
  try {
    return new URL(stream.url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isKnownBadStream(stream) {
  const url = (stream.url || '').toLowerCase();
  const title = (stream.title || '').toLowerCase();
  const name = (stream.name || '').toLowerCase();
  return url.includes('test-videos.co.uk')
    || url.includes('big_buck_bunny')
    || url.includes('magnet:')
    || url.includes('.torrent')
    || url.includes('strp2p.com')
    || title.includes('p2p')
    || title.includes('torrent')
    || name.includes('torrent');
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

function uniqueStreams(streams) {
  const seen = new Set();
  const unique = [];

  for (const stream of streams) {
    const normalizedUrl = normalizeUrl(stream.url);
    if (!normalizedUrl || seen.has(normalizedUrl)) continue;
    seen.add(normalizedUrl);
    unique.push({
      ...stream,
      url: normalizedUrl
    });
  }

  return unique;
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

async function collectScraperResults(tasks, timeoutMs) {
  const results = [];
  let pending = tasks.length;

  const trackedTasks = tasks.map((task) => (
    task.promise
      .then((value) => ({ status: 'fulfilled', value, name: task.name }))
      .catch((reason) => ({ status: 'rejected', reason, name: task.name }))
      .then((result) => {
        results.push(result);
        pending -= 1;
        return result;
      })
  ));

  await Promise.race([
    Promise.all(trackedTasks),
    new Promise((resolve) => setTimeout(resolve, timeoutMs))
  ]);

  if (pending > 0) {
    const pendingNames = tasks
      .filter((task) => !results.some((result) => result.name === task.name))
      .map((task) => task.name)
      .join(', ');
    console.warn(`Scraper orchestrator: Returning partial results; still waiting on ${pendingNames}`);
  }

  return results;
}

function sanitizeStream(stream) {
  if (!stream.url) return stream;

  if (isKnownBadStream(stream)) {
    console.log(`Scraper orchestrator: Filtering suspicious placeholder stream: ${stream.url}`);
    return null;
  }

  try {
    const parsedUrl = new URL(stream.url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      console.log(`Scraper orchestrator: Filtering stream with unsupported protocol: ${stream.url}`);
      return null;
    }
  } catch {
    console.log(`Scraper orchestrator: Filtering stream with invalid URL: ${stream.url}`);
    return null;
  }

  return stream;
}

function looksLikePlayableUrl(url) {
  return /\.(m3u8|mp4|mkv|bin)(?:$|[?#])/i.test(url);
}

function isHtmlResponse(response) {
  return (response.headers.get('content-type') || '').toLowerCase().includes('text/html');
}

async function isPlayableStream(stream) {
  const headers = {
    'User-Agent': stream?.behaviorHints?.proxyHeaders?.request?.['User-Agent']
      || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': stream?.behaviorHints?.proxyHeaders?.request?.Referer || 'https://sololatino.net/',
    'Range': 'bytes=0-2047'
  };

  try {
    const response = await fetchWithTimeout(stream.url, {
      method: 'GET',
      headers,
      redirect: 'follow'
    }, STREAM_VALIDATION_TIMEOUT_MS);

    if ([401, 403, 404, 410, 451].includes(response.status)) {
      console.log(`Scraper orchestrator: Filtering unplayable stream (${response.status}): ${stream.url}`);
      return false;
    }

    if (!response.ok && response.status !== 206) {
      console.log(`Scraper orchestrator: Filtering stream with bad validation status (${response.status}): ${stream.url}`);
      return false;
    }

    if (stream.url.toLowerCase().includes('.m3u8')) {
      if (isHtmlResponse(response)) return false;
      const body = await response.text();
      return body.includes('#EXTM3U') || body.includes('#EXT-X-STREAM-INF') || body.includes('#EXTINF');
    }

    if (isHtmlResponse(response) && !looksLikePlayableUrl(response.url || stream.url)) {
      return false;
    }

    return looksLikePlayableUrl(response.url || stream.url)
      || (response.headers.get('content-type') || '').toLowerCase().startsWith('video/')
      || (response.headers.get('content-disposition') || '').toLowerCase().includes('attachment');
  } catch (error) {
    console.log(`Scraper orchestrator: Filtering stream that failed validation: ${stream.url} (${error.message})`);
    return false;
  }
}

async function validatePlayableStreams(streams) {
  const validationPromise = Promise.all(
    streams.map(async (stream) => ((await isPlayableStream(stream)) ? stream : null))
  );

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve(null), STREAM_VALIDATION_TOTAL_TIMEOUT_MS);
  });

  const result = await Promise.race([validationPromise, timeoutPromise]);
  if (!result) {
    console.warn('Scraper orchestrator: Stream validation timed out; returning URL-sanitized streams.');
    return streams;
  }

  return result.filter(Boolean);
}

/**
 * Combined scraping orchestrator.
 * Accepts IMDb ID or TMDB ID and queries all sources concurrently.
 */
async function getStreamsUncached(type, id, season, episode) {
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
    const scraperTasks = [
      { name: 'SoloLatino', promise: withTimeout(sololatino.scrape(title, originalTitle, year, type, season, episode), SOLOLATINO_TIMEOUT_MS, 'SoloLatino') },
      { name: 'Cinecalidad', promise: withTimeout(cinecalidad.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'Cinecalidad') },
      { name: 'TioPlus', promise: withTimeout(tioplus.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'TioPlus') },
      { name: 'Cuevana3i', promise: withTimeout(cuevana3i.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'Cuevana3i') }
    ];

    if (ENABLE_CINEHDPLUS) {
      scraperTasks.push({
        name: 'CineHDPlus',
        promise: withTimeout(cinehdplus.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'CineHDPlus')
      });
    }

    const results = await collectScraperResults(scraperTasks, SCRAPER_COLLECTION_TIMEOUT_MS);
    const streams = [];

    results.forEach((res) => {
      const name = res.name;

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
    const sanitizedStreams = uniqueStreams(directStreams.map(sanitizeStream).filter(Boolean));
    const playableStreams = await validatePlayableStreams(sanitizedStreams);
    return sortStreams(playableStreams);

  } catch (err) {
    console.error('Error in combined getStreams:', err.message);
    return [];
  }
}

async function getStreams(type, id, season, episode) {
  const key = [type, id, season || '', episode || ''].join(':');
  const cached = streamCache.get(key);

  if (cached && cached.expiresAt > Date.now()) {
    console.log(`Scraper orchestrator: Cache hit for ${key} (${cached.streams.length} streams)`);
    return cached.streams;
  }

  if (inFlightRequests.has(key)) {
    console.log(`Scraper orchestrator: Reusing in-flight request for ${key}`);
    return inFlightRequests.get(key);
  }

  const request = getStreamsUncached(type, id, season, episode)
    .then((streams) => {
      streamCache.set(key, {
        streams,
        expiresAt: Date.now() + STREAM_CACHE_TTL_MS
      });
      return streams;
    })
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, request);
  return request;
}

module.exports = { getStreams };
