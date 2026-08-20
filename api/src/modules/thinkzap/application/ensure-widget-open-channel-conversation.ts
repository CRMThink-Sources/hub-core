import { env } from '@/config/env'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { apiLogger } from '@/shared/infra/logger'

/**
 * O que aconteceu com a abertura da conversa. **Cinco desfechos, nenhum silencioso.**
 *
 * Falha silenciosa foi exatamente o que manteve este fluxo quebrado sem ninguém
 * perceber: o caminho antigo recusava com `return` mudo em três guards diferentes, e
 * o relato que chegava do QA era "às vezes não chega".
 */
export type OpenChannelOutcome =
  | 'opened'
  | 'already-open'
  | 'toggle-off'
  | 'no-channel'
  | 'failed'

export type EnsureWidgetOpenChannelResult = {
  outcome: OpenChannelOutcome
  chatId: string | null
}

export type EnsureWidgetOpenChannelInput = {
  /**
   * O item de assinatura **já resolvido** pelo chamador.
   *
   * Recebido pronto de propósito: os dois use cases de envio já leram o contexto da
   * aplicação para autorizar a operação e decidir entitlement, então o item está em
   * mãos. Resolver de novo aqui custaria uma segunda leitura do Bitrix no caminho
   * quente de mensagem.
   *
   * É dele que saem o canal (`vinculatedChannel`) e o toggle
   * (`settings.widgetOpenChannelEnabled`) — nunca da row de `Instance`.
   */
  item: SubscriptionItem
  /** `Instance.id` (uuid do banco), para achar a mensagem persistida. */
  instanceId: string
  /** Id da mensagem no provider — a chave da row cujo `chat_id` será gravado. */
  providerMessageId: string
  /** Telefone do destino, já normalizado pelo chamador. Vira o `USER.ID` no Bitrix. */
  destination: string
  /** O texto a postar. Em envio só de anexo, o descritivo do tipo. */
  text: string
}

/** O mínimo que a abertura precisa do repositório de mensagens. */
export type OpenChannelMessageStore = Pick<
  PrismaThinkzapMessageRepository,
  'findByProviderMessageId' | 'updateChatId'
>

/** O mínimo que a abertura precisa do Bitrix. */
export type OpenChannelSender = Pick<BitrixClient, 'sendToOpenChannel'>

/**
 * Abre (ou reusa) a conversa no canal aberto do Bitrix para uma mensagem enviada
 * pelo widget do CRM.
 *
 * **Onde isto roda mudou, e é o coração desta change.** Antes a abertura vivia no
 * callback de status da Z-API, e decidia por `Instance.vinculatedChannel` — coluna
 * que ninguém escreve desde que o vínculo de canal passou para o item da SPA
 * (`ufCrm93Channel`). `ensureLineInstance` copia o vínculo para a row **só no
 * `create`**, e `updateVinculatedChannel` não tem chamador de produção: em toda linha
 * cuja âncora nasceu antes do vínculo — o caso comum, porque a âncora nasce no
 * primeiro envio e o vínculo vem depois, na tela de ajustes — a coluna está `NULL`, o
 * guard recusava antes de olhar o toggle, e a conversa nunca abria. Era o relato do
 * QA, e a razão de o toggle parecer morto.
 *
 * Agora a decisão sai do item, e a chamada acontece no caminho do envio, disparada
 * pelo `messageId` que o provider acabou de devolver. Nada externo precisa acontecer:
 * o webhook de status da Z-API deixou de ser o dono do fluxo e virou reparo.
 *
 * **Não é provider-aware.** Abrir a conversa é operação Bitrix, idêntica para Z-API e
 * HubMessage — é o que faz a linha do WhatsApp Oficial ganhar o comportamento de
 * graça, onde antes não tinha bridge nenhum.
 *
 * **Nunca lança.** A mensagem já foi entregue ao contato quando isto roda; devolver
 * erro faria o operador reenviar e o contato receber duas vezes.
 */
export class EnsureWidgetOpenChannelConversation {
  constructor(
    private readonly bitrixClient: OpenChannelSender,
    private readonly messages: OpenChannelMessageStore,
  ) {}

  async execute(
    input: EnsureWidgetOpenChannelInput,
  ): Promise<EnsureWidgetOpenChannelResult> {
    const { item, instanceId, providerMessageId, destination, text } = input

    const vinculatedChannel = item.vinculatedChannel
    const widgetOpenChannelEnabled =
      item.settings.widgetOpenChannelEnabled === true

    const logContext = {
      app: 'thinkzap',
      subscriptionItemId: item.id,
      vinculatedChannel,
      widgetOpenChannelEnabled,
      providerMessageId,
    }

    /**
     * **Canal antes do toggle.** Toggle ligado em linha sem canal vinculado é estado
     * impossível — a UI desabilita o toggle nesse caso — e responder "desligado"
     * descreveria errado o motivo para quem lê o log.
     */
    if (!vinculatedChannel) {
      return this.skip('no-channel', logContext)
    }

    if (!widgetOpenChannelEnabled) {
      return this.skip('toggle-off', logContext)
    }

    /**
     * O guard de idempotência. Só funciona porque o `chatId` passou a ser
     * persistido: no caminho antigo o valor era desestruturado da resposta do Bitrix
     * e **descartado**, então a condição nunca era satisfeita e cada retentativa do
     * webhook re-postava a mesma mensagem no canal aberto do cliente.
     *
     * Falha de leitura não recusa: sem saber o estado, tentar abrir é o
     * comportamento útil — o Bitrix reusa a sessão existente para o mesmo `USER.ID`.
     */
    const existing = await this.findMessage(instanceId, providerMessageId)
    if (existing?.chatId) {
      return this.skip('already-open', logContext, existing.chatId)
    }

    try {
      const { chatId } = await this.bitrixClient.sendToOpenChannel(
        vinculatedChannel,
        env.bitrix.connector.code,
        destination,
        text,
      )

      /**
       * Resposta sem `session.CHAT_ID` **não** é erro: a mensagem entrou no canal, o
       * que o Bitrix não devolveu foi a referência da sessão. Tratar como falha
       * pediria uma retentativa que duplicaria a postagem.
       */
      if (chatId) {
        await this.persistChatId(instanceId, providerMessageId, chatId)
      }

      apiLogger.info(
        { ...logContext, chatId, openChannelOutcome: 'opened' },
        'Conversa do canal aberto criada para mensagem do widget',
      )

      return { outcome: 'opened', chatId }
    } catch (err) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.open_channel_failed',
        { ...logContext, err, openChannelOutcome: 'failed' },
        {
          level: 'error',
          msg: 'Falha ao abrir a conversa no canal aberto; o envio ao contato não é afetado',
        },
      )

      return { outcome: 'failed', chatId: null }
    }
  }

  private skip(
    outcome: Exclude<OpenChannelOutcome, 'opened' | 'failed'>,
    logContext: Record<string, unknown>,
    chatId: string | null = null,
  ): EnsureWidgetOpenChannelResult {
    apiLogger.debug(
      { ...logContext, chatId, openChannelOutcome: outcome },
      'Conversa do canal aberto não foi criada',
    )

    return { outcome, chatId }
  }

  /**
   * Leitura tolerante: erro de banco aqui não pode virar `failed`. O único efeito de
   * não conseguir ler é perder o guard de idempotência, e o pior caso disso é uma
   * postagem repetida — melhor que nenhuma conversa.
   */
  private async findMessage(instanceId: string, providerMessageId: string) {
    try {
      return await this.messages.findByProviderMessageId(
        instanceId,
        providerMessageId,
      )
    } catch (err) {
      apiLogger.warn(
        { app: 'thinkzap', instanceId, providerMessageId, err },
        'Não foi possível ler a mensagem para checar se a conversa já está aberta',
      )
      return null
    }
  }

  /**
   * Gravação tolerante pelo mesmo motivo inverso: a conversa **já** abriu quando
   * isto roda. Transformar o sucesso em `failed` por causa da escrita faria o log
   * mentir sobre o que o cliente vê na tela.
   */
  private async persistChatId(
    instanceId: string,
    providerMessageId: string,
    chatId: string,
  ): Promise<void> {
    try {
      await this.messages.updateChatId(instanceId, providerMessageId, chatId)
    } catch (err) {
      apiLogger.warn(
        { app: 'thinkzap', instanceId, providerMessageId, chatId, err },
        'Conversa aberta, mas o chatId não pôde ser persistido — o guard de idempotência fica sem efeito para esta mensagem',
      )
    }
  }
}
