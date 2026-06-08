const http = require('http');
const app = require('./app');
const connectToDatabase = require('./src/config/database');
const initWebSocket = require('./src/services/websocket.service');
const settings = require('./src/config/settings');

const PORT = settings.PORT || 5000;

const startServer = async () => {
  // Connect to database with retry logic
  await connectToDatabase();

  // Create HTTP server wrapping Express app
  const server = http.createServer(app);

  // Initialize and attach WebSocket server
  initWebSocket(server);

  // Start listening
  server.listen(PORT, () => {
    console.log(`🚀 ChatWave Server listening on port ${PORT} in ${settings.NODE_ENV} mode.`);
  });
};

startServer().catch(err => {
  console.error('💥 Failed to start ChatWave server:', err);
  process.exit(1);
});
