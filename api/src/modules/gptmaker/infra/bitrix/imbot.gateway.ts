import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { gptmakerError } from '@/modules/gptmaker/errors/catalog'
import { GPTMAKER_BOT_CODE_PREFIX } from '@/modules/gptmaker/gptmaker.constants'

export type PortalBot = {
  id: number
  code: string
}

export type RegisterBotInput = {
  /** Nome exibido do bot no portal. */
  name: string
  /** URL que o Bitrix chama nos eventos de mensagem deste bot. */
  eventHandlerUrl: string
}

/**
 * Os imbots da aplicação no portal do cliente.
 *
 * Usa `imbot.register` (v1) com `OPENLINE: 'Y'`, e não `imbot.v2.Bot.register`:
 * o v2 registra bot de supervisão (é o que o ThinkZap faz), enquanto o que o
 * agente precisa é aparecer como operador de canal aberto.
 */
export class ImbotGateway {
  constructor(private readonly bitrix: BitrixRestClient) {}

  /**
   * Os bots **desta aplicação** no portal.
   *
   * O portal pode ter bots de outras aplicações, e por isso a lista é filtrada
   * pelo prefixo do `code`. A contagem sai daqui e não do nosso banco: o
   * cliente pode remover um bot pelo painel do portal sem que a gente saiba, e
   * contar localmente recusaria uma criação que o Bitrix aceitaria.
   */
  async listApplicationBots(): Promise<PortalBot[]> {
    const result = (await this.bitrix.callMethod('imbot.bot.list', {})) as
      | Record<string, { ID?: string | number; CODE?: string }>
      | Array<{ ID?: string | number; CODE?: string }>
      | undefined

    const bots = Array.isArray(result) ? result : Object.values(result ?? {})

    return bots
      .filter(bot => (bot?.CODE ?? '').startsWith(GPTMAKER_BOT_CODE_PREFIX))
      .map(bot => ({ id: Number(bot.ID), code: String(bot.CODE) }))
      .filter(bot => Number.isInteger(bot.id))
  }

  async register(input: RegisterBotInput): Promise<number> {
    try {
      const result = await this.bitrix.callMethod('imbot.register', {
        // O `Date.now()` mantém o code único dentro do portal quando o cliente
        // cria e remove bots repetidamente — o Bitrix recusa code duplicado.
        CODE: `${GPTMAKER_BOT_CODE_PREFIX}${Date.now()}`,
        TYPE: 'B',
        OPENLINE: 'Y',
        EVENT_HANDLER: input.eventHandlerUrl,
        PROPERTIES: { NAME: input.name },
      })

      const botId = Number(result)

      if (!Number.isInteger(botId)) {
        throw new Error(`imbot.register devolveu ${JSON.stringify(result)}`)
      }

      return botId
    } catch (error) {
      throw gptmakerError('gptmaker.bot.create_failed', error)
    }
  }

  async unregister(botId: number): Promise<void> {
    try {
      await this.bitrix.callMethod('imbot.unregister', { BOT_ID: botId })
    } catch (error) {
      throw gptmakerError('gptmaker.bot.delete_failed', error)
    }
  }
}
