const unpacker = require('./src/unpacker');
const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function test() {
    console.log("Resolving embed69...");
    const url = await unpacker.resolvePlayerStream('https://embed69.org/f/tt1270797', userAgent, 'https://sololatino.net/');
    console.log("Resolved URL:", url);
}
test();
