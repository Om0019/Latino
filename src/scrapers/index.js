const tmdb = require('../tmdb');
const sololatino = require('./sololatino');
const cinecalidad = require('./cinecalidad');
const tioplus = require('./tioplus');
const cinehdplus = require('./cinehdplus');
const cuevana3i = require('./cuevana3i');
const lamovie = require('./lamovie');
const pelispedia = require('./pelispedia');
const { fetchWithTimeout, normalizeUrl } = require('../http');

const SCRAPER_TIMEOUT_MS = 10000;
const SOLOLATINO_TIMEOUT_MS = 12000;
const SCRAPER_COLLECTION_TIMEOUT_MS = 11500;
const FAST_SOURCE_MIN_WAIT_MS = 3500;
const FAST_SOURCE_MIN_STREAMS = 3;
const FAST_SOURCE_MIN_SOURCES = 1;
const STREAM_VALIDATION_TIMEOUT_MS = 5000;
const STREAM_VALIDATION_TOTAL_TIMEOUT_MS = 4000;
const STREAM_VALIDATION_FAST_TIMEOUT_MS = 3200;
const MIN_CONFIRMED_STREAMS = 3;
const MAX_VALIDATION_CANDIDATES = 8;
const STREAM_CACHE_TTL_MS = 10 * 60 * 1000;
const ENABLE_CINEHDPLUS = false;
const HOST_HEALTH_TTL_MS = 5 * 60 * 1000;
const HOST_HEALTH_MAX_PENALTY = 5;

const streamCache = new Map();
const inFlightRequests = new Map();
const hostHealth = new Map();

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

function getHostHealth(host) {
  const health = hostHealth.get(host);
  if (!health) return { penalty: 0 };

  if (health.expiresAt <= Date.now()) {
    hostHealth.delete(host);
    return { penalty: 0 };
  }

  return health;
}

function recordHostHealth(stream, playable) {
  const host = getStreamHost(stream);
  if (!host) return;

  const current = getHostHealth(host);
  const penalty = playable
    ? Math.max(0, (current.penalty || 0) - 1)
    : Math.min(HOST_HEALTH_MAX_PENALTY, (current.penalty || 0) + 1);

  if (penalty === 0) {
    hostHealth.delete(host);
    return;
  }

  hostHealth.set(host, {
    penalty,
    expiresAt: Date.now() + HOST_HEALTH_TTL_MS
  });
}

function scoreStream(stream) {
  const host = getStreamHost(stream);
  const title = (stream.title || '').toLowerCase();
  const healthPenalty = getHostHealth(host).penalty || 0;
  let baseScore = 9;

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) baseScore = 0;
  else if (host.includes('turboviplay.com')) baseScore = 1;
  else if (host.includes('vimeos')) baseScore = 2;
  else if (host.includes('acek-cdn.com')) baseScore = 3;
  else if (host.includes('dramiyos-cdn.com') || host.includes('cfglobalcdn.com')) baseScore = 4;
  else if (host.includes('mediafire.com') || host.includes('fireload.com')) baseScore = 5;
  else if (host.includes('goodstream')) baseScore = 6;
  else if (host.includes('nupload')) baseScore = 6;
  else if (host.includes('premilkyway.com') || title.includes('hlswish')) baseScore = 7;
  else if (host.includes('cdn-tnmr.org')) baseScore = 8;

  return baseScore + healthPenalty;
}

function getHostFamily(stream) {
  const host = getStreamHost(stream);
  const title = (stream.title || '').toLowerCase();

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return 'pelisplus-ip';
  if (host.includes('turboviplay.com')) return 'turboviplay';
  if (host.includes('vimeos')) return 'vimeos';
  if (host.includes('acek-cdn.com')) return 'acek-cdn';
  if (host.includes('dramiyos-cdn.com')) return 'dramiyos-cdn';
  if (host.includes('cfglobalcdn.com')) return 'cfglobalcdn';
  if (host.includes('mediafire.com')) return 'mediafire';
  if (host.includes('fireload.com')) return 'fireload';
  if (host.includes('goodstream')) return 'goodstream';
  if (host.includes('nupload')) return 'nupload';
  if (host.includes('premilkyway.com') || title.includes('hlswish')) return 'hlswish';
  if (host.includes('cdn-tnmr.org')) return 'cdn-tnmr';
  return host || 'unknown';
}

function sortStreams(streams) {
  const ranked = [...streams].sort((a, b) => scoreStream(a) - scoreStream(b));
  const byFamily = new Map();

  for (const stream of ranked) {
    const family = getHostFamily(stream);
    if (!byFamily.has(family)) byFamily.set(family, []);
    byFamily.get(family).push(stream);
  }

  const sortedFamilies = [...byFamily.entries()]
    .sort((a, b) => scoreStream(a[1][0]) - scoreStream(b[1][0]));

  const diversified = [];
  while (sortedFamilies.some(([, familyStreams]) => familyStreams.length > 0)) {
    for (const [, familyStreams] of sortedFamilies) {
      const stream = familyStreams.shift();
      if (stream) diversified.push(stream);
    }
  }

  return diversified;
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
  let fastReturnEnabled = false;
  let resolveFastReturn;

  const hasEnoughStreamsForFastReturn = () => {
    const fulfilledWithStreams = results.filter((result) => (
      result.status === 'fulfilled'
      && Array.isArray(result.value)
      && result.value.length > 0
    ));
    const streamCount = fulfilledWithStreams.reduce((total, result) => total + result.value.length, 0);
    return fulfilledWithStreams.length >= FAST_SOURCE_MIN_SOURCES
      && streamCount >= FAST_SOURCE_MIN_STREAMS;
  };

  const fastReturnPromise = new Promise((resolve) => {
    resolveFastReturn = resolve;
    setTimeout(() => {
      fastReturnEnabled = true;
      if (hasEnoughStreamsForFastReturn()) {
        resolve('enough-streams');
      }
    }, FAST_SOURCE_MIN_WAIT_MS);
  });

  const trackedTasks = tasks.map((task) => (
    task.promise
      .then((value) => ({ status: 'fulfilled', value, name: task.name }))
      .catch((reason) => ({ status: 'rejected', reason, name: task.name }))
      .then((result) => {
        results.push(result);
        pending -= 1;
        if (fastReturnEnabled && hasEnoughStreamsForFastReturn()) {
          resolveFastReturn('enough-streams');
        }
        return result;
      })
  ));

  const completionReason = await Promise.race([
    Promise.all(trackedTasks).then(() => 'complete'),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), timeoutMs)),
    fastReturnPromise
  ]);

  if (pending > 0) {
    const pendingNames = tasks
      .filter((task) => !results.some((result) => result.name === task.name))
      .map((task) => task.name)
      .join(', ');
    const reason = completionReason === 'enough-streams' ? 'fast response target met' : 'timeout';
    console.warn(`Scraper orchestrator: Returning partial results (${reason}); still waiting on ${pendingNames}`);
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
      recordHostHealth(stream, false);
      return false;
    }

    if (!response.ok && response.status !== 206) {
      console.log(`Scraper orchestrator: Filtering stream with bad validation status (${response.status}): ${stream.url}`);
      recordHostHealth(stream, false);
      return false;
    }

    if (stream.url.toLowerCase().includes('.m3u8')) {
      if (isHtmlResponse(response)) {
        recordHostHealth(stream, false);
        return false;
      }
      const body = await response.text();
      const playable = body.includes('#EXTM3U') || body.includes('#EXT-X-STREAM-INF') || body.includes('#EXTINF');
      recordHostHealth(stream, playable);
      return playable;
    }

    if (isHtmlResponse(response) && !looksLikePlayableUrl(response.url || stream.url)) {
      recordHostHealth(stream, false);
      return false;
    }

    const playable = looksLikePlayableUrl(response.url || stream.url)
      || (response.headers.get('content-type') || '').toLowerCase().startsWith('video/')
      || (response.headers.get('content-disposition') || '').toLowerCase().includes('attachment');
    recordHostHealth(stream, playable);
    return playable;
  } catch (error) {
    console.log(`Scraper orchestrator: Filtering stream that failed validation: ${stream.url} (${error.message})`);
    recordHostHealth(stream, false);
    return false;
  }
}

async function validatePlayableStreams(streams) {
  const sortedStreams = sortStreams(streams);
  const streamsToValidate = sortedStreams.slice(0, MAX_VALIDATION_CANDIDATES);
  const remainingStreams = sortedStreams.slice(MAX_VALIDATION_CANDIDATES);

  if (streamsToValidate.length === 0) {
    return [];
  }

  const playableStreams = [];
  let completed = 0;
  let resolveEnoughConfirmed;
  let resolveAllComplete;

  const enoughConfirmedPromise = new Promise((resolve) => {
    resolveEnoughConfirmed = resolve;
  });
  const allCompletePromise = new Promise((resolve) => {
    resolveAllComplete = resolve;
  });

  streamsToValidate.forEach((stream) => {
    isPlayableStream(stream)
      .then((playable) => {
        if (playable) {
          playableStreams.push(stream);
          if (playableStreams.length >= MIN_CONFIRMED_STREAMS) {
            resolveEnoughConfirmed('enough-confirmed');
          }
        }
      })
      .catch((error) => {
        console.log(`Scraper orchestrator: Validation task failed for ${stream.url}: ${error.message}`);
        recordHostHealth(stream, false);
      })
      .finally(() => {
        completed += 1;
        if (completed === streamsToValidate.length) {
          resolveAllComplete('complete');
        }
      });
  });

  const timeoutMs = remainingStreams.length > 0
    ? STREAM_VALIDATION_FAST_TIMEOUT_MS
    : STREAM_VALIDATION_TOTAL_TIMEOUT_MS;
  const completionReason = await Promise.race([
    enoughConfirmedPromise,
    allCompletePromise,
    new Promise((resolve) => setTimeout(() => resolve('timeout'), timeoutMs))
  ]);

  if (playableStreams.length > 0) {
    if (completionReason === 'timeout') {
      console.warn(`Scraper orchestrator: Validation timed out; returning ${playableStreams.length} confirmed playable streams and dropping slow candidates.`);
    }
    return sortStreams(playableStreams);
  }

  if (remainingStreams.length > 0) {
    console.warn('Scraper orchestrator: No validated streams yet; returning lower-priority sanitized fallback streams to avoid a false empty result.');
    return remainingStreams;
  }

  if (sortedStreams.length > 0) {
    console.warn('Scraper orchestrator: Validation found no confirmed playable streams; returning URL-sanitized streams to avoid a false empty result.');
  }
  return sortedStreams;
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
      { name: 'Cuevana3i', promise: withTimeout(cuevana3i.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'Cuevana3i') },
      { name: 'LaMovie', promise: withTimeout(lamovie.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'LaMovie') },
      { name: 'PelisPedia', promise: withTimeout(pelispedia.scrape(title, originalTitle, year, type, season, episode), SCRAPER_TIMEOUT_MS, 'PelisPedia') }
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
