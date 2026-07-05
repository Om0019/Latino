const { scrape: scrapeCinecalidad } = require('./src/scrapers/cinecalidad');
const { scrape: scrapeSoloLatino } = require('./src/scrapers/sololatino');
const { scrape: scrapeTioPlus } = require('./src/scrapers/tioplus');

async function test() {
  console.log("Testing Cinecalidad...");
  const cStreams = await scrapeCinecalidad('venom', null, 'movie');
  console.log("Cinecalidad External URLs:", cStreams.filter(s => s.externalUrl).map(s => s.externalUrl));

  console.log("\nTesting SoloLatino...");
  const sStreams = await scrapeSoloLatino('venom', null, 'movie');
  console.log("SoloLatino External URLs:", sStreams.filter(s => s.externalUrl).map(s => s.externalUrl));

  console.log("\nTesting TioPlus...");
  const tStreams = await scrapeTioPlus('venom', null, 'movie');
  console.log("TioPlus External URLs:", tStreams.filter(s => s.externalUrl).map(s => s.externalUrl));
}
test();
