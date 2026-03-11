// Gateway integration — fetches agent statuses from OpenClaw

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:18789';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '';

export interface AgentStatus {
  id: string;
  name: string;
  role: string;
  emoji: string;
  status: 'active' | 'idle' | 'offline';
  lastActivity: string | null;
  lastMessage: string | null;
  model: string | null;
  tokenUsage: number;
  sessionKey: string | null;
}

// Agent metadata (static — matches the spec)
const AGENT_META: Record<string, { name: string; role: string; emoji: string }> = {
  main:    { name: 'יוגי',  role: 'Main / GM',       emoji: '🐻' },
  omer:    { name: 'עומר',  role: 'Tech Lead',        emoji: '👨‍💻' },
  noa:     { name: 'נועה',  role: 'Frontend/UX',      emoji: '🎨' },
  itai:    { name: 'איתי',  role: 'Backend/API',      emoji: '🗄️' },
  michal:  { name: 'מיכל',  role: 'QA Lead',          emoji: '🔍' },
  gil:     { name: 'גיל',   role: 'DevOps',           emoji: '⚙️' },
  roni:    { name: 'רוני',  role: 'Product Manager',  emoji: '📋' },
  dana:    { name: 'דנה',   role: 'HR',               emoji: '💜' },
  lior:    { name: 'ליאור', role: 'Marketing',        emoji: '📈' },
  tomer:   { name: 'תומר',  role: 'Sales',            emoji: '💼' },
  monitor: { name: 'שחר',   role: 'Monitor/Infra',    emoji: '🛡️' },
  amir:    { name: 'אמיר',  role: 'Game Artist',      emoji: '🎮' },
  alon:    { name: 'אלון',  role: 'Creative',         emoji: '🎵' },
  ido:     { name: 'עידו',  role: 'OpenClaw Dev',     emoji: '🔧' },
};

export async function fetchAgentStatuses(): Promise<AgentStatus[]> {
  const res = await fetch(`${GATEWAY_URL}/tools/invoke`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY_TOKEN ? { 'Authorization': `Bearer ${GATEWAY_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      tool: 'sessions_list',
      params: { activeMinutes: 120, messageLimit: 1 },
    }),
  });

  if (!res.ok) {
    throw new Error(`Gateway responded ${res.status}`);
  }

  const data = await res.json();
  const sessions = data.sessions || data.result?.sessions || [];

  // Map sessions to agent statuses
  const agentMap = new Map<string, AgentStatus>();

  for (const session of sessions) {
    // Extract agent id from session key (e.g. "agent:omer:discord:...")
    const keyParts = (session.key || '').split(':');
    const agentId = keyParts[1] || 'unknown';
    
    // Skip if we already have a more recent entry for this agent
    if (agentMap.has(agentId)) {
      const existing = agentMap.get(agentId)!;
      if (existing.lastActivity && session.updatedAt <= new Date(existing.lastActivity).getTime()) {
        continue;
      }
    }

    const meta = AGENT_META[agentId] || { name: agentId, role: 'Unknown', emoji: '❓' };
    const updatedAt = session.updatedAt ? new Date(session.updatedAt).toISOString() : null;
    
    // Determine status based on last activity
    const minutesAgo = session.updatedAt 
      ? (Date.now() - session.updatedAt) / 60_000 
      : Infinity;

    let status: 'active' | 'idle' | 'offline' = 'offline';
    if (minutesAgo < 5) status = 'active';
    else if (minutesAgo < 30) status = 'idle';

    // Extract last message text
    let lastMessage: string | null = null;
    if (session.messages?.[0]?.content) {
      const content = session.messages[0].content;
      if (typeof content === 'string') {
        lastMessage = content.substring(0, 200);
      } else if (Array.isArray(content)) {
        const textBlock = content.find((b: any) => b.type === 'text');
        if (textBlock) lastMessage = textBlock.text?.substring(0, 200) || null;
      }
    }

    agentMap.set(agentId, {
      id: agentId,
      name: meta.name,
      role: meta.role,
      emoji: meta.emoji,
      status,
      lastActivity: updatedAt,
      lastMessage,
      model: session.model || null,
      tokenUsage: session.totalTokens || 0,
      sessionKey: session.key || null,
    });
  }

  // Add offline entries for agents not in active sessions
  for (const [id, meta] of Object.entries(AGENT_META)) {
    if (!agentMap.has(id)) {
      agentMap.set(id, {
        id,
        name: meta.name,
        role: meta.role,
        emoji: meta.emoji,
        status: 'offline',
        lastActivity: null,
        lastMessage: null,
        model: null,
        tokenUsage: 0,
        sessionKey: null,
      });
    }
  }

  return Array.from(agentMap.values());
}
