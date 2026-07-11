const assert = require('assert');
const app = require('./src/server');

const {
  shouldProxyStream,
  proxiedStreamUrl,
  rewriteHlsManifest
} = app.__test;

function fakeReq(baseUrl, referer = '') {
  const parsed = new URL(baseUrl);
  return {
    protocol: parsed.protocol.replace(':', ''),
    query: { referer },
    get(name) {
      if (name.toLowerCase() === 'host') return parsed.host;
      return undefined;
    },
    headers: {}
  };
}

function testProxyDecisions() {
  assert.strictEqual(shouldProxyStream({
    title: 'Headered HLS',
    url: 'https://ordinary-host.example/master.m3u8',
    behaviorHints: {
      proxyHeaders: {
        request: {
          Referer: 'https://embed.example/player',
          'User-Agent': 'Scraper UA'
        }
      }
    }
  }), true, 'streams with proxyHeaders should be proxied');

  assert.strictEqual(shouldProxyStream({
    title: 'Ace HLS',
    url: 'https://abc.acek-cdn.com/hls/master.m3u8'
  }), true, 'known header-sensitive CDN streams should be proxied');

  assert.strictEqual(shouldProxyStream({
    title: 'Premium',
    url: 'https://download.media.example/video.mp4'
  }), true, 'premium streams should be proxied');

  assert.strictEqual(shouldProxyStream({
    title: 'Plain Direct',
    url: 'https://plain.example/video.mp4'
  }), false, 'plain streams without headers or sensitive hosts should stay direct');
}

function testProxyUrl() {
  const url = proxiedStreamUrl(
    'https://addon.example',
    'https://video.example/master.m3u8?token=a b',
    'https://embed.example/player'
  );

  const parsed = new URL(url);
  assert.strictEqual(parsed.origin, 'https://addon.example');
  assert.strictEqual(parsed.pathname, '/proxy/stream');
  assert.strictEqual(parsed.searchParams.get('url'), 'https://video.example/master.m3u8?token=a b');
  assert.strictEqual(parsed.searchParams.get('referer'), 'https://embed.example/player');
}

function testHlsRewrite() {
  const manifest = [
    '#EXTM3U',
    '#EXT-X-KEY:METHOD=AES-128,URI="keys/main.key"',
    '#EXT-X-MAP:URI="init.mp4"',
    '#EXT-X-STREAM-INF:BANDWIDTH=1280000,RESOLUTION=1280x720',
    'variant/index.m3u8',
    '#EXTINF:6.000,',
    'https://cdn.example/video/segment001.ts',
    '#EXT-X-DATERANGE:ID="ad",X-ASSET-URI="not-a-playlist"',
    ''
  ].join('\n');

  const rewritten = rewriteHlsManifest(
    manifest,
    'https://origin.example/path/master.m3u8',
    fakeReq('https://addon.example', 'https://embed.example/player')
  );

  assert(rewritten.includes('https://addon.example/proxy/stream?url='), 'rewritten manifest contains proxied URLs');
  assert(rewritten.includes(encodeURIComponent('https://origin.example/path/variant/index.m3u8')), 'relative variant playlist is rewritten');
  assert(rewritten.includes(encodeURIComponent('https://origin.example/path/keys/main.key')), 'relative key URI is rewritten');
  assert(rewritten.includes(encodeURIComponent('https://origin.example/path/init.mp4')), 'relative init map URI is rewritten');
  assert(rewritten.includes(encodeURIComponent('https://cdn.example/video/segment001.ts')), 'absolute segment URL is rewritten');
  assert(rewritten.includes('referer=https%3A%2F%2Fembed.example%2Fplayer'), 'referer is preserved on child proxy URLs');
}

testProxyDecisions();
testProxyUrl();
testHlsRewrite();

console.log('Proxy stream tests passed');
