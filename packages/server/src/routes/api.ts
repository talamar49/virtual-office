/**
 * REST API Routes
 */

import { Router } from 'express';
import { getFullState, getAgentStatus, getPollerStats } from '../services/status-poller.js';
import { getRecentActivity, getAgentActivity } from '../services/activity-log.js';
import { checkGatewayHealth, getCircuitStatus } from '../services/gateway-client.js';
import { getClientCount } from '../ws/handler.js';
import { getAgentMeta, AGENT_REGISTRY } from '../config/agents.js';

export const apiRouter: ReturnType<typeof Router> = Router();

/**
 * GET /api/health
 * Full health check including Gateway connectivity
 */
apiRouter.get('/health', async (_req, res) => {
  try {
    const gateway = await checkGatewayHealth();
    const poller = getPollerStats();
    const circuit = getCircuitStatus();

    res.json({
      status: gateway.ok ? 'ok' : 'degraded',
      uptime: process.uptime(),
      wsClients: getClientCount(),
      gateway: {
        connected: gateway.ok,
        latencyMs: gateway.latencyMs,
        circuit,
      },
      poller,
    });
  } catch (err) {
    res.status(503).json({
      status: 'error',
      error: (err as Error).message,
    });
  }
});

/**
 * GET /api/agents
 * List all agents with current status
 */
apiRouter.get('/agents', (_req, res) => {
  try {
    const agents = getFullState();
    res.json({
      count: agents.length,
      agents,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch agent statuses' });
  }
});

/**
 * GET /api/agents/:id
 * Detailed info for a single agent
 */
apiRouter.get('/agents/:id', (req, res) => {
  const { id } = req.params;

  // Check if agent exists in registry
  const meta = getAgentMeta(id);
  if (!AGENT_REGISTRY.has(id)) {
    res.status(404).json({ error: `Agent '${id}' not found` });
    return;
  }

  const status = getAgentStatus(id);
  const activity = getAgentActivity(id, 20);

  res.json({
    agent: meta,
    currentStatus: status ?? {
      state: 'offline',
      lastActivity: null,
      lastMessage: null,
      model: null,
      tokenUsage: 0,
      sessionKey: null,
    },
    recentActivity: activity,
  });
});

/**
 * GET /api/agents/:id/activity
 * Activity history for a specific agent
 */
apiRouter.get('/agents/:id/activity', (req, res) => {
  const { id } = req.params;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  if (!AGENT_REGISTRY.has(id)) {
    res.status(404).json({ error: `Agent '${id}' not found` });
    return;
  }

  const activity = getAgentActivity(id, limit);
  res.json({ agentId: id, count: activity.length, events: activity });
});

/**
 * GET /api/activity
 * Global activity feed
 */
apiRouter.get('/activity', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const events = getRecentActivity(limit);
  res.json({ count: events.length, events });
});
