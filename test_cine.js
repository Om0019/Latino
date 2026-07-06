const cheerio = require('cheerio');
const title = 'the walking dead';
const searchUrl = 'https://www.cinecalidad.am/?s=' + encodeURIComponent(title);
fetch(searchUrl, {headers:{'User-Agent': 'Mozilla/5.0'}})
  .then(r=>r.text())
  .then(html=>{
    const $ = cheerio.load(html);
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      if(href.includes('the-walking-dead') && !href.includes('gratis-en-cinecalidad')) {
        console.log('Found:', href, $(el).text().trim().replace(/\s+/g, ' '));
      }
    });
  }).catch(console.error);
