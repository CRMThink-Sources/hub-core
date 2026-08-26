import { gptmakerError } from '@/modules/gptmaker/errors/catalog'
import { GPTMAKER_BOT_CODE_PREFIX } from '@/modules/gptmaker/gptmaker.constants'

/**
 * O mínimo que o gateway precisa de um client do Bitrix.
 *
 * Declarado aqui em vez de apontar para uma classe porque os dois clients do
 * projeto divergem no retorno: `BitrixRestClient.callMethod` devolve
 * `data.result`, e `BitrixClient.callMethod` devolve o envelope inteiro
 * (`{ result, time }`). Tipar um e receber o outro por cast foi o que fez
 * `imbot.register` ler `NaN` de um bot que o portal tinha acabado de criar.
 */
export type BitrixMethodCaller = {
  callMethod(method: string, params: Record<string, unknown>): Promise<unknown>
}

/**
 * Devolve o `result` do envelope quando ele vem embrulhado.
 *
 * Não dá para decidir pelo client: os dois atendem o mesmo contrato de tipo. A
 * checagem é pelo formato, e `imbot.bot.list` nunca devolve um objeto com
 * `result` como corpo útil — o corpo dele é o mapa de bots.
 */
function unwrap(response: unknown): unknown {
  if (
    response &&
    typeof response === 'object' &&
    !Array.isArray(response) &&
    'result' in response
  ) {
    return (response as { result: unknown }).result
  }

  return response
}

export type PortalBot = {
  id: number
  code: string
  /**
   * Nome exibido no portal. Cai para o `code` quando o Bitrix não devolve
   * `NAME` — a lista precisa de um rótulo, e um item sem texto é pior do que um
   * item com o identificador técnico.
   */
  name: string
}

/**
 * O bot como o Bitrix devolve em `imbot.bot.list`.
 *
 * O nome aparece ora em `NAME`, ora dentro de `PROPERTIES` — depende de como o
 * bot foi registrado. Os dois são lidos porque a lista da tela depende disso.
 */
type RawPortalBot = {
  ID?: string | number
  CODE?: string
  NAME?: string
  PROPERTIES?: { NAME?: string }
}

const displayName = (bot: RawPortalBot): string =>
  bot.PROPERTIES?.NAME?.trim() || bot.NAME?.trim() || String(bot.CODE ?? '')

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
  constructor(private readonly bitrix: BitrixMethodCaller) {}

  /**
   * Os bots **desta aplicação** no portal.
   *
   * O portal pode ter bots de outras aplicações, e por isso a lista é filtrada
   * pelo prefixo do `code`. A contagem sai daqui e não do nosso banco: o
   * cliente pode remover um bot pelo painel do portal sem que a gente saiba, e
   * contar localmente recusaria uma criação que o Bitrix aceitaria.
   */
  async listApplicationBots(): Promise<PortalBot[]> {
    const result = unwrap(
      await this.bitrix.callMethod('imbot.bot.list', {}),
    ) as Record<string, RawPortalBot> | RawPortalBot[] | undefined

    const bots = Array.isArray(result) ? result : Object.values(result ?? {})

    return bots
      .filter(bot => (bot?.CODE ?? '').startsWith(GPTMAKER_BOT_CODE_PREFIX))
      .map(bot => ({
        id: Number(bot.ID),
        code: String(bot.CODE),
        name: displayName(bot),
      }))
      .filter(bot => Number.isInteger(bot.id))
  }

  async register(input: RegisterBotInput): Promise<number> {
    try {
      const result = unwrap(
        await this.bitrix.callMethod('imbot.register', {
          // O `Date.now()` mantém o code único dentro do portal quando o cliente
          // cria e remove bots repetidamente — o Bitrix recusa code duplicado.
          CODE: `${GPTMAKER_BOT_CODE_PREFIX}${Date.now()}`,
          TYPE: 'B',
          OPENLINE: 'Y',
          EVENT_HANDLER: input.eventHandlerUrl,
          PROPERTIES: { NAME: input.name },
        }),
      )

      const botId = Number(result)

      // Positivo, e não só inteiro: `Number(null)` é `0`, então um `result`
      // vazio passaria como "bot 0" e o vínculo apontaria para nada.
      if (!Number.isInteger(botId) || botId <= 0) {
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
