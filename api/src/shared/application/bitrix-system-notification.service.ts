import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'

export type SystemNotificationInput = {
  userId: number
  /** Texto da notificação. Suporta BB-code. */
  message: string
  /** Tag única por app: reenviar com a mesma tag remove a notificação anterior. */
  tag?: string
  /** Texto para canais externos (ex.: e-mail). */
  messageOut?: string
}

/**
 * Notificação de sistema do Bitrix24 (im.notify.system.add). Público.
 * Requer scope `im` no app. Best-effort: falha loga warn e segue (retorna false).
 */
export class BitrixSystemNotificationService {
  constructor(private readonly bitrix: BitrixClient) {}

  async notify(input: SystemNotificationInput): Promise<boolean> {
    if (!input.userId) return false
    try {
      await this.bitrix.callMethod('im.notify.system.add', {
        USER_ID: input.userId,
        MESSAGE: input.message,
        ...(input.tag ? { TAG: input.tag } : {}),
        ...(input.messageOut ? { MESSAGE_OUT: input.messageOut } : {}),
      })
      return true
    } catch (error) {
      apiLogger.warn(
        { module: 'bitrix-notification', userId: input.userId, error },
        'Failed to send Bitrix system notification',
      )
      return false
    }
  }
}
