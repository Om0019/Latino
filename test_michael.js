const { getStreams } = require('./src/scrapers/index');

async function test() {
  console.log("Testing orchestrator with 'michael'...");
  // Using a mock ID or searching for it.
  // Michael (1996) or Michael (2025) or Michael (whatever year).
  // "Michael" might return multiple things.
  // If we just pass title="michael", getStreams takes an ID. 
  // We can pass a search term or a specific ID.
  // Actually, getStreams(type, id, season, episode)
  // We can just use the tmdb API to search for "Michael" and pass the ID.
  const tmdb = require('./src/tmdb');
  
  try {
    const results = await tmdb.searchCatalog('movie', 'michael');
    if (results.length > 0) {
      const targetId = results[0].id;
      console.log(`Found TMDB ID: ${targetId} for ${results[0].name}`);
      const streams = await getStreams('movie', targetId, null, null);
      
      console.log(`Total Streams found: ${streams.length}`);
      
      let failedExtractions = 0;
      streams.forEach((s, idx) => {
        if (s.externalUrl) {
          failedExtractions++;
          console.log(`[!] Failed Extraction (Wrong Format): ${s.title}`);
          console.log(`    URL: ${s.externalUrl}`);
        } else if (s.url) {
          console.log(`[+] Success (Direct Stream): ${s.title}`);
          console.log(`    URL: ${s.url}`);
        }
      });
      
      console.log(`\nFailed Extractions (External URLs): ${failedExtractions}`);
    } else {
      console.log("No results for 'michael' in TMDB.");
    }
  } catch (err) {
    console.error(err);
  }
}
test();
