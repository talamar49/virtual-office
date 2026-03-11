import React, { useEffect, useState } from 'react';
import { Office } from './components/Office';
import { useAgentStatuses, AgentStatus } from './hooks/useAgentStatuses';

export function App() {
  const agents = useAgentStatuses();

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Office agents={agents} />
    </div>
  );
}
