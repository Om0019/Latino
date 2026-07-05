const app = require('./src/server');

const PORT = process.env.PORT || 7000;

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🌊 Flava Stremio Addon is running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔗 Manifest: http://localhost:${PORT}/manifest.json`);
  console.log(`==================================================`);
});
