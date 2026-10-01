import { env } from '@/config/env'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { resolveOpenChannelContactId } from '@/shared/helpers/open-channel-contact-id'
import { normalizePhoneNumber } from '@/shared/helpers/normalize-phone-number'
import { resolveContactDisplayName } from './open-channel-contact-display'
import { apiLogger } from '@/shared/infra/logger'

/** Todo desfecho é explícito e logado: nenhum guard recusa em silêncio. */
export type OpenChannelOutcome =
  | 'opened'
  | 'already-open'
  | 'toggle-off'
  | 'no-channel'
  | 'failed'

export type EnsureWidgetOpenChannelResult = {
  outcome: OpenChannelOutcome
  chatId: string | null
  /** Só em `opened`. */
  payload?: unknown
  /** Só em `failed`. */
  error?: string
}

export type EnsureWidgetOpenChannelInput = {
  /** Canal e toggle saem do item, nunca da row de `Instance`. */
  item: SubscriptionItem
  /** `Instance.id` (uuid do banco). */
  instanceId: string
  providerMessageId: string
  /** Não é a identidade: quem decide o `chat.id` é `resolveContact` (LID na Z-API). */
  destination: string
  /** Em envio só de anexo, o descritivo do tipo. */
  text: string
  /** Só para o nome do contato; sem entidade cai no telefone. */
  entity?: string
  entityId?: string
}

/** Na Z-API a identidade é o LID e pode exigir consulta ao provider. */
export type ResolveOpenChannelContact = (input: {
  item: SubscriptionItem
  instanceDbId: string
  destination: string
}) => Promise<{ id: string; phone: string | null }>

export type GetCrmContactName = (input: {
  entity: string
  entityId: string
}) => Promise<string | null>

export type OpenChannelMessageStore = Pick<
  PrismaThinkzapMessageRepository,
  'findByProviderMessageId' | 'updateOpenChannelRefs'
>

export type OpenChannelSender = Pick<BitrixClient, 'sendToOpenChannel'>

// Abre (ou reusa) a conversa no canal aberto para mensagem do widget; agnóstico de provider.
// Nunca lança: a mensagem já foi entregue e erro faria o operador reenviar.
export class EnsureWidgetOpenChannelConversation {
  constructor(
    private readonly bitrixClient: OpenChannelSender,
    private readonly messages: OpenChannelMessageStore,
    /** Default: identidade = telefone canonizado (HubMessage). */
    private readonly resolveContact: ResolveOpenChannelContact = ({
      destination,
    }) =>
      Promise.resolve({
        id: resolveOpenChannelContactId(destination),
        phone: normalizePhoneNumber(destination),
      }),
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

    // Canal antes do toggle, para o log nomear o motivo real.
    if (!vinculatedChannel) {
      return this.skip('no-channel', logContext)
    }

    if (!widgetOpenChannelEnabled) {
      return this.skip('toggle-off', logContext)
    }

    // Guard de idempotência. Rows antigas guardam a sessão em `chat_id`; sem o fallback
    // a retentativa re-postaria (backfill inviável: corromperia o histórico do operador).
    const existing = await this.findMessage(instanceId, providerMessageId)
    const openedChatId = existing?.bitrixChatId ?? existing?.chatId
    if (openedChatId) {
      return this.skip('already-open', logContext, openedChatId)
    }

    // Resolvida uma vez e após o guard: na Z-API pode custar uma consulta ao provider.
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

      // Sem `session.CHAT_ID` não é erro: a mensagem entrou; retentar duplicaria.
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

  /** Falha no CRM cai no telefone: nome é cosmético, não pode impedir a conversa. */
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
        logThinkzapError(
          apiLogger,
          'thinkzap.bitrix.contact_read_failed',
          {
            app: 'thinkzap',
            entity,
            entityId,
            err,
            crmContactNameLookupFailed: true,
          },
          { msg: 'Nome do contato no CRM não resolvido; usando o telefone' },
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

  /** Tolerante: postagem repetida é melhor que nenhuma conversa. */
  private async findMessage(instanceId: string, providerMessageId: string) {
    try {
      return await this.messages.findByProviderMessageId(
        instanceId,
        providerMessageId,
      )
    } catch (err) {
      logThinkzapError(
        apiLogger,
        'thinkzap.message.open_channel_guard_failed',
        { app: 'thinkzap', instanceId, providerMessageId, step: 'read', err },
        {
          msg: 'Não foi possível ler a mensagem para checar se a conversa já está aberta',
        },
      )
      return null
    }
  }

  /** Tolerante: a conversa já abriu, não vira `failed`. */
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
      logThinkzapError(
        apiLogger,
        'thinkzap.message.open_channel_guard_failed',
        {
          app: 'thinkzap',
          instanceId,
          providerMessageId,
          bitrixChatId,
          contactId,
          step: 'persist',
          err,
        },
        {
          msg: 'Conversa aberta, mas as referências do canal aberto não puderam ser persistidas — o guard de idempotência fica sem efeito para esta mensagem',
        },
      )
    }
  }
}
