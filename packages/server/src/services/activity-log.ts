/**
 * In-memory Activity Log
 * 
 * Tracks agent state changes and events.
 * Ring buffer with configurable max size.
 */

export interface ActivityEvent {
  agentId: string;
  type: 'state-change' | 'message' | 'error';
  from?: string;
  to?: string;
  detail?: string;
  timestamp: number;
}

const MAX_EVENTS = 500;
const MAX_PER_AGENT = 50;

const globalLog: ActivityEvent[] = [];

/**
 * Record an activity event
 */
export function recordActivity(event: ActivityEvent): void {
  globalLog.push(event);

  // Trim global log
  if (globalLog.length > MAX_EVENTS) {
    globalLog.splice(0, globalLog.length - MAX_EVENTS);
  }
}

/**
 * Get recent activity events
 */
export function getRecentActivity(limit = 50): ActivityEvent[] {
  return globalLog.slice(-limit);
}

/**
 * Get activity for a specific agent
 */
export function getAgentActivity(agentId: string, limit = MAX_PER_AGENT): ActivityEvent[] {
  return globalLog
    .filter((e) => e.agentId === agentId)
    .slice(-limit);
}

/**
 * Clear all activity (for testing)
 */
export function clearActivity(): void {
  globalLog.length = 0;
}
