/**
 * Adaptive Status Poller
 * 
 * Polls the Gateway for agent statuses with adaptive interval:
 * - Faster when changes are detected (min 2s)
 * - Slower during quiet periods (max 15s)
 * - Broadcasts diffs via callback
 */

import { fetchSessions } from './gateway-client.js';
import { getAgentMeta, getAllAgentIds } from '../config/agents.js';
import { recordActivity } from './activity-log.js';

// --- Types ---

export type AgentState = 'active' | 'working' | 'thinking' | 'talking' | 'idle' | 'away' | 'offline';

export interface AgentStatus {
  id: string;
  name: string;
  role: string;
  emoji: string;
  channel: string;
  state: AgentState;
  lastActivity: string | null;
  lastMessage: {
    role: string;
    preview: string;
    timestamp: string;
  } | null;
  model: string | null;
  tokenUsage: number;
  sessionKey: string | null;
}

export interface StatusUpdate {
  agentId: string;
  changes: Partial<AgentStatus>;
  previousState?: AgentState;
}

type BroadcastFn = (type: string, data: unknown) => void;

// --- Poller ---

const MIN_INTERVAL = 2_000;
const MAX_INTERVAL = 15_000;
const INTERVAL_STEP = 1_000;

let currentInterval = 5_000;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let isRunning = false;
let broadcastFn: BroadcastFn | null = null;

/** Current state map: agentId → AgentStatus */
const stateMap = new Map<string, AgentStatus>();

/**
 * Derive agent state from session data
 */
function deriveState(session: any): AgentState {
  const age = Date.now() - (session.updatedAt ?? 0);

  if (!session.updatedAt) return 'offline';

  // Active within last 30 seconds
  if (age < 30_000) {
    const lastMsg = session.messages?.[0];
    if (lastMsg?.role === 'assistant') {
      // Check for tool calls or thinking
      const content = lastMsg.content;
      if (Array.isArray(content)) {
        if (content.some((b: any) => b.type === 'tool_use' || b.type === 'toolCall')) return 'working';
        if (content.some((b: any) => b.type === 'thinking')) return 'thinking';
      }
      return 'active';
    }
    if (lastMsg?.role === 'user') return 'talking';
    return 'active';
  }

  if (age < 5 * 60_000) return 'idle';       // < 5 min
  if (age < 60 * 60_000) return 'away';       // < 1 hour
  return 'offline';
}

/**
 * Extract last message preview from session
 */
function extractLastMessage(session: any): AgentStatus['lastMessage'] {
  const msg = session.messages?.[0];
  if (!msg?.content) return null;

  let preview = '';
  const content = msg.content;
  if (typeof content === 'string') {
    preview = content;
  } else if (Array.isArray(content)) {
    const textBlock = content.find((b: any) => b.type === 'text');
    preview = textBlock?.text ?? '';
  }

  return {
    role: msg.role ?? 'unknown',
    preview: preview.substring(0, 200),
    timestamp: msg.timestamp ? new Date(msg.timestamp).toISOString() : new Date().toISOString(),
  };
}

/**
 * Build AgentStatus from a Gateway session
 */
function buildStatus(agentId: string, session: any | null): AgentStatus {
  const meta = getAgentMeta(agentId);

  if (!session) {
    return {
      ...meta,
      state: 'offline',
      lastActivity: null,
      lastMessage: null,
      model: null,
      tokenUsage: 0,
      sessionKey: null,
    };
  }

  return {
    ...meta,
    state: deriveState(session),
    lastActivity: session.updatedAt ? new Date(session.updatedAt).toISOString() : null,
    lastMessage: extractLastMessage(session),
    model: session.model ?? null,
    tokenUsage: session.totalTokens ?? 0,
    sessionKey: session.key ?? null,
  };
}

/**
 * Compute diffs between old and new state
 */
function computeDiffs(oldStatus: AgentStatus, newStatus: AgentStatus): Partial<AgentStatus> | null {
  const changes: Partial<AgentStatus> = {};
  let hasChanges = false;

  const keys: (keyof AgentStatus)[] = ['state', 'lastActivity', 'model', 'tokenUsage', 'sessionKey'];
  for (const key of keys) {
    if (oldStatus[key] !== newStatus[key]) {
      (changes as any)[key] = newStatus[key];
      hasChanges = true;
    }
  }

  // Check lastMessage separately (object comparison)
  if (JSON.stringify(oldStatus.lastMessage) !== JSON.stringify(newStatus.lastMessage)) {
    changes.lastMessage = newStatus.lastMessage;
    hasChanges = true;
  }

  return hasChanges ? changes : null;
}

/**
 * Single poll cycle
 */
async function pollCycle(): Promise<void> {
  try {
    const sessions = await fetchSessions(120);

    // Group sessions by agent, keeping the most recent
    const sessionByAgent = new Map<string, any>();
    for (const session of sessions) {
      const keyParts = (session.key || '').split(':');
      const agentId = keyParts[1] || 'unknown';

      const existing = sessionByAgent.get(agentId);
      if (!existing || (session.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
        sessionByAgent.set(agentId, session);
      }
    }

    // Build new statuses and compute diffs
    const updates: StatusUpdate[] = [];
    const allAgentIds = new Set([...getAllAgentIds(), ...sessionByAgent.keys()]);

    for (const agentId of allAgentIds) {
      const session = sessionByAgent.get(agentId) ?? null;
      const newStatus = buildStatus(agentId, session);
      const oldStatus = stateMap.get(agentId);

      if (!oldStatus) {
        // First time seeing this agent
        stateMap.set(agentId, newStatus);
        continue;
      }

      const diff = computeDiffs(oldStatus, newStatus);
      if (diff) {
        // Log state transitions to activity log
        if (diff.state && diff.state !== oldStatus.state) {
          recordActivity({
            agentId,
            type: 'state-change',
            from: oldStatus.state,
            to: diff.state,
            timestamp: Date.now(),
          });
        }

        updates.push({
          agentId,
          changes: diff,
          previousState: oldStatus.state,
        });

        stateMap.set(agentId, newStatus);
      }
    }

    // Adjust polling interval based on activity
    if (updates.length > 0) {
      currentInterval = Math.max(MIN_INTERVAL, currentInterval - INTERVAL_STEP);
      broadcastFn?.('agent:update', updates);
    } else {
      currentInterval = Math.min(MAX_INTERVAL, currentInterval + INTERVAL_STEP);
    }
  } catch (err) {
    console.error('[Poller] Poll cycle failed:', (err as Error).message);
    // Back off on errors
    currentInterval = Math.min(MAX_INTERVAL, currentInterval + INTERVAL_STEP * 2);
  }
}

/**
 * Schedule the next poll
 */
function scheduleNext(): void {
  if (!isRunning) return;
  pollTimer = setTimeout(async () => {
    await pollCycle();
    scheduleNext();
  }, currentInterval);
}

// --- Public API ---

/**
 * Start the adaptive poller
 */
export function startPoller(broadcast: BroadcastFn): void {
  if (isRunning) return;
  broadcastFn = broadcast;
  isRunning = true;
  console.log(`[Poller] Started with adaptive interval (${MIN_INTERVAL}-${MAX_INTERVAL}ms)`);

  // Run first poll immediately
  pollCycle().then(() => scheduleNext());
}

/**
 * Stop the poller (for graceful shutdown)
 */
export function stopPoller(): void {
  isRunning = false;
  if (pollTimer) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
  console.log('[Poller] Stopped');
}

/**
 * Get current full state (for new WS connections)
 */
export function getFullState(): AgentStatus[] {
  // If state is empty, initialize with offline agents
  if (stateMap.size === 0) {
    for (const id of getAllAgentIds()) {
      stateMap.set(id, buildStatus(id, null));
    }
  }
  return Array.from(stateMap.values());
}

/**
 * Get a single agent's status
 */
export function getAgentStatus(agentId: string): AgentStatus | null {
  return stateMap.get(agentId) ?? null;
}

/**
 * Get current polling interval (for diagnostics)
 */
export function getPollerStats() {
  return {
    isRunning,
    currentIntervalMs: currentInterval,
    trackedAgents: stateMap.size,
  };
}
