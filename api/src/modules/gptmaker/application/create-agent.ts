import type { Logger } from 'pino'
import type { Agent, CreateAgentInput } from '../domain/entities/agent'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import { gptmakerError, logGptmakerError } from '../errors/catalog'
import { MAX_AGENTS_PER_APP } from '../gptmaker.constants'
import type { GptMakerClient } from '../infra/clients/gptmaker.client'

export type CreateAgentDeps = {
  agents: AgentRepository
  client: GptMakerClient
  logger: Logger
}

/**
 * Cria o agente no workspace compartilhado e o associa à instalação.
 *
 * A ordem importa. O teto é conferido **antes** de qualquer chamada ao vendor,
 * para que uma criação recusada nunca gere um agente que precise ser
 * compensado. E a gravação local vem logo depois da criação remota, porque a
 * janela entre as duas é o único momento em que existe um agente sem dono.
 */
export async function createAgent(
  deps: CreateAgentDeps,
  appId: string,
  input: CreateAgentInput,
): Promise<Agent> {
  const existing = await deps.agents.countByApp(appId)

  if (existing >= MAX_AGENTS_PER_APP) {
    throw gptmakerError('gptmaker.agent.limit_reached')
  }

  // O nome vai ao vendor exatamente como o usuário digitou. Prefixar com
  // domínio ou id da instalação identificaria o dono no painel do vendor, mas
  // o nome é conteúdo: o agente se apresenta ao cliente final com ele.
  const created = await deps.client.createAgent(input)

  let local
  try {
    local = await deps.agents.create({
      appId,
      gptMakerAgentId: created.id,
      name: created.name ?? input.name,
    })
  } catch (persistError) {
    // O agente já existe no workspace e nada o associa a ninguém: sem a
    // compensação ele fica vivo, cobrando, e invisível para nós.
    await compensate(deps, appId, created.id)

    throw gptmakerError('gptmaker.agent.create_failed', persistError)
  }

  // Feito depois da gravação, e não junto da criação, porque o endpoint de
  // criação do vendor não aceita estes dois campos. Falhar aqui não desfaz o
  // agente: ele existe, está associado, e só ficou com os defaults.
  const vendor = await applyFieldsCreateDoesNotAccept(deps, created.id, input)

  return { ...local, vendor: vendor ?? created }
}

/**
 * `communicationType` e `type` só existem no `PUT`. Um agente com os defaults é
 * um agente utilizável — perder o agente inteiro porque o ajuste fino falhou
 * seria pior do que entregá-lo assim.
 */
async function applyFieldsCreateDoesNotAccept(
  deps: CreateAgentDeps,
  gptMakerAgentId: string,
  input: CreateAgentInput,
) {
  if (!input.communicationType && !input.type) return null

  try {
    return await deps.client.updateAgent(gptMakerAgentId, {
      ...(input.communicationType
        ? { communicationType: input.communicationType }
        : {}),
      ...(input.type ? { type: input.type } : {}),
    })
  } catch (error) {
    logGptmakerError(
      deps.logger,
      'gptmaker.agent.update_failed',
      { gptMakerAgentId, error },
      {
        msg: 'Agente criado, mas os ajustes de comunicação/tipo não foram aplicados',
      },
    )

    return null
  }
}

async function compensate(
  deps: CreateAgentDeps,
  appId: string,
  gptMakerAgentId: string,
): Promise<void> {
  try {
    await deps.client.deleteAgent(gptMakerAgentId)
  } catch (deleteError) {
    // Órfão confirmado. O log é o que permite achá-lo depois: o agente existe
    // no workspace e não há nenhuma linha nossa apontando para ele.
    logGptmakerError(
      deps.logger,
      'gptmaker.agent.orphaned',
      { gptMakerAgentId, appId, error: deleteError },
      { level: 'error' },
    )
  }
}
