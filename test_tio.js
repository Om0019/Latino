const cheerio = require('cheerio');
const title = 'Rick and Morty';
const searchUrl = 'https://tioplus.app/api/search/' + encodeURIComponent(title);
fetch(searchUrl, {headers:{'User-Agent': 'Mozilla/5.0', 'x-requested-with': 'XMLHttpRequest'}})
  .then(r=>r.text())
  .then(html=>{
    console.log('HTML length:', html.length);
    if(html.length < 500) console.log(html);
    const $ = cheerio.load(html);
    $('a').each((i, el) => {
      console.log('Found:', $(el).attr('href'), $(el).text().trim().replace(/\s+/g, ' '));
    });
  }).catch(console.error);
