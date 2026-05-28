import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { env } from '@/config/env'

export class GetOrCreateThinkzapBot {
  async execute(client: BitrixRestClient): Promise<number | null> {
    const webhookUrl = env.bitrix.webhookUrl

    if (!webhookUrl) {
      console.warn(
        'BITRIX_WEBHOOK_URL nao configurado. Nao foi possivel automatizar imbot.register. Defina BITRIX_BOT_CODE.',
      )
      return null
    }

    const existingBotId = await this.findExistingBot(client)
    if (existingBotId) {
      return existingBotId
    }

    return this.registerNewBot(client, webhookUrl)
  }

  private async findExistingBot(
    client: BitrixRestClient,
  ): Promise<number | null> {
    const botCode = env.bitrix.bot.code

    try {
      const bots = (await client.callMethod('imbot.bot.list', {})) as Record<
        string,
        { ID?: number; CODE?: string; OPENLINE?: string }
      >

      const existingBot = Object.values(bots ?? {}).find(
        bot => bot?.CODE === botCode,
      )

      if (existingBot?.ID) {
        if (existingBot.OPENLINE === 'N') {
          console.warn(
            `Bot ${existingBot.ID} tem OPENLINE=N. Para Canais Abertos use um bot de Open Lines (TYPE O) ou outro CODE/BOT_ID.`,
          )
        }
        return existingBot.ID
      }
    } catch (error) {
      console.error(
        'Error listing bots with imbot.bot.list:',
        (error as Error).message,
      )
    }

    return null
  }

  private async registerNewBot(
    client: BitrixRestClient,
    webhookUrl: string,
  ): Promise<number | null> {
    try {
      const result = await client.callMethod('imbot.register', {
        CODE: env.bitrix.bot.code,
        TYPE: 'O',
        OPENLINE: 'Y',
        EVENT_HANDLER: webhookUrl,
        PROPERTIES: {
          NAME: env.bitrix.bot.name,
          WORK_POSITION: 'Automacao ThinkZap',
        },
      })

      return Number(result)
    } catch (error) {
      console.error(
        'Error creating bot with imbot.register:',
        (error as Error).message,
      )
    }

    return null
  }
}
