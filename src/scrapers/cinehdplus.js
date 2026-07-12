const { fetchWithTimeout } = require('../http');

/**
 * CineHDPlus Scraper
 * Note: cinehdplus.org is currently protected by Cloudflare Turnstile/JS challenge (403).
 * This module handles searches gracefully by logging the status and returning an empty list,
 * keeping the addon responsive and preventing timeouts.
 */
async function scrape(title, originalTitle, year, type, season, episode, options = {}) {
  const { signal } = options;
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const targetUrl = 'https://cinehdplus.org/';
  
  try {
    console.log(`CineHDPlus: Checking accessibility for ${targetUrl}`);
    // Probe the site with a short timeout to check if it's open or blocked
    const res = await fetchWithTimeout(targetUrl, {
      headers: { 'User-Agent': userAgent },
      signal
    }, 3000);

    if (res.status === 403) {
      console.log(`CineHDPlus: Site returned 403 (Cloudflare Protected). Skipping CineHDPlus.`);
      return [];
    }

    // If it ever returns 200 (e.g. if the user runs behind a local proxy or Cloudflare is disabled),
    // we can implement a standard scraping routine here.
    console.log(`CineHDPlus: Site returned ${res.status}. Parsing not implemented.`);
    return [];

  } catch (error) {
    console.error('CineHDPlus access error:', error.message);
    return [];
  }
}

module.exports = { scrape };
