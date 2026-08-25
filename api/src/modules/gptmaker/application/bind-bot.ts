import type { LocalAgent } from '../domain/entities/agent'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import { gptmakerError } from '../errors/catalog'
import { MAX_AGENTS_PER_APP } from '../gptmaker.constants'
import type { ImbotGateway } from '../infra/bitrix/imbot.gateway'
import type { ScopedAgentClient } from '../infra/clients/scoped-agent.client'

export type BindBotDeps = {
  agents: AgentRepository
  imbot: ImbotGateway
  /** URL que o Bitrix chama nos eventos de mensagem do bot criado. */
  eventHandlerUrl: string
}

/**
 * Cria o imbot no portal do cliente e o vincula ao agente.
 *
 * O bot vive no portal, não no nosso workspace: é ele que faz o agente
 * aparecer nos canais abertos daquele cliente.
 */
export async function bindBot(
  deps: BindBotDeps,
  scoped: ScopedAgentClient,
  botName: string,
): Promise<LocalAgent> {
  if (scoped.local.botId !== null) {
    throw gptmakerError('gptmaker.bot.already_bound')
  }

  // Contado no portal, e não em `core_gpt_agents`: um bot removido pelo painel
  // do Bitrix libera vaga, e a contagem local não saberia disso.
  const existing = await deps.imbot.listApplicationBots()

  if (existing.length >= MAX_AGENTS_PER_APP) {
    throw gptmakerError('gptmaker.bot.limit_reached')
  }

  const botId = await deps.imbot.register({
    name: botName,
    eventHandlerUrl: deps.eventHandlerUrl,
  })

  return deps.agents.update(scoped.local.id, { botId })
}

/**
 * Remove o imbot do portal e desfaz o vínculo, preservando o agente.
 *
 * Bot já inexistente no portal conclui com sucesso: o estado desejado já é o
 * corrente, e recusar deixaria o agente preso a um `botId` que não aponta para
 * nada.
 */
export async function unbindBot(
  deps: BindBotDeps,
  scoped: ScopedAgentClient,
): Promise<LocalAgent> {
  const { botId } = scoped.local

  if (botId === null) return scoped.local

  const stillInPortal = (await deps.imbot.listApplicationBots()).some(
    bot => bot.id === botId,
  )

  if (stillInPortal) await deps.imbot.unregister(botId)

  return deps.agents.update(scoped.local.id, { botId: null })
}
