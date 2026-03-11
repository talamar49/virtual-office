// Agent static metadata — the source of truth for agent identities

export interface AgentMeta {
  id: string;
  name: string;
  role: string;
  emoji: string;
  channel: string;
}

const AGENTS: AgentMeta[] = [
  { id: 'main',    name: 'יוגי',  role: 'Main / GM',                        emoji: '🐻', channel: '#יוגי-main' },
  { id: 'omer',    name: 'עומר',  role: 'Tech Lead',                        emoji: '👨‍💻', channel: '#עומר-tech-lead' },
  { id: 'noa',     name: 'נועה',  role: 'Frontend Developer & UX/UI',       emoji: '🎨', channel: '#נועה-frontend-ux' },
  { id: 'itai',    name: 'איתי',  role: 'Backend Developer & API Architect', emoji: '🗄️', channel: '#איתי-backend-api' },
  { id: 'alon',    name: 'אלון',  role: 'Senior Full-Stack Developer',      emoji: '🧑‍💻', channel: '#אלון-fullstack' },
  { id: 'gil',     name: 'גיל',   role: 'DevOps Engineer',                  emoji: '⚙️', channel: '#גיל-devops' },
  { id: 'roni',    name: 'רוני',  role: 'Product Manager',                  emoji: '📋', channel: '#רוני-product' },
  { id: 'michal',  name: 'מיכל',  role: 'QA Lead',                          emoji: '🔍', channel: '#מיכל-qa' },
  { id: 'lior',    name: 'ליאור', role: 'Marketing & Growth',               emoji: '📈', channel: '#ליאור-marketing' },
  { id: 'tomer',   name: 'תומר',  role: 'Sales & Business Strategy',        emoji: '💼', channel: '#תומר-sales' },
  { id: 'dana',    name: 'דנה',   role: 'HR & People Manager',              emoji: '💜', channel: '#דנה-hr' },
  { id: 'ido',     name: 'עידו',  role: 'OpenClaw Expert',                  emoji: '🦞', channel: '#עידו-openclaw' },
  { id: 'monitor', name: 'שחר',   role: 'Monitor / Infra',                  emoji: '🛡️', channel: '#שחר-monitor' },
  { id: 'amir',    name: 'אמיר',  role: 'Game Artist',                      emoji: '🎮', channel: '#אמיר-art' },
];

/** Lookup map: agentId → AgentMeta */
export const AGENT_REGISTRY = new Map<string, AgentMeta>(
  AGENTS.map((a) => [a.id, a])
);

/** Get agent meta with fallback for unknown agents */
export function getAgentMeta(id: string): AgentMeta {
  return AGENT_REGISTRY.get(id) ?? {
    id,
    name: id,
    role: 'Unknown',
    emoji: '❓',
    channel: `#${id}`,
  };
}

/** All known agent IDs */
export function getAllAgentIds(): string[] {
  return AGENTS.map((a) => a.id);
}

export default AGENTS;
