import type { AgentRepository } from '../domain/repositories/agent.repository'
import { gptmakerError } from '../errors/catalog'
import { MAX_AGENTS_PER_APP } from '../gptmaker.constants'
import type { ImbotGateway, PortalBot } from '../infra/bitrix/imbot.gateway'

export type BotsDeps = {
  agents: AgentRepository
  imbot: ImbotGateway
  /** URL que o Bitrix chama nos eventos de mensagem do bot criado. */
  eventHandlerUrl: string
}

/** Um bot do portal com o agente que o usa, quando existe. */
export type BotWithBinding = PortalBot & {
  /** Id do agente no vendor, ou `null` se o bot está livre. */
  boundToAgentId: string | null
  /** Nome do agente que usa o bot, para a tela não ter que cruzar as listas. */
  boundToAgentName: string | null
}

/**
 * Os bots desta aplicação no portal, com o vínculo de cada um.
 *
 * A lista vem do **portal**, não de `core_gpt_agents`: o cliente pode criar e
 * remover bots pelo painel do Bitrix, e uma lista tirada do nosso banco
 * mostraria bots que já não existem e esconderia os que existem.
 */
export async function listBots(
  deps: BotsDeps,
  appId: string,
): Promise<BotWithBinding[]> {
  const [bots, agents] = await Promise.all([
    deps.imbot.listApplicationBots(),
    deps.agents.listByApp(appId),
  ])

  const byBotId = new Map(
    agents
      .filter(agent => agent.botId !== null)
      .map(agent => [agent.botId as number, agent]),
  )

  return bots.map(bot => {
    const agent = byBotId.get(bot.id)

    return {
      ...bot,
      boundToAgentId: agent?.gptMakerAgentId ?? null,
      boundToAgentName: agent?.name ?? null,
    }
  })
}

/**
 * Cria um bot no portal, sem vincular a agente nenhum.
 *
 * O teto é contado nos bots do portal, e não em `core_gpt_agents`: um bot
 * removido pelo painel do Bitrix libera vaga, e a contagem local não saberia
 * disso.
 */
export async function createBot(
  deps: BotsDeps,
  name: string,
): Promise<PortalBot> {
  const existing = await deps.imbot.listApplicationBots()

  if (existing.length >= MAX_AGENTS_PER_APP) {
    throw gptmakerError('gptmaker.bot.limit_reached')
  }

  const id = await deps.imbot.register({
    name,
    eventHandlerUrl: deps.eventHandlerUrl,
  })

  // O `code` real sai do portal; a lista seguinte o traz. Aqui basta devolver o
  // que a tela precisa para renderizar o item recém-criado.
  return { id, code: '', name }
}

/**
 * Remove o bot do portal.
 *
 * Recusa enquanto houver agente vinculado: apagar o bot por baixo do agente o
 * deixaria apontando para um `botId` que não existe mais, e o sintoma disso
 * (agente mudo nos canais abertos) não diz nada sobre a causa.
 */
export async function deleteBot(
  deps: BotsDeps,
  appId: string,
  botId: number,
): Promise<void> {
  const bound = await deps.agents.findOwnedByBotId(appId, botId)

  if (bound) throw gptmakerError('gptmaker.bot.in_use')

  const inPortal = (await deps.imbot.listApplicationBots()).some(
    bot => bot.id === botId,
  )

  // Bot já inexistente é o estado desejado: o cliente pode tê-lo removido pelo
  // painel do Bitrix entre a leitura da tela e o clique.
  if (!inPortal) return

  await deps.imbot.unregister(botId)
}
