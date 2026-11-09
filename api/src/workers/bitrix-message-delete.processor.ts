import { env } from '@/config/env'
import { IBX24MessageDeleteEvent } from '@/modules/thinkzap/domain/interfaces/bitrix-events.interface'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { resolveByMarketplaceCode } from '@/shared/app-catalog/app-catalog'
import { makeBitrixWebhookContextRepository } from '@/modules/thinkzap/main/make-bitrix-webhook-context-repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')
const messageRepo = new PrismaThinkzapMessageRepository()
const outboxRepo = new PrismaWidgetOutboxRepository()

export async function processBitrixMessageDelete(
  event: IBX24MessageDeleteEvent,
): Promise<void> {
  log.info(
    { domain: event.auth.domain, line: event.data.LINE },
    'Processing Bitrix message delete event',
  )

  if (!event.data.MESSAGES.length) {
    log.warn(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix delete event received with no messages — skipping',
    )
    return
  }

  const bitrixWebhookContextRepo = makeBitrixWebhookContextRepository()
  const context = await bitrixWebhookContextRepo.getContext({
    domainName: event.auth.domain,
    appCode: resolveByMarketplaceCode(env.appCodes.thinkzap)?.appCodeId ?? '',
    line: event.data.LINE,
  })

  if (!context) {
    log.error(
      { domain: event.auth.domain, line: event.data.LINE },
      'Bitrix webhook context not found for message delete',
    )
    return
  }

  /**
   * A API oficial (HubMessage) não edita nem apaga mensagem já enviada, e a linha
   * não tem instância Z-API para chamar. Encerra sem erro: o evento chegou, não há
   * o que propagar.
   */
  if (context.connector.provider === ConnectorProvider.HUBMESSAGE) {
    log.info(
      { domain: event.auth.domain, line: event.data.LINE },
      'Linha oficial não propaga exclusão de mensagem — evento ignorado',
    )
    return
  }

  const message = event.data.MESSAGES[0]!
  const bitrixMessageId = message.im.message_id

  const zApiClient = new ZApiClient(env.zApi.partnerToken, env.zApi.clientToken)

  const deleteAtProvider = async (
    providerMessageId: string,
    chatId: string,
  ) => {
    try {
      await zApiClient.deleteMessage(
        context.instance.instanceId,
        context.instance.zApiToken || '',
        chatId,
        providerMessageId,
      )
      log.info(
        {
          instanceId: context.instance.id,
          bitrixMessageId,
          zApiMessageId: providerMessageId,
          messageDeleted: true,
        },
        'Message deleted via Z-API',
      )
    } catch (error) {
      log.warn(
        {
          instanceId: context.instance.id,
          bitrixMessageId,
          zApiMessageId: providerMessageId,
          zApiDeleteFailed: true,
          error,
        },
        'Z-API delete message failed — best-effort, skipping',
      )
    }
  }

  const record = await messageRepo.findByBitrixMessageId(
    context.instance.id,
    bitrixMessageId,
  )

  if (record?.providerMessageId) {
    await deleteAtProvider(record.providerMessageId, record.chatId || '')
    return
  }

  /**
   * Sem id do provider ainda: a mensagem não foi confirmada como enviada. O registro
   * só nasce depois do envio, então descartar aqui deixaria a mensagem sair depois.
   *
   * 1. Parte ainda na fila da outbox (esperando a vez ou a cadência): cancela antes de
   *    o worker reivindicá-la — não chega ao WhatsApp.
   * 2. Parte já entregue pela outbox sem registro de mensagem: apaga no provider.
   * 3. Parte em envio, ou resposta que o worker de saída ainda não terminou (caminho
   *    direto): o id aparece em instantes — lança para o BullMQ repetir o evento.
   */
  const cancelled = await outboxRepo.cancelPendingOperatorParts(
    context.instance.id,
    bitrixMessageId,
    'Cancelada: o operador excluiu a mensagem antes do envio',
  )
  const parts = await outboxRepo.findOperatorPartsByBitrixMessageId(
    context.instance.id,
    bitrixMessageId,
  )

  if (cancelled > 0) {
    log.info(
      { instanceId: context.instance.id, bitrixMessageId, cancelled },
      'Exclusão antes do envio — partes pendentes canceladas na fila',
    )
  }

  for (const part of parts) {
    if (!part.providerMessageId) continue
    await deleteAtProvider(part.providerMessageId, part.destination)
  }

  const inFlight = parts.some(
    part => !part.providerMessageId && part.status === 'SENDING',
  )
  const notSentYet = parts.length === 0 && !record

  if (inFlight || notSentYet) {
    log.warn(
      { instanceId: context.instance.id, bitrixMessageId, inFlight },
      'Mensagem ainda sendo enviada — repetindo a exclusão em instantes',
    )
    throw new Error(
      `Mensagem ${bitrixMessageId} ainda sem id do provider; exclusão será repetida`,
    )
  }

  if (parts.length === 0) {
    log.warn(
      {
        instanceId: context.instance.id,
        bitrixMessageId,
        deleteLookupFailed: true,
      },
      'z_api_message_id not found for bitrix message delete — skipping',
    )
  }
}
