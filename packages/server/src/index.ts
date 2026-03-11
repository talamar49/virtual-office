import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { fetchAgentStatuses, AgentStatus } from './gateway.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

app.use(cors());
app.use(express.json());

// HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

// Connected clients
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[WS] Client connected (${clients.size} total)`);
  
  // Send current state immediately
  sendCurrentState(ws);
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[WS] Client disconnected (${clients.size} total)`);
  });
});

// Broadcast to all clients
function broadcast(data: object) {
  const message = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

// Send current state to a single client
async function sendCurrentState(ws: WebSocket) {
  try {
    const agents = await fetchAgentStatuses();
    ws.send(JSON.stringify({ type: 'full-state', agents }));
  } catch (err) {
    console.error('[Gateway] Failed to fetch state:', err);
  }
}

// Poll Gateway every 10 seconds and broadcast updates
let lastState: AgentStatus[] = [];

async function pollAndBroadcast() {
  try {
    const agents = await fetchAgentStatuses();
    
    // Simple diff: broadcast if anything changed
    const stateJson = JSON.stringify(agents);
    if (stateJson !== JSON.stringify(lastState)) {
      lastState = agents;
      broadcast({ type: 'full-state', agents });
    }
  } catch (err) {
    console.error('[Gateway] Poll error:', err);
  }
}

setInterval(pollAndBroadcast, 10_000);

// REST endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', clients: clients.size });
});

app.get('/api/agents', async (_req, res) => {
  try {
    const agents = await fetchAgentStatuses();
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent statuses' });
  }
});

server.listen(PORT, () => {
  console.log(`🏢 Virtual Office server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket available at ws://localhost:${PORT}/ws`);
});
