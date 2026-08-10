import { env } from '@/config/env'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { findLineItemByInstanceId } from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { DisconnectExpiredLine } from '@/modules/thinkzap/application/disconnect-expired-line'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import {
  BitrixClient,
  ISendMessageData,
} from '@/shared/infra/clients/bitrix.client'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { normalizePhoneNumber } from '@/shared/helpers/normalize-phone-number'
import { Domain } from '@/shared/domain/entities/domain'
import { Credential } from '@/shared/domain/entities/credential'
import { Instance } from '@/modules/thinkzap/domain/entities/instance'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  toQuoteInput,
  PrismaThinkzapMessageRepository,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import {
  ThinkzapMessageQuoteInput,
  buildMessageTextWithReply,
  extractQuoteInput,
  getQuoteInputType,
} from './build-reply-quote'
import { extractBitrixChatId } from './helpers/extract-bitrix-chat-id'

const log = createWorkerSourceLogger('z-api')

export class ProcessZApiInboundMessageUseCase {
  constructor(
    /**
     * Resolve a linha pelo item de assinatura. Substituiu `GetConnectorRepository`,
     * que só servia para descobrir `appId` e obrigava a existir row de `Connector`.
     */
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instanceRepo: GetInstanceRepository,
    private readonly domainRepo: GetDomainRepository,
    private readonly appRepo: GetInstalledAppRepository,
    private readonly credentialRepo: GetCredentialRepository,
    private readonly messageRepo: PrismaThinkzapMessageRepository,
    /**
     * Desconecta o recurso remoto quando o trial venceu. É o caminho que **mais**
     * precisa disso: uma mensagem chegando aqui prova que o telefone do cliente
     * ainda está pareado com uma linha que o app descarta.
     */
    private readonly disconnectExpiredLine: DisconnectExpiredLine,
  ) {}

  async execute(event: ReceivedMessageEvent): Promise<void> {
    log.info(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        phone: event.phone,
        isGroup: event.isGroup,
        isEdit: event.isEdit,
        editMessageId: event.editMessageId,
        referenceMessageId: event.referenceMessageId,
      },
      'Processing received Z-API message',
    )

    if (event.isEdit && !event.editMessageId) {
      log.warn(
        {
          instanceId: event.instanceId,
          messageId: event.messageId,
        },
        'isEdit=true but editMessageId missing — skipping',
      )
      return
    }

    const instance = await this.instanceRepo.getInstanceByInstanceId(
      event.instanceId,
    )
    if (!instance) {
      logThinkzapError(
        log,
        'thinkzap.message.inbound_zapi_failed',
        {
          instanceId: event.instanceId,
          messageId: event.messageId,
          instance: JSON.stringify(instance),
        },
        { level: 'warn', msg: 'Instance not found for received message' },
      )
      throw new Error('Instance not found for received message')
    }
    const { domainId } = instance
    if (!domainId) {
      throw new Error('Domain ID is required')
    }

    /**
     * A linha é resolvida pelo **item de assinatura**, não por `Connector`.
     *
     * `Connector` entrava aqui só para fornecer `appId`, e a instalação já é
     * alcançável por (`appCodeId`, `domainId`). Exigir a row fazia toda linha nascida
     * direto na SPA falhar com "Connector not found for instance": a mensagem chegava
     * da Z-API e morria no worker, sem caminho de recuperação.
     */
    const line = await findLineItemByInstanceId(
      {
        instanceId: event.instanceId,
        domainId,
        appCode: thinkzapAppCodeId(),
      },
      this.getAplicationContext,
    )

    if (!line) {
      logThinkzapError(
        log,
        'thinkzap.message.inbound_zapi_failed',
        {
          instanceId: event.instanceId,
          internalInstanceId: instance.id,
          messageId: event.messageId,
        },
        {
          level: 'warn',
          msg: 'Nenhum item de assinatura corresponde a esta instância',
        },
      )
      throw new Error('Line not found for received message')
    }

    const { item } = line

    /**
     * Descarta **antes** de persistir mensagem ou criar conversa: mensagem de linha
     * bloqueada não deve virar row em `messages` nem aparecer no CRM.
     *
     * Retorna em vez de lançar, porque o worker traduz exceção em retry — e o
     * provider reentregaria indefinidamente uma mensagem que nunca vai ser aceita.
     */
    if (line.entitlement !== 'active') {
      log.info(
        {
          instanceId: event.instanceId,
          subscriptionItemId: item.id,
          messageId: event.messageId,
          entitlement: line.entitlement,
        },
        'Mensagem descartada: linha sem assinatura ativa',
      )

      /**
       * Sem `await`: o descarte já aconteceu, e o worker não pode esperar o provider
       * para confirmar uma mensagem que ele vai jogar fora.
       */
      this.disconnectExpiredLine.schedule(item, line.entitlement)
      return
    }

    /**
     * Vínculo do **item**, não da coluna da row: aquela deixou de ser escrita
     * quando o canal passou para `ufCrm93Conector`, e devolveria o valor de antes
     * da migração.
     */
    const { vinculatedChannel } = item
    if (!vinculatedChannel) {
      logThinkzapError(
        log,
        'thinkzap.message.inbound_zapi_failed',
        {
          instanceId: event.instanceId,
          subscriptionItemId: item.id,
          messageId: event.messageId,
        },
        { level: 'warn', msg: 'Linha sem canal aberto vinculado' },
      )
      throw new Error('Instance has no vinculated channel')
    }

    const installedApp = await this.appRepo.getByAppCodeAndDomainId(
      thinkzapAppCodeId(),
      domainId,
    )
    if (!installedApp) {
      logThinkzapError(
        log,
        'thinkzap.app.not_found',
        { instanceId: event.instanceId, domainId, messageId: event.messageId },
        {
          level: 'error',
          msg: `Instalação não encontrada: domínio "${domainId}", app "${thinkzapAppCodeId()}"`,
        },
      )
      throw new Error(
        `Instalação não encontrada: domínio "${domainId}", app "${thinkzapAppCodeId()}"`,
      )
    }

    const domain = await this.domainRepo.getDomainById(domainId)
    const app = await this.appRepo.getById(installedApp.id)

    if (!app) {
      logThinkzapError(
        log,
        'thinkzap.app.not_found',
        { instanceId: event.instanceId, domainId, messageId: event.messageId },
        { level: 'error', msg: 'App not found' },
      )
      throw new Error('App not found')
    }

    const credential = await this.credentialRepo.get({ appId: app.id })

    if (!domain || !credential) {
      throw new Error('Domain or credential not found')
    }

    const bitrixClient = new BitrixClient({
      bitrixCredential: credential,
      domain: domain.name,
    })

    const files = buildMessageFiles(event)
    const normalizedPhone = normalizePhoneNumber(event.phone)

    if (event.isGroup) {
      await this.sendGroupMessage(
        event,
        domain,
        credential,
        instance,
        vinculatedChannel,
        normalizedPhone,
        files,
      )
      return
    }

    const chatId = resolveChatId(event)
    if (!chatId) {
      throw new Error('Chat ID not found')
    }

    const outgoingMessageId = event.messageId
    const baseText = event.contact
      ? buildContactText(event.contact)
      : event.image
        ? event.image.caption
        : event.video
          ? event.video.caption
          : event.text?.message || ''

    const { text, cached, replyLookupFailed } = await this.applyReplyContext(
      event,
      baseText,
      instance.id,
    )

    const params: ISendMessageData = {
      CONNECTOR: env.bitrix.connector.code,
      LINE: Number(vinculatedChannel),
      MESSAGES: [
        {
          chat: {
            id: chatId,
            name: event.chatName + ' - ' + normalizedPhone,
          },
          user: {
            id: chatId,
            name: event.chatName ?? event.senderName,
            last_name: '',
            phone: normalizedPhone,
            picture: {
              url: event.photo,
            },
          },
          message: {
            id: outgoingMessageId,
            date: new Date(event.momment).toISOString(),
            text,
            files,
          },
        },
      ],
    }

    log.debug(
      {
        messageId: event.messageId,
        outgoingMessageId,
        isEdit: event.isEdit,
        connectorCode: params.CONNECTOR,
        channel: params.LINE,
        filesCount: files?.length ?? 0,
        hasReplyContext: Boolean(cached),
        replyLookupFailed,
        replyOriginalType: getQuoteInputType(cached),
      },
      'Prepared message payload to send to Bitrix',
    )

    const result: unknown = event.isEdit
      ? await bitrixClient.updateMessage(params)
      : event.notification === 'REVOKE'
        ? await bitrixClient.deleteMessage(params)
        : await bitrixClient.sendMessage(params)

    log.info(
      {
        messageId: event.messageId,
        outgoingMessageId,
        isEdit: event.isEdit,
        result: JSON.stringify(result),
        hasReplyContext: Boolean(cached),
        replyLookupFailed,
        replyOriginalType: getQuoteInputType(cached),
      },
      event.isEdit ? 'Message updated in Bitrix' : 'Message sent to Bitrix',
    )

    const bitrixChatId = extractBitrixChatId(result)
    const bitrixMessageId = await resolveBitrixMessageId(
      bitrixClient,
      bitrixChatId,
      event,
    )
    await this.persistInboundSnapshot(
      event,
      instance.id,
      bitrixMessageId,
      bitrixChatId,
      chatId,
    )
  }

  private async sendGroupMessage(
    event: ReceivedMessageEvent,
    domain: Domain,
    credential: Credential,
    instance: Instance,
    /** Do item de assinatura, não de `instance.vinculatedChannel`. */
    vinculatedChannel: string,
    normalizedPhone: string,
    files?: { url: string; name: string }[],
  ): Promise<void> {
    log.info(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        phone: event.phone,
        senderName: event.senderName,
        isEdit: event.isEdit,
        editMessageId: event.editMessageId,
        referenceMessageId: event.referenceMessageId,
      },
      'Processing group message for Bitrix',
    )

    const chatId = resolveGroupChatId(event)
    if (!chatId) {
      throw new Error('Chat ID not found')
    }

    const outgoingMessageId = event.isEdit
      ? event.editMessageId
      : event.messageId

    log.debug(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        isEdit: event.isEdit,
        editMessageId: event.editMessageId,
        outgoingMessageId,
      },
      'Group message routing',
    )

    const getNotificationMessage = {
      GROUP_CHANGE_ICON: 'The group icon has been changed',
      GROUP_CREATE: 'A new group has been created',
    }

    const baseText: string = event?.notification
      ? (getNotificationMessage[
          event.notification as keyof typeof getNotificationMessage
        ] ?? '')
      : event.contact
        ? `[b]${event.senderName}[/b]:\n${buildContactText(event.contact)}`
        : '[b]' +
          event.senderName +
          '[/b]:\n' +
          (event.image
            ? event.image.caption
            : event.video
              ? event.video.caption
              : event.text?.message || '')

    const { text, cached, replyLookupFailed } = await this.applyReplyContext(
      event,
      baseText,
      instance.id,
    )

    const params: ISendMessageData = {
      CONNECTOR: env.bitrix.connector.code,
      LINE: Number(vinculatedChannel),
      MESSAGES: [
        {
          chat: {
            id: chatId,
            name: event.chatName,
          },
          user: {
            id: chatId,
            name: event.chatName ?? normalizedPhone,
            last_name: '',
            phone: normalizedPhone,
            picture: {
              url: event.photo,
            },
          },
          message: {
            id: outgoingMessageId,
            date: new Date(event.momment).toISOString(),
            text,
            files,
          },
        },
      ],
    }

    const bitrixClient = new BitrixClient({
      bitrixCredential: credential,
      domain: domain.name,
    })

    let result: unknown
    if (event.isEdit) {
      result = await bitrixClient.updateMessage(params)
    } else {
      result = await bitrixClient.sendMessage(params)
    }

    log.info(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        isEdit: event.isEdit,
        hasReplyContext: Boolean(cached),
        replyLookupFailed,
        replyOriginalType: getQuoteInputType(cached),
      },
      event.isEdit
        ? 'Group message updated in Bitrix'
        : 'Group message sent to Bitrix',
    )

    const bitrixChatId = extractBitrixChatId(result)
    const bitrixMessageId = await resolveBitrixMessageId(
      bitrixClient,
      bitrixChatId,
      event,
    )
    await this.persistInboundSnapshot(
      event,
      instance.id,
      bitrixMessageId,
      bitrixChatId,
      chatId,
    )
  }

  private async applyReplyContext(
    event: ReceivedMessageEvent,
    baseText: string,
    instanceDbId: string,
  ): Promise<{
    text: string
    cached: ThinkzapMessageQuoteInput | null
    replyLookupFailed: boolean
  }> {
    if (!event.referenceMessageId) {
      return { text: baseText, cached: null, replyLookupFailed: false }
    }

    let cached: ThinkzapMessageQuoteInput | null = null
    let replyLookupFailed = false

    try {
      const record = await this.messageRepo.findByProviderMessageId(
        instanceDbId,
        event.referenceMessageId,
      )
      if (record) {
        cached = toQuoteInput(record)
      } else {
        replyLookupFailed = true
      }
    } catch (err) {
      replyLookupFailed = true
      log.warn(
        {
          instanceId: event.instanceId,
          referenceMessageId: event.referenceMessageId,
          replyLookupFailed: true,
          err,
        },
        'Reply lookup in DB failed',
      )
    }

    try {
      const text = buildMessageTextWithReply({ event, cached, baseText })
      return { text, cached, replyLookupFailed }
    } catch (err) {
      log.warn(
        {
          instanceId: event.instanceId,
          messageId: event.messageId,
          referenceMessageId: event.referenceMessageId,
          err,
          quoteBuildFailed: true,
        },
        'Failed to build reply quote — sending message without quote prefix',
      )
      return { text: baseText, cached, replyLookupFailed }
    }
  }

  private async persistInboundSnapshot(
    event: ReceivedMessageEvent,
    instanceDbId: string,
    bitrixMessageId: string | null,
    bitrixChatId: string | null,
    chatId: string | null,
  ): Promise<void> {
    if (event.notification === 'REVOKE' || event.isEdit) return

    try {
      const quoteInput = extractQuoteInput(event)
      await this.messageRepo.create({
        instanceId: instanceDbId,
        source: 'ZAPI',
        providerMessageId: event.messageId,
        bitrixMessageId,
        bitrixChatId,
        type: quoteInput.type,
        text: quoteInput.text ?? null,
        fileName: quoteInput.fileName ?? null,
        chatId,
      })
    } catch (err) {
      log.warn(
        {
          instanceId: event.instanceId,
          messageId: event.messageId,
          err,
          dbWriteFailed: true,
        },
        'Failed to persist inbound message snapshot',
      )
    }
  }
}

async function resolveBitrixMessageId(
  bitrixClient: BitrixClient,
  bitrixChatId: string | null,
  event: ReceivedMessageEvent,
): Promise<string | null> {
  if (event.notification === 'REVOKE' || event.isEdit || !bitrixChatId) {
    return null
  }

  const bitrixMessageId = await bitrixClient.getLastMessageId(bitrixChatId)
  if (!bitrixMessageId) {
    log.warn(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        bitrixChatId,
        bitrixMessageIdLookupFailed: true,
      },
      'Failed to resolve real Bitrix message id via im.dialog.get',
    )
  }
  return bitrixMessageId
}

function buildMessageFiles(
  event: ReceivedMessageEvent,
): { url: string; name: string }[] | undefined {
  if (event.image)
    return [{ url: event.image.imageUrl, name: event.image.mimeType }]
  if (event.audio)
    return [{ url: event.audio.audioUrl, name: 'Mensagem de áudio.mp3' }]
  if (event.video)
    return [{ url: event.video.videoUrl, name: 'Mensagem de vídeo.mp4' }]
  if (event.document)
    return [{ url: event.document.documentUrl, name: event.document.fileName }]
  if (event.sticker)
    return [{ url: event.sticker.stickerUrl, name: 'Sticker.webp' }]
  return undefined
}

function buildContactText(
  contact: NonNullable<ReceivedMessageEvent['contact']>,
): string {
  const phones = contact.phones.map(p => `📞 ${p}`).join('\n')
  return `------------------------\n Contato encaminhado:\n 🛍️[b]${contact.displayName}[/b]\n${phones}`
}

function resolveChatId(event: ReceivedMessageEvent): string | null {
  if (event.phone.includes('@lid')) return event.phone
  return event.chatLid
}

function resolveGroupChatId(event: ReceivedMessageEvent): string | null {
  return event.phone.includes('-group') ? event.phone : event.chatLid
}
