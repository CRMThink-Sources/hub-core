import type { AgentRepository } from '../domain/repositories/agent.repository'
import type { ScopedAgentClient } from '../infra/clients/scoped-agent.client'

export type DeleteAgentDeps = {
  agents: AgentRepository
}

/**
 * Exclui o agente no vendor e só então remove a linha local.
 *
 * A ordem é o ponto: se a linha local sumisse primeiro e a exclusão remota
 * falhasse, o agente continuaria vivo no workspace compartilhado, cobrando, e
 * sem nada apontando para ele. Falhar deixando o agente listado é o desfecho
 * ruim que ainda é rastreável.
 */
export async function deleteAgent(
  deps: DeleteAgentDeps,
  scoped: ScopedAgentClient,
): Promise<void> {
  await scoped.remove()

  await deps.agents.delete(scoped.local.id)
}
