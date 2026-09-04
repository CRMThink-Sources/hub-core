import { env } from '@/config/env'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { resolveOpenChannelContactId } from '@/shared/helpers/open-channel-contact-id'
import { normalizePhoneNumber } from '@/shared/helpers/normalize-phone-number'
import { resolveContactDisplayName } from './open-channel-contact-display'
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
  /** Payload enviado ao Bitrix (`imconnector.send.messages`). Só em `opened`. */
  payload?: unknown
  /** Mensagem do erro que o Bitrix devolveu. Só em `failed`. */
  error?: string
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
  /**
   * Telefone do destino, como o operador digitou.
   *
   * **Não é a identidade.** Ele entra em `resolveContact`, que decide o `chat.id` — em
   * linha Z-API isso é o LID, resolvido pelo mapa ou por `phone-exists`. O que continua
   * valendo é que a decisão não é do chamador: cada chamador decidindo sozinho foi o que
   * produziu o canal aberto duplicado.
   */
  destination: string
  /** O texto a postar. Em envio só de anexo, o descritivo do tipo. */
  text: string
  /**
   * Entidade do CRM de onde o envio partiu, quando há uma.
   *
   * Serve só para o **nome** do contato na conversa: o operador prefere ver "Maria
   * Souza" a ver um número. Opcional porque o caminho de reparo (callback de status da
   * Z-API) não tem entidade em mãos — ele só conhece o evento do provider —, e nesse
   * caso o nome cai no telefone.
   */
  entity?: string
  entityId?: string
}

/**
 * A identidade do contato, resolvida por quem sabe o provider da linha.
 *
 * Saiu de dentro do `BitrixClient` porque deixou de ser uma canonização de string: em
 * linha Z-API ela é o LID, e chegar nele pode exigir o mapa e uma consulta ao provider.
 */
export type ResolveOpenChannelContact = (input: {
  item: SubscriptionItem
  instanceDbId: string
  destination: string
}) => Promise<{ id: string; phone: string | null }>

/** Nome do contato no CRM. `null` quando não há entidade ou a consulta falha. */
export type GetCrmContactName = (input: {
  entity: string
  entityId: string
}) => Promise<string | null>

/** O mínimo que a abertura precisa do repositório de mensagens. */
export type OpenChannelMessageStore = Pick<
  PrismaThinkzapMessageRepository,
  'findByProviderMessageId' | 'updateOpenChannelRefs'
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
 * **Abrir a conversa segue sendo operação Bitrix, idêntica para os dois providers** —
 * é o que faz a linha do WhatsApp Oficial ganhar o comportamento de graça. O que passou
 * a ser provider-aware é a **identidade** do contato, e ela entra por `resolveContact`,
 * fora daqui: em linha Z-API é o LID, em HubMessage é o telefone normalizado. Esta
 * classe não sabe qual é qual, e é assim que deve continuar.
 *
 * **Nunca lança.** A mensagem já foi entregue ao contato quando isto roda; devolver
 * erro faria o operador reenviar e o contato receber duas vezes.
 */
export class EnsureWidgetOpenChannelConversation {
  constructor(
    private readonly bitrixClient: OpenChannelSender,
    private readonly messages: OpenChannelMessageStore,
    /**
     * Default preserva o comportamento anterior — identidade = telefone canonizado — e
     * é o que mantém a linha HubMessage e os chamadores que não resolvem provider
     * funcionando sem mudança.
     */
    private readonly resolveContact: ResolveOpenChannelContact = ({
      destination,
    }) =>
      Promise.resolve({
        id: resolveOpenChannelContactId(destination),
        phone: normalizePhoneNumber(destination),
      }),
    /** Ausente = nome cai no telefone, que é o comportamento de antes. */
    private readonly getCrmContactName?: GetCrmContactName,
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
     * O guard de idempotência. Só funciona porque a referência da sessão passou a ser
     * persistida: no caminho antigo o valor era desestruturado da resposta do Bitrix
     * e **descartado**, então a condição nunca era satisfeita e cada retentativa do
     * webhook re-postava a mesma mensagem no canal aberto do cliente.
     *
     * Lê `bitrixChatId ?? chatId` porque a sessão mudou de coluna. Hoje ela vai para
     * `bitrix_chat_id` — o mesmo papel que a coluna já tem no inbound — mas as rows
     * gravadas antes disso guardam a sessão em `chat_id`. Sem o fallback elas
     * pareceriam "conversa não aberta", e o reparo do callback de status re-postaria
     * no canal do cliente. O fallback dispensa backfill: nenhum predicado separa com
     * segurança essas rows das do caminho do operador, que já usam as duas colunas
     * corretamente, e um backfill errado corromperia o histórico do operador.
     *
     * Falha de leitura não recusa: sem saber o estado, tentar abrir é o
     * comportamento útil — o Bitrix reusa a sessão existente para o mesmo `USER.ID`.
     */
    const existing = await this.findMessage(instanceId, providerMessageId)
    const openedChatId = existing?.bitrixChatId ?? existing?.chatId
    if (openedChatId) {
      return this.skip('already-open', logContext, openedChatId)
    }

    /**
     * A identidade é resolvida **aqui**, uma vez, e desce pronta para o cliente do
     * Bitrix. Ela é gravada em `chat_id` como registro de sob qual identidade este
     * contato entrou no canal aberto, então resolver duas vezes é como as duas direções
     * divergiam antes.
     *
     * Isto roda **depois** do guard de conversa já aberta, e não antes: em linha Z-API a
     * resolução pode custar uma consulta ao provider, e mensagem para conversa que já
     * existe não deve pagar por ela.
     */
    const contact = await this.resolveContact({
      item,
      instanceDbId: instanceId,
      destination,
    })
    const contactId = contact.id
    const contactName = await this.resolveDisplayName(input, contact.phone)

    try {
      const { chatId, payload } = await this.bitrixClient.sendToOpenChannel(
        vinculatedChannel,
        env.bitrix.connector.code,
        { id: contactId, name: contactName, phone: contact.phone },
        text,
      )

      /**
       * Resposta sem `session.CHAT_ID` **não** é erro: a mensagem entrou no canal, o
       * que o Bitrix não devolveu foi a referência da sessão. Tratar como falha
       * pediria uma retentativa que duplicaria a postagem.
       */
      if (chatId) {
        await this.persistOpenChannelRefs(
          instanceId,
          providerMessageId,
          chatId,
          contactId,
        )
      }

      apiLogger.info(
        { ...logContext, chatId, payload, openChannelOutcome: 'opened' },
        'Conversa do canal aberto criada para mensagem do widget',
      )

      return { outcome: 'opened', chatId, payload }
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

      return {
        outcome: 'failed',
        chatId: null,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /**
   * O nome que o operador vai ler: nome do contato no CRM, e telefone como alternativa.
   *
   * A consulta ao CRM acontece só aqui — depois do guard de conversa já aberta —, então
   * é uma por conversa, não por mensagem.
   *
   * Falha **não** interrompe a abertura: a mensagem já foi entregue ao contato quando
   * isto roda, e recusar a conversa por causa de um nome trocaria um problema cosmético
   * por uma conversa que não existe. Cai no telefone e segue.
   */
  private async resolveDisplayName(
    input: EnsureWidgetOpenChannelInput,
    phone: string | null,
  ): Promise<string> {
    const { entity, entityId } = input

    if (this.getCrmContactName && entity && entityId) {
      try {
        const name = await this.getCrmContactName({ entity, entityId })
        if (name?.trim()) return resolveContactDisplayName([name])
      } catch (err) {
        apiLogger.warn(
          {
            app: 'thinkzap',
            entity,
            entityId,
            err,
            crmContactNameLookupFailed: true,
          },
          'Nome do contato no CRM não resolvido; usando o telefone',
        )
      }
    }

    return resolveContactDisplayName([phone])
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
  private async persistOpenChannelRefs(
    instanceId: string,
    providerMessageId: string,
    bitrixChatId: string,
    contactId: string,
  ): Promise<void> {
    try {
      await this.messages.updateOpenChannelRefs(instanceId, providerMessageId, {
        bitrixChatId,
        chatId: contactId,
      })
    } catch (err) {
      apiLogger.warn(
        {
          app: 'thinkzap',
          instanceId,
          providerMessageId,
          bitrixChatId,
          contactId,
          err,
        },
        'Conversa aberta, mas as referências do canal aberto não puderam ser persistidas — o guard de idempotência fica sem efeito para esta mensagem',
      )
    }
  }
}
