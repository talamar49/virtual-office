import { useState, useEffect, useRef } from 'react';

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

export function useAgentStatuses(): AgentStatus[] {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'full-state' && Array.isArray(data.agents)) {
            setAgents(data.agents);
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        console.log('WS disconnected, reconnecting in 3s...');
        setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WS error:', err);
        ws.close();
      };
    }

    connect();

    return () => {
      wsRef.current?.close();
    };
  }, []);

  return agents;
}
