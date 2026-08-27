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

  // Rede de segurança, não caminho normal: a criação já manda os dois campos.
  // Falhar aqui não desfaz o agente — ele existe, está associado, e no pior
  // caso ficou com o que o vendor decidiu.
  const vendor = await correctFieldsCreateIgnored(deps, created, input)

  return { ...local, vendor: vendor ?? created }
}

/**
 * Corrige `communicationType`/`type` quando o vendor devolve valor diferente do
 * que a criação pediu.
 *
 * Só age sobre campo que o usuário pediu **e** que voltou preenchido e
 * divergente. Campo ausente na resposta não é divergência: o vendor nem sempre
 * ecoa tudo que recebe, e tratar ausência como erro faria um `PUT` inútil em
 * toda criação.
 */
async function correctFieldsCreateIgnored(
  deps: CreateAgentDeps,
  created: { id: string; communicationType?: string; type?: string },
  input: CreateAgentInput,
) {
  const patch = {
    ...(input.communicationType &&
    created.communicationType &&
    created.communicationType !== input.communicationType
      ? { communicationType: input.communicationType }
      : {}),
    ...(input.type && created.type && created.type !== input.type
      ? { type: input.type }
      : {}),
  }

  if (Object.keys(patch).length === 0) return null

  try {
    return await deps.client.updateAgent(created.id, patch)
  } catch (error) {
    logGptmakerError(
      deps.logger,
      'gptmaker.agent.update_failed',
      { gptMakerAgentId: created.id, error },
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
