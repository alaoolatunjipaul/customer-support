import * as db from '../data/db.js';

export function resolveAgentName(agentId: string | undefined): string {
  const agents = db.getAgents();
  if (agentId) {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) return agent.name;
  }
  return agents[0]?.name ?? 'Demo Agent';
}