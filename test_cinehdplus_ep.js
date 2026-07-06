const cheerio = require('cheerio');
fetch('https://cinehdplus.biz/series-tv-58442/la-casa-del-dragon/', {headers:{'User-Agent': 'Mozilla/5.0'}})
  .then(r=>r.text())
  .then(html=>{
    const $ = cheerio.load(html);
    console.log('Title:', $('h1').text().trim());
    console.log('Player items:', $('[data-num]').length);
    let items = [];
    $('[data-num]').each((i, el) => {
      items.push($(el).attr('data-num'));
    });
    console.log('SeasonsxEpisodes:', items.slice(0,5));
  }).catch(console.error);
