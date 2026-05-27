import type { BitrixRestClient } from '@/shared/infra/clients/bitrix-rest.client'
import { buildImTextareaAudioBind } from './bind-im-textarea-audio'
import { GetOrCreateThinkzapBot } from './get-or-create-thinkzap-bot'
import { UnregisterIframeApp } from './unregister-iframe-app'

function isPlacementAlreadyBoundError(error: unknown): boolean {
  const message = (error as Error)?.message?.toLowerCase() ?? ''
  return (
    message.includes('already') ||
    message.includes('exist') ||
    message.includes('duplicate')
  )
}

export class MigrateAudioWidgetToImTextarea {
  constructor(
    private readonly getOrCreateBot = new GetOrCreateThinkzapBot(),
    private readonly unregisterIframe = new UnregisterIframeApp(),
  ) {}

  async execute(client: BitrixRestClient): Promise<void> {
    const botId = await this.getOrCreateBot.execute(client)
    console.log('botId', botId)
    if (!botId) {
      throw new Error('ThinkZap bot not available for migration')
    }

    await this.unregisterIframe.execute(client, botId)

    const bind = buildImTextareaAudioBind()
    try {
      await client.callMethod(bind.method, bind.params)
    } catch (error) {
      if (!isPlacementAlreadyBoundError(error)) {
        throw error
      }
    }
  }
}
