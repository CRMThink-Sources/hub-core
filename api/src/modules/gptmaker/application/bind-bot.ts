import type { LocalAgent } from '../domain/entities/agent'
import type { AgentRepository } from '../domain/repositories/agent.repository'
import { gptmakerError } from '../errors/catalog'
import type { ImbotGateway } from '../infra/bitrix/imbot.gateway'
import type { ScopedAgentClient } from '../infra/clients/scoped-agent.client'

export type BindBotDeps = {
  agents: AgentRepository
  imbot: ImbotGateway
}

/**
 * Vincula ao agente um bot **que já existe** no portal.
 *
 * Criar e vincular são operações separadas: o bot vive no portal do cliente e
 * pode ser criado, removido ou reaproveitado sem passar por agente nenhum —
 * ver `bots.ts`. Aqui só se decide quem responde por qual bot.
 */
export async function bindBot(
  deps: BindBotDeps,
  scoped: ScopedAgentClient,
  botId: number,
): Promise<LocalAgent> {
  if (scoped.local.botId !== null) {
    throw gptmakerError('gptmaker.bot.already_bound')
  }

  // Conferido contra o portal, e não contra o corpo da requisição: um `BOT_ID`
  // arbitrário poderia ser o bot de outra aplicação instalada no mesmo portal.
  const inPortal = (await deps.imbot.listApplicationBots()).some(
    bot => bot.id === botId,
  )

  if (!inPortal) throw gptmakerError('gptmaker.bot.not_found')

  const otherAgent = await deps.agents.findOwnedByBotId(
    scoped.local.appId,
    botId,
  )

  if (otherAgent) throw gptmakerError('gptmaker.bot.in_use')

  return deps.agents.update(scoped.local.id, { botId })
}

/**
 * Desfaz o vínculo, preservando o agente **e o bot**.
 *
 * O bot continua no portal e volta a ficar disponível para outro agente.
 * Remover o bot é ação da tela de bots, não efeito colateral de desvincular:
 * quem desvincula quer trocar quem responde, não destruir o canal.
 */
export async function unbindBot(
  deps: BindBotDeps,
  scoped: ScopedAgentClient,
): Promise<LocalAgent> {
  if (scoped.local.botId === null) return scoped.local

  return deps.agents.update(scoped.local.id, { botId: null })
}
