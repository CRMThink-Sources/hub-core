import {
  SendNotification,
  SendNotificationInput,
} from '../data/contracts/send-notification'
import { BitrixClient } from '../infra/clients/bitrix.client'

export class BitrixLivefeedNotificationService implements SendNotification {
  constructor(private readonly bitrixClient: BitrixClient) {}
  async execute(input: SendNotificationInput): Promise<void> {
    const { contextId, entity, message } = input

    await this.bitrixClient.callMethod('crm.timeline.comment.add', {
      fields: {
        ENTITY_ID: contextId,
        ENTITY_TYPE: entity,
        COMMENT: message,
      },
    })
  }
}
