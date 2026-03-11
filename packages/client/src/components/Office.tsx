import React, { useRef, useEffect } from 'react';
import { AgentStatus } from '../hooks/useAgentStatuses';

// Placeholder Office component — will be replaced with PixiJS canvas
// This is a simple CSS grid version to validate data flow

interface OfficeProps {
  agents: AgentStatus[];
}

const STATUS_COLORS = {
  active: '#4ade80',
  idle: '#facc15',
  offline: '#6b7280',
};

export function Office({ agents }: OfficeProps) {
  if (agents.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '1.5rem',
      }}>
        🏢 Loading Virtual Office...
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: '16px',
      padding: '24px',
      height: '100%',
      overflowY: 'auto',
      fontFamily: 'monospace',
    }}>
      {agents.map((agent) => (
        <div
          key={agent.id}
          style={{
            background: '#16213e',
            border: `2px solid ${STATUS_COLORS[agent.status]}`,
            borderRadius: '12px',
            padding: '16px',
            color: '#fff',
          }}
        >
          <div style={{ fontSize: '2rem', textAlign: 'center' }}>
            {agent.emoji}
          </div>
          <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '8px 0' }}>
            {agent.name}
          </div>
          <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
            {agent.role}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            marginTop: '8px',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: STATUS_COLORS[agent.status],
            }} />
            <span style={{ fontSize: '0.75rem', color: STATUS_COLORS[agent.status] }}>
              {agent.status}
            </span>
          </div>
          {agent.lastMessage && (
            <div style={{
              marginTop: '8px',
              fontSize: '0.7rem',
              color: '#64748b',
              maxHeight: '40px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {agent.lastMessage.substring(0, 80)}...
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
