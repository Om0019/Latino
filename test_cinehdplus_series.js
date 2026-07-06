const cheerio = require('cheerio');
fetch('https://cinehdplus.biz/series/?story=la+casa+del+dragon&do=search&subaction=search', {headers:{'User-Agent': 'Mozilla/5.0'}})
  .then(r=>r.text())
  .then(html=>{
    const $ = cheerio.load(html);
    $('.card__title a').each((i, el) => {
      console.log('Found:', $(el).attr('href'), $(el).text().trim());
    });
  }).catch(console.error);
