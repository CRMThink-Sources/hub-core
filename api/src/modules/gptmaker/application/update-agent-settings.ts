import type { LocalAgent } from '../domain/entities/agent'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import type { Worktime } from '../domain/value-objects/worktime'
import type { ScopedAgentClient } from '../infra/clients/scoped-agent.client'

export type UpdateAgentSettingsDeps = {
  agents: AgentRepository
}

export type AgentSettingsPatch = {
  worktime?: Worktime
  exitOnCollaboratorJoin?: boolean
}

/**
 * Os ajustes que são **nossos**: janela de atendimento e saída do agente quando
 * um colaborador assume.
 *
 * Nada disso existe no vendor, então nenhuma chamada externa acontece aqui — o
 * cliente escopado entra só para provar a posse do agente antes da escrita.
 */
export async function updateAgentSettings(
  deps: UpdateAgentSettingsDeps,
  scoped: ScopedAgentClient,
  patch: AgentSettingsPatch,
): Promise<LocalAgent> {
  return deps.agents.update(scoped.local.id, {
    ...(patch.worktime ? { worktime: patch.worktime } : {}),
    ...(patch.exitOnCollaboratorJoin !== undefined
      ? { exitOnCollaboratorJoin: patch.exitOnCollaboratorJoin }
      : {}),
  })
}
