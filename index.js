const http = require('http');
const app = require('./src/server');

const PORT = process.env.PORT || 7000;

const server = http.createServer(app);

server.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`Latino Stremio Addon is running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔗 Manifest: http://localhost:${PORT}/manifest.json`);
  console.log(`==================================================`);
});
