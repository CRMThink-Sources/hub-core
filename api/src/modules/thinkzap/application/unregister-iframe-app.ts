import { env } from '@/config/env'
import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'

export class UnregisterIframeApp {
  async execute(client: BitrixRestClient, botId: number): Promise<boolean> {
    try {
      const appId = Number(
        await client.callMethod('imbot.app.register', {
          BOT_ID: botId,
          CODE: env.bitrix.iframeAudio.code,
          IFRAME: env.bitrix.iframeAudio.url,
          HASH: env.bitrix.iframeAudio.hash,
          CONTEXT: 'LINES',
        }),
      )

      if (!appId) {
        return false
      }

      await client.callMethod('imbot.app.unregister', { APP_ID: appId })
      return true
    } catch (error) {
      console.warn(
        'Failed to unregister legacy imbot audio app:',
        (error as Error).message,
      )
      return false
    }
  }
}
