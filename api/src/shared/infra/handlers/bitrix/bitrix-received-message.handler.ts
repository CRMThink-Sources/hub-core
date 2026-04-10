import { IBX24MessageEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { BitrixEventHandler } from '../bitrix-event-handler'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { env } from '@/config/env'
import { BitrixClient } from '../../clients/bitrix.client'
import { GetBitrixWebhookContextRepository } from '@/modules/thinkzap/domain/repositories/get-bitrix-webhook-context.repository'
import { destructureChatId } from '@/shared/helpers/chat-id'

export class BitrixReceivedMessageHandler implements BitrixEventHandler {
  eventType = 'ONIMCONNECTORMESSAGEADD'

  constructor(
    private readonly bitrixWebhookContextRepo: GetBitrixWebhookContextRepository,
  ) {}

  async handle(event: IBX24MessageEvent): Promise<void> {
    if (!event.data.MESSAGES.length) return
    const message = event.data.MESSAGES[0]
    const messages = []
    if (message?.message.text) {
      messages.push({
        type: 'text',
        text: message.message.text,
      })
    } else if (message?.message.files) {
      for (const file of message.message.files) {
        messages.push({
          type: file.type,
          name: file.name,
          mime: file.mime,
          link: file.downloadLink,
        })
      }
    }

    const context = await this.bitrixWebhookContextRepo.getContext({
      domainName: event.auth.domain,
      appCode: 'crmthink_thinkzap',
      line: event.data.LINE,
    })

    console.log('context', context)
    if (!context) {
      throw new Error('Context not found')
    }
    const bitrixClient = new BitrixClient(context.app.credential, context.name)
    const zApiClient = new ZApiClient(
      env.zApi.partnerToken,
      env.zApi.clientToken,
    )

    const { chatLid, phoneNumber } = destructureChatId(message?.chat.id || '')
    for (const messageData of messages) {
      if (messageData.type === 'text') {
        const sendMessageResult = await zApiClient.sendMessage(
          context.instance.instanceId,
          context.instance.zApiToken || '',
          messageData.text || '',
          phoneNumber,
        )
        await bitrixClient.setMessageDelivered({
          CONNECTOR: 'hubthink_thinkerszap',
          LINE: event.data.LINE,
          MESSAGES: [
            {
              im: message?.im,
              message: {
                id: sendMessageResult.messageId,
              },
              chat: {
                id: chatLid,
              },
            },
          ],
        })
      } else if (messageData.type === 'image') {
        const sendImageResult = await zApiClient.sendImage(
          context.instance.instanceId,
          context.instance.zApiToken || '',
          messageData.link || '',
          phoneNumber,
        )
        await bitrixClient.setMessageDelivered({
          CONNECTOR: 'hubthink_thinkerszap',
          LINE: event.data.LINE,
          MESSAGES: [
            {
              im: message?.im,
              message: {
                id: sendImageResult.messageId,
              },
              chat: {
                id: chatLid,
              },
            },
          ],
        })
      } else if (messageData.type === 'video') {
        const sendVideoResult = await zApiClient.sendVideo(
          context.instance.instanceId,
          context.instance.zApiToken || '',
          messageData.link || '',
          phoneNumber,
        )
        await bitrixClient.setMessageDelivered({
          CONNECTOR: 'hubthink_thinkerszap',
          LINE: event.data.LINE,
          MESSAGES: [
            {
              im: message?.im,
              message: {
                id: sendVideoResult.messageId,
              },
              chat: {
                id: chatLid,
              },
            },
          ],
        })
      }
    }
  }
}
