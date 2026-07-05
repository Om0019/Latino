const { getStreams } = require('./src/scrapers/index');

async function testPerformance() {
    console.time('GetStreams (Avengers: Endgame)');
    await getStreams('movie', '299534', 'tt4154796', undefined, undefined, 'Avengers: Endgame', 2019);
    console.timeEnd('GetStreams (Avengers: Endgame)');
    
    console.time('GetStreams (Deadpool & Wolverine)');
    await getStreams('movie', '533535', 'tt6263850', undefined, undefined, 'Deadpool & Wolverine', 2024);
    console.timeEnd('GetStreams (Deadpool & Wolverine)');
}

testPerformance();
