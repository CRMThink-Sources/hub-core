import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { EnsureWidgetOpenChannelConversation } from '@/modules/thinkzap/application/ensure-widget-open-channel-conversation'
import { makeResolveWidgetOpenChannelContact } from '@/modules/thinkzap/main/make-resolve-widget-open-channel-contact'
import { resolveOpenChannelTextFromPersisted } from '@/modules/thinkzap/application/helpers/describe-attachment-text'
import { findLineItemByInstanceId } from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { ZApiEventHandler } from '../z-api-event-handler'
import { StatusCallbackEvent } from './z-api'
import { makeBitrixClientByDomainAndAppCoode } from '@/shared/main/make-bitrix-client'
import { PrismaDomainRepository } from '../../persistence/repositories/prisma-domain.repository'
import { apiLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'

/**
 * Confirmação de entrega da Z-API — e **reparo** da conversa do canal aberto.
 *
 * Este handler já foi o dono da abertura da conversa, e é por isso que a mensagem
 * inicial do widget não chegava ao canal do cliente. Três problemas de uma vez:
 *
 * 1. Decidia por `Instance.vinculatedChannel`, coluna que ninguém escreve desde que
 *    o vínculo passou para o item da SPA — `NULL` em toda linha cuja âncora nasceu
 *    antes do vínculo, que é o caso comum. O `return` era silencioso, e o toggle
 *    parecia morto porque nunca era alcançado.
 * 2. Dependia de um webhook externo opcional, tratado só em `status === 'SENT'`, que
 *    corre com a escrita da própria mensagem no banco.
 * 3. Regravava a mensagem sem o `text`, e como o upsert é por
 *    `(instance_id, provider_message_id)`, **apagava o corpo** que o envio persistiu.
 *
 * Hoje a abertura acontece no caminho do envio, e o que sobra aqui é a segunda
 * chance: se a mensagem do widget ficou sem `chat_id` — porque a abertura falhou, ou
 * porque o Bitrix estava fora naquele instante — o callback tenta de novo, pelo mesmo
 * use case e com a mesma decisão pelo item.
 */
export class StatusCallbackHandler implements ZApiEventHandler {
  eventType = 'MessageStatusCallback'

  async handle(event: StatusCallbackEvent): Promise<void> {
    if (event.status !== 'SENT') return

    const zApiMessageId = event.ids[0]
    if (!zApiMessageId) return

    const logContext = {
      app: 'thinkzap',
      instanceId: event.instanceId,
      zApiMessageId,
      phone: event.phone,
    }

    const instanceRepo = new PrismaInstanceRepository()
    const instance = await instanceRepo.getInstanceByInstanceId(
      event.instanceId,
    )

    /**
     * A row de `Instance` continua sendo lida — é dela que sai o `id` com que a
     * mensagem foi persistida. O que ela **deixou** de fazer é decidir sobre o canal:
     * `instance.vinculatedChannel` não é mais consultado em lugar nenhum deste
     * caminho.
     */
    if (!instance) {
      apiLogger.debug(
        logContext,
        'Instância do evento de status não encontrada',
      )
      return
    }

    const messageRepo = new PrismaThinkzapMessageRepository()
    const message = await messageRepo.findByProviderMessageId(
      instance.id,
      zApiMessageId,
    )

    if (!message) {
      /**
       * Corrida read-your-write: o webhook chegou antes de a mensagem commitar. Não é
       * perda — a conversa já foi aberta pelo caminho do envio, que não depende
       * disto.
       */
      apiLogger.debug(
        logContext,
        'Mensagem do evento de status ainda não persistida; nada a reparar',
      )
      return
    }

    if (message.source !== 'BITRIX') {
      apiLogger.debug(
        { ...logContext, source: message.source },
        'Evento de status de mensagem que não saiu do widget; ignorado',
      )
      return
    }

    if (message.chatId !== null) {
      apiLogger.debug(
        { ...logContext, chatId: message.chatId },
        'Conversa do canal aberto já existe para esta mensagem; nada a reparar',
      )
      return
    }

    const text = resolveOpenChannelTextFromPersisted(message)
    if (!text) {
      apiLogger.debug(
        { ...logContext, type: message.type },
        'Mensagem sem texto nem tipo descritível; nada a postar no canal aberto',
      )
      return
    }

    const domainRepo = new PrismaDomainRepository()
    const domain = await domainRepo.getDomainById(instance.domainId)
    if (!domain) {
      apiLogger.debug(
        { ...logContext, domainId: instance.domainId },
        'Portal da instância não encontrado',
      )
      return
    }

    try {
      const bitrix = await makeBitrixClientByDomainAndAppCoode(
        domain.name,
        thinkzapAppCodeId(),
      )

      /**
       * `findLineItemByInstanceId` em vez de `resolveSettingsByInstanceId`: devolve o
       * `item` **e** os `settings` na mesma leitura, e é o item que carrega o
       * `vinculatedChannel` de verdade. A troca não custa leitura nenhuma — o
       * consumidor antigo era construído sobre esta mesma função.
       *
       * Item ausente é estado, não erro: linha removida da SPA, instância órfã.
       */
      const line = await findLineItemByInstanceId(
        {
          instanceId: event.instanceId,
          domainId: instance.domainId,
          appCode: thinkzapAppCodeId(),
        },
        makeGetAplicationContext(),
      )

      if (!line) {
        apiLogger.debug(
          logContext,
          'Nenhum item de assinatura corresponde à instância; conversa não reparada',
        )
        return
      }

      /**
       * A mesma resolução de identidade do caminho principal, e não o default.
       *
       * Este é o **reparo**: ele abre a conversa que o enfileiramento não conseguiu
       * abrir. Se ele resolvesse a identidade por outro caminho, repararia abrindo uma
       * segunda conversa — com a chave antiga — em vez de a que faltava. Duas direções
       * discordando sobre quem é o contato é a origem do defeito que esta change conserta.
       *
       * Sem nome do CRM: aqui só existe o evento do provider, sem entidade de origem. O
       * nome cai no telefone, que é o que este caminho já produzia.
       */
      const ensureOpenChannel = new EnsureWidgetOpenChannelConversation(
        bitrix,
        messageRepo,
        makeResolveWidgetOpenChannelContact(),
      )

      const { outcome, chatId } = await ensureOpenChannel.execute({
        item: line.item,
        instanceId: instance.id,
        providerMessageId: zApiMessageId,
        destination: event.phone,
        text,
      })

      apiLogger.info(
        { ...logContext, openChannelOutcome: outcome, chatId },
        'Reparo da conversa do canal aberto processado no callback de status',
      )
    } catch (err) {
      /**
       * A leitura do contexto ou a montagem do cliente Bitrix podem falhar — a
       * abertura em si nunca lança. Falhar aqui não pode derrubar o processamento do
       * webhook: a mensagem já foi entregue ao contato.
       */
      logThinkzapError(
        apiLogger,
        'thinkzap.message.open_channel_failed',
        { ...logContext, err, openChannelOutcome: 'failed' },
        {
          level: 'error',
          msg: 'Falha ao reparar a conversa do canal aberto no callback de status',
        },
      )
    }
  }
}
