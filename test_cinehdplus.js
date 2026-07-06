const cheerio = require('cheerio');
const title = 'la casa del dragon';
const searchUrl = 'https://cinehdplus.biz/index.php?do=search&subaction=search&story=' + encodeURIComponent(title);
fetch(searchUrl, {headers:{'User-Agent': 'Mozilla/5.0'}})
  .then(r=>r.text())
  .then(html=>{
    const $ = cheerio.load(html);
    $('.card__title a').each((i, el) => {
      console.log('Found:', $(el).attr('href'), $(el).text().trim());
    });
  }).catch(console.error);
