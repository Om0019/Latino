const cheerio = require('cheerio');
fetch('https://www.cinecalidad.am/ver-serie/the-walking-dead/', {headers:{'User-Agent': 'Mozilla/5.0'}})
  .then(r=>r.text())
  .then(html=>{
    const $ = cheerio.load(html);
    $('a').each((i, el) => {
      const href = $(el).attr('href') || '';
      if(href.includes('/ver-el-episodio/')) {
        console.log('Episode link:', href);
      }
    });
  }).catch(console.error);
