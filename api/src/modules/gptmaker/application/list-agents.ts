import type { Logger } from 'pino'
import type { Agent } from '../domain/entities/agent'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import { logGptmakerError } from '../errors/catalog'
import type { ScopedAgentClient } from '../infra/clients/scoped-agent.client'

export type ListAgentsDeps = {
  agents: AgentRepository
  logger: Logger
  /**
   * Constrói o cliente escopado de um agente já resolvido. Recebido como
   * função para que este caso de uso não precise do client cru — ele lista a
   * partir do banco e só hidrata o que já tem dono.
   */
  scopeTo: (
    appId: string,
    gptMakerAgentId: string,
  ) => Promise<ScopedAgentClient>
}

/**
 * Os agentes de uma instalação.
 *
 * A lista sai de `core_gpt_agents`, **nunca** de
 * `GET /v2/workspace/{id}/agents`: o workspace é compartilhado e aquele
 * endpoint devolveria os agentes de todos os clientes.
 *
 * A hidratação no vendor é por agente e tolerante a falha. Uma indisponibilidade
 * do terceiro deixa a lista sem os dados de perfil, mas não derruba a tela —
 * que é justamente onde o cliente vê quantos agentes tem e qual bot está
 * vinculado, tudo isso vindo do nosso banco.
 */
export async function listAgents(
  deps: ListAgentsDeps,
  appId: string,
): Promise<Agent[]> {
  const locals = await deps.agents.listByApp(appId)

  return Promise.all(
    locals.map(async local => {
      try {
        const scoped = await deps.scopeTo(appId, local.gptMakerAgentId)
        const vendor = await scoped.fetch()

        return vendor ? { ...local, vendor } : local
      } catch (error) {
        logGptmakerError(
          deps.logger,
          'gptmaker.agent.update_failed',
          { gptMakerAgentId: local.gptMakerAgentId, appId, error },
          { msg: 'Agente não pôde ser hidratado; listado só com dados locais' },
        )

        return local
      }
    }),
  )
}
