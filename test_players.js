const unpacker = require('./src/unpacker');

const urls = [
  'https://filemoon.sx/e/jit3ysg37ojx',
  'https://hlswish.com/e/7mpdbzuy04uy',
  'https://embed69.org/f/tt1270797',
  'https://vidhideplus.com/v/jwbzc2sk6vi4',
  'https://pelisplus.upns.pro/#pkaw9',
  'https://waaw.to/f/PsX7c4rIU7wF',
  'https://streamlare.com/e/XAQ9qzx1bgLl4mME'
];

async function test() {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  for (const url of urls) {
    console.log(`\nTesting ${url}`);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
      if (!res.ok) {
        console.log(`Failed to fetch: ${res.status}`);
        continue;
      }
      const html = await res.text();
      const directUrl = unpacker.extractDirectStream(html);
      
      if (directUrl) {
        console.log(`Success! Direct URL: ${directUrl}`);
      } else {
        console.log(`Failed to extract direct stream.`);
        // Try looking for other common patterns
        if (html.includes('m3u8')) {
          console.log(`Contains m3u8 in source!`);
        }
        if (html.includes('mp4')) {
          console.log(`Contains mp4 in source!`);
        }
        if (html.includes('eval(function(p,a,c,k,e,d)')) {
          console.log(`Contains packed JS!`);
        }
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

test();
