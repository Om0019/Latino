const cheerio = require('cheerio');
const title = 'Rick y Morty';
const searchUrl = 'https://tioplus.app/buscar?q=' + encodeURIComponent(title);
fetch(searchUrl, {headers:{'User-Agent': 'Mozilla/5.0'}}).then(r=>r.text()).then(html=>{
  const $ = cheerio.load(html);
  $('a').each((i, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('/pelicula/') || href.includes('/serie/')) {
      console.log('Found:', href, $(el).text().trim().replace(/\s+/g, ' '));
    }
  });
}).catch(console.error);
