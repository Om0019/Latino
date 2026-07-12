const DEFAULT_TIMEOUT_MS = 6000;

function decodeHtmlEntities(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#038;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeUrl(value, baseUrl) {
  if (!value) return null;

  let url = decodeHtmlEntities(value).trim();
  url = url.replace(/\\\//g, '/');

  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const externalSignal = options.signal;
  const abortFromExternalSignal = () => controller.abort();

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
    }
  }

  const { signal, ...fetchOptions } = options;

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      if (!timedOut) {
        throw new Error(`Fetch aborted: ${url}`);
      }
      throw new Error(`Fetch timeout after ${timeoutMs}ms: ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener('abort', abortFromExternalSignal);
    }
  }
}

async function fetchTextWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const res = await fetchWithTimeout(url, options, timeoutMs);
  const text = await res.text();
  return { res, text };
}

module.exports = {
  decodeHtmlEntities,
  fetchTextWithTimeout,
  fetchWithTimeout,
  normalizeUrl
};
