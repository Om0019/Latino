const assert = require('assert');
const sololatino = require('./src/scrapers/sololatino');

const {
  scoreCandidate,
  extractPageIdentityText,
  pageHasRequestedYear,
  buildFallbackUrls
} = sololatino.__test;

assert.strictEqual(
  scoreCandidate({
    url: 'https://sololatino.net/pelicula/supergirl',
    title: 'Pelicula Supergirl 1984'
  }, 'Supergirl', 'Supergirl', 2026),
  0,
  'SoloLatino must reject explicit wrong-year movie search results'
);

assert(pageHasRequestedYear('<h1>Supergirl 2026</h1>', 2026), 'page with target year is accepted');
assert.strictEqual(
  pageHasRequestedYear('<title>Ver Supergirl (1984) Online</title><script>const year = 2026;</script>', 2026),
  false,
  'fallback page with wrong identity year is rejected even if chrome/script contains the requested year'
);
assert.strictEqual(
  extractPageIdentityText('<title>Ver Supergirl (1984) Online</title><h1>Supergirl</h1>').includes('1984'),
  true,
  'identity extraction includes title metadata'
);

assert.deepStrictEqual(
  buildFallbackUrls('movie', 'Supergirl', 'Supergirl: Woman of Tomorrow').map((item) => item.url),
  [
    'https://sololatino.net/pelicula/supergirl',
    'https://sololatino.net/pelicula/supergirl-woman-of-tomorrow'
  ],
  'fallback URLs include title and original title candidates'
);

console.log('SoloLatino matching tests passed');
