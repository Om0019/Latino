const { scrape } = require('./src/scrapers/cinecalidad');

async function run() {
  console.log("Testing Cinecalidad...");
  const streams = await scrape('the sheep', null, 'movie', null, null);
  console.log("Result:", JSON.stringify(streams, null, 2));
}
run();
