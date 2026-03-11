/**
 * Virtual Office — Backend Server
 * 
 * Express + WebSocket server that proxies OpenClaw Gateway data
 * to the frontend with adaptive polling and real-time updates.
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { apiRouter } from './routes/api.js';
import { initWebSocket, broadcast, closeAllConnections } from './ws/handler.js';
import { startPoller, stopPoller } from './services/status-poller.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api', apiRouter);

// --- HTTP Server ---
const server = createServer(app);

// --- WebSocket ---
initWebSocket(server);

// --- Start Polling ---
startPoller(broadcast);

// --- Start Listening ---
server.listen(PORT, () => {
  console.log(`🏢 Virtual Office server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket available at ws://localhost:${PORT}/ws`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`👥 Agents API: http://localhost:${PORT}/api/agents`);
});

// --- Graceful Shutdown ---

let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n[Shutdown] Received ${signal}. Shutting down gracefully...`);

  // 1. Stop accepting new connections
  server.close(() => {
    console.log('[Shutdown] HTTP server closed');
  });

  // 2. Stop the poller
  stopPoller();

  // 3. Close all WebSocket connections
  closeAllConnections();

  // 4. Give pending requests time to finish
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  console.log('[Shutdown] Cleanup complete. Exiting.');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught exception:', err);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Fatal] Unhandled rejection:', reason);
  // Don't exit on unhandled rejections — log and continue
});
