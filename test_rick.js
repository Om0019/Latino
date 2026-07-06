const { getStreams } = require('./src/scrapers/index');
const tmdb = require('./src/tmdb');

async function test() {
  console.log("Testing orchestrator with 'rick and morty s1e1'...");
  
  try {
    const results = await tmdb.searchCatalog('series', 'rick and morty');
    if (results.length > 0) {
      const targetId = results[0].id;
      console.log(`Found TMDB ID: ${targetId} for ${results[0].name}`);
      const streams = await getStreams('series', targetId, 1, 1);
      
      console.log(`Total Streams found: ${streams.length}`);
      
      let failedExtractions = 0;
      streams.forEach((s, idx) => {
        if (s.externalUrl) {
          failedExtractions++;
          console.log(`[!] Failed Extraction (Wrong Format): ${s.title}`);
          console.log(`    URL: ${s.externalUrl}`);
        } else if (s.url) {
          console.log(`[+] Success (Direct Stream): ${s.name} - ${s.title}`);
          console.log(`    URL: ${s.url}`);
        }
      });
      
      console.log(`\nFailed Extractions (External URLs): ${failedExtractions}`);
    } else {
      console.log("No results for 'rick and morty' in TMDB.");
    }
  } catch (err) {
    console.error(err);
  }
}
test();
