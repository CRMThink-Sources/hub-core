import type { AgentRepository } from '../domain/repositories/agent.repository'
import type { GptMakerClient } from '../infra/clients/gptmaker.client'

export type ReconcileAgentsDeps = {
  agents: AgentRepository
  client: GptMakerClient
}

export type ReconciliationReport = {
  /** Existe no workspace e nenhuma instalação o reivindica. */
  orphanedInVendor: Array<{ gptMakerAgentId: string; name: string }>
  /** Existe em `core_gpt_agents` e não está mais no workspace. */
  orphanedInDatabase: Array<{
    id: string
    appId: string
    gptMakerAgentId: string
  }>
}

/**
 * Compara o workspace compartilhado com `core_gpt_agents`.
 *
 * É a rede que cobre o que a compensação da criação não pegou: processo morto
 * entre criar no vendor e gravar no banco, ou falha da própria compensação.
 *
 * **Relata e não apaga.** Um agente sem linha local pode ser lixo de uma
 * criação interrompida ou pode ser sintoma de um bug de escrita — apagar
 * automaticamente destruiria a evidência junto com o problema, e num workspace
 * compartilhado o que se apaga é o agente de um cliente pagante.
 */
export async function reconcileAgents(
  deps: ReconcileAgentsDeps,
): Promise<ReconciliationReport> {
  const [vendorAgents, localAgents] = await Promise.all([
    deps.client.listWorkspaceAgents(),
    deps.agents.listAll(),
  ])

  const claimed = new Set(localAgents.map(local => local.gptMakerAgentId))
  const inVendor = new Set(vendorAgents.map(agent => agent.id))

  return {
    orphanedInVendor: vendorAgents
      .filter(agent => !claimed.has(agent.id))
      .map(agent => ({ gptMakerAgentId: agent.id, name: agent.name })),

    orphanedInDatabase: localAgents
      .filter(local => !inVendor.has(local.gptMakerAgentId))
      .map(local => ({
        id: local.id,
        appId: local.appId,
        gptMakerAgentId: local.gptMakerAgentId,
      })),
  }
}
