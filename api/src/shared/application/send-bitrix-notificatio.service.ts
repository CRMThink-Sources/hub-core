import {
  SendNotification,
  SendNotificationInput,
} from '../data/contracts/send-notification'
import { BitrixClient } from '../infra/clients/bitrix.client'

export class BitrixLivefeedNotificationService implements SendNotification {
  constructor(private readonly bitrixClient: BitrixClient) {}
  async execute(input: SendNotificationInput): Promise<void> {
    const { contextId, entity, message } = input

    const entityId = Number(contextId)
    if (!entityId || isNaN(entityId)) {
      console.warn(
        '[BitrixLivefeedNotificationService] Invalid entityId:',
        contextId,
      )
      return
    }

    try {
      await this.bitrixClient.callMethod('crm.timeline.comment.add', {
        fields: {
          ENTITY_ID: entityId,
          ENTITY_TYPE: entity.toUpperCase(),
          COMMENT: message,
        },
      })
    } catch (error) {
      console.error(
        '[BitrixLivefeedNotificationService] Failed to add timeline comment:',
        error,
      )
    }
  }
}
