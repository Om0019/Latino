const cheerio = require('cheerio');
const unpacker = require('../unpacker');
const PLAYER_CONCURRENCY = 3;
const PLAYER_RESOLVE_TIMEOUT_MS = 1800;

function cleanText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function slugifyTitle(str, options = {}) {
  if (!str) return '';

  const { ampersandWord = 'y' } = options;

  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ` ${ampersandWord} `)
    .replace(/\band\b/g, ampersandWord)
    .replace(/\by\b/g, ampersandWord)
    .replace(/['’:.!,?()[\]/]+/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildSlugCandidates(title, originalTitle) {
  const candidates = [];
  const seen = new Set();
  const values = [title, originalTitle].filter(Boolean);
  const ampWords = ['y', 'and'];

  for (const value of values) {
    for (const ampWord of ampWords) {
      const slug = slugifyTitle(value, { ampersandWord: ampWord });
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      candidates.push(slug);
    }
  }

  return candidates;
}

function buildPageCandidates(type, title, originalTitle) {
  const basePath = type === 'series' ? 'serie' : 'pelicula';
  return buildSlugCandidates(title, originalTitle).map((slug) => ({
    slug,
    url: `https://cuevana3i.you/${basePath}/${slug}`
  }));
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

async function resolveWithTimeout(url, userAgent, referer) {
  return Promise.race([
    unpacker.resolvePlayerStream(url, userAgent, referer),
    new Promise((resolve) => setTimeout(() => resolve(null), PLAYER_RESOLVE_TIMEOUT_MS))
  ]);
}

function extractWrapperUrls(html) {
  const matches = html.match(/https:\/\/tungtungsahur\.cuevana3i\.you\/\?(?:token|v)=[^"'`\s<>]+/g) || [];
  return [...new Set(matches)];
}

function decodeWrapperUrl(wrapperUrl) {
  try {
    const parsed = new URL(wrapperUrl);
    const v = parsed.searchParams.get('v');
    if (v) {
      const decoded = Buffer.from(v, 'base64').toString('utf8').trim();
      if (decoded.startsWith('http')) {
        return decoded;
      }
    }
  } catch (err) {
    // Ignore malformed wrappers.
  }

  return null;
}

async function probePage(candidate, userAgent) {
  try {
    const res = await fetch(candidate.url, {
      headers: { 'User-Agent': userAgent }
    });

    if (!res.ok) return null;
    return candidate;
  } catch (err) {
    return null;
  }
}

async function scrape(title, originalTitle, year, type, season, episode) {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  try {
    let bestMatch = null;
    const candidates = buildPageCandidates(type, title, originalTitle);

    for (const candidate of candidates) {
      bestMatch = await probePage(candidate, userAgent);
      if (bestMatch) {
        console.log(`Cuevana3i: Using candidate URL ${bestMatch.url}`);
        break;
      }
    }

    if (!bestMatch) {
      console.log(`Cuevana3i: No matching content found for "${title}"`);
      return [];
    }

    const targetPageUrl = type === 'series'
      ? `${bestMatch.url}/episodio-${season}x${episode}`
      : bestMatch.url;

    const pageRes = await fetch(targetPageUrl, {
      headers: { 'User-Agent': userAgent }
    });
    if (!pageRes.ok) {
      console.warn(`Cuevana3i: Failed to fetch target page ${targetPageUrl} (${pageRes.status})`);
      return [];
    }

    const pageHtml = await pageRes.text();
    const pageDoc = cheerio.load(pageHtml);

    const wrapperUrls = extractWrapperUrls(pageHtml);
    console.log(`Cuevana3i: Found ${wrapperUrls.length} player wrappers`);

    const streams = await mapWithConcurrency(wrapperUrls, PLAYER_CONCURRENCY, async (wrapperUrl, index) => {
      const decodedUrl = decodeWrapperUrl(wrapperUrl);
      const optionName = pageDoc(`[data-url="${wrapperUrl}"]`).text().trim() || `Opcion ${index + 1}`;

      let directUrl = null;
      if (decodedUrl) {
        try {
          directUrl = await resolveWithTimeout(decodedUrl, userAgent, targetPageUrl);
        } catch (err) {
          console.error(`Cuevana3i: Error resolving decoded player for ${optionName}:`, err.message);
        }
      }

      if (directUrl) {
        return {
          name: 'Cuevana3i',
          title: `🇲🇽 ${optionName}`,
          url: directUrl,
          behaviorHints: {
            notWebReady: true,
            proxyHeaders: {
              request: {
                'User-Agent': userAgent,
                'Referer': decodedUrl || targetPageUrl
              }
            }
          }
        };
      }

      const externalUrl = decodedUrl || wrapperUrl;
      if (externalUrl) {
        return {
          name: 'Cuevana3i',
          title: `🌐 ${optionName}`,
          externalUrl
        };
      }
      return null;
    });

    return streams;
  } catch (error) {
    console.error(`Cuevana3i scrape error for "${title}":`, error.message);
    return [];
  }
}

module.exports = { scrape };
