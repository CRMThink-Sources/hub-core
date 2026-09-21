import { ZApiEventHandler } from '../z-api-event-handler'
import { ZApiDisconectedEvent } from './z-api'
import { getIo } from '@/shared/infra/socket'
import { apiLogger } from '@/shared/infra/logger'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { ThinkzapDisconnectNotifySettingsService } from '@/modules/thinkzap/application/thinkzap-disconnect-notify-settings.service'
import { BitrixAppOptionService } from '@/shared/application/bitrix-app-option.service'
import { BitrixSystemNotificationService } from '@/shared/application/bitrix-system-notification.service'

/**
 * `DisconnectedCallback` da Z-API: avisa **a sala da instância**, não todo mundo.
 *
 * A versão anterior fazia `getIo().emit(...)` — broadcast para todos os sockets
 * conectados, com o evento cru. Só era inofensivo enquanto nenhum cliente
 * escutava; com um listener ligado, a desconexão de um cliente chegaria à tela de
 * todos os outros.
 *
 * Payload mínimo pela mesma razão do handler de conexão: ver `connected.handler.ts`.
 *
 * Além do socket, avisa no chat interno do Bitrix os usuários configurados para o
 * app dono da instância (lista app-wide, ver `ThinkzapDisconnectNotifySettingsService`).
 * Best-effort: nenhuma falha aqui pode derrubar o processamento do webhook.
 */
export class ZApiDisconectedHandler implements ZApiEventHandler {
  eventType = 'DisconnectedCallback'

  async handle(event: ZApiDisconectedEvent): Promise<void> {
    const logContext = {
      app: 'thinkzap',
      source: 'z-api',
      eventType: this.eventType,
      instanceId: event.instanceId,
    }

    apiLogger.info(logContext, 'Received Z-API disconnected event')

    getIo().to(event.instanceId).emit('connector:disconnected', {
      status: 'disconnected',
    })

    await this.notifyDisconnectRecipients(event, logContext)
  }

  private async notifyDisconnectRecipients(
    event: ZApiDisconectedEvent,
    logContext: Record<string, unknown>,
  ): Promise<void> {
    try {
      const instance = await new PrismaInstanceRepository().getInstanceByInstanceId(
        event.instanceId,
      )
      if (!instance) {
        apiLogger.debug(
          logContext,
          'Instância do evento de desconexão não encontrada; aviso não enviado',
        )
        return
      }

      const domain = await new PrismaDomainRepository().getDomainById(
        instance.domainId,
      )
      if (!domain) {
        apiLogger.debug(
          { ...logContext, domainId: instance.domainId },
          'Portal da instância não encontrado; aviso não enviado',
        )
        return
      }

      const app = await new PrismaInstalledAppRepository().getByAppCodeAndDomainId(
        thinkzapAppCodeId(),
        instance.domainId,
      )
      if (!app) {
        apiLogger.debug(
          { ...logContext, domainId: instance.domainId },
          'App do Thinkzap não encontrado para o portal; aviso não enviado',
        )
        return
      }

      const bitrix = await makeBitrixClientByDomainAndAppCoode(
        domain.name,
        thinkzapAppCodeId(),
      )

      const notifyService = new ThinkzapDisconnectNotifySettingsService(
        new BitrixAppOptionService(bitrix),
        app.id,
      )
      const userIds = await notifyService.get()
      if (userIds.length === 0) {
        apiLogger.info(
          { ...logContext, appId: app.id },
          'Nenhum destinatário configurado para o aviso de desconexão; aviso não enviado',
        )
        return
      }

      const notifier = new BitrixSystemNotificationService(bitrix)
      const message = event.error
        ? `O WhatsApp do Thinkzap (instância ${event.instanceId}) foi desconectado: ${event.error}. Reconecte o quanto antes.`
        : `O WhatsApp do Thinkzap (instância ${event.instanceId}) foi desconectado. Reconecte o quanto antes.`

      const results = await Promise.allSettled(
        userIds.map(userId =>
          notifier.notify({ userId, message, tag: 'thinkzap:disconnect' }),
        ),
      )
      const sent = results.filter(
        r => r.status === 'fulfilled' && r.value,
      ).length

      apiLogger.info(
        { ...logContext, recipients: userIds.length, sent },
        'Aviso de desconexão Z-API processado',
      )
    } catch (error) {
      apiLogger.warn(
        { ...logContext, error },
        'Falha ao enviar aviso de desconexão Z-API; processamento do webhook não afetado',
      )
    }
  }
}
