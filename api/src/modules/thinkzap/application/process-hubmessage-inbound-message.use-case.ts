import { env } from '@/config/env'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { HubMessageWebhookMessage } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { findLineItemByChannelId } from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { normalizePhoneNumber } from '@/shared/helpers/normalize-phone-number'
import {
  BitrixClient,
  ISendMessageData,
} from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { buildHubMessageContent } from './build-hubmessage-content'
import { extractBitrixChatId } from './helpers/extract-bitrix-chat-id'

const log = createWorkerSourceLogger('hubmessage')

/**
 * Entrega no canal aberto do Bitrix uma mensagem recebida no WhatsApp Oficial
 * (HubMessage).
 *
 * Duas garantias que o payload da HubMessage exige atenção especial:
 *
 * - **Identidade do chat**: `message.chat_id` é `channel_id` + o número do
 *   NOSSO WABA — igual para todos os contatos do canal. Quem identifica o
 *   contato é `sender.identifier`. Usar `chat_id` colapsaria todos os contatos
 *   numa única sessão de canal aberto.
 * - **Idempotência**: o registro só é gravado depois do envio ao Bitrix, então
 *   o guard por `_id` roda ANTES do envio — é ele que impede a mensagem
 *   duplicada no canal aberto quando a HubMessage reentrega o webhook.
 */
export class ProcessHubMessageInboundMessageUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instanceRepo: GetInstanceRepository,
    private readonly domainRepo: GetDomainRepository,
    private readonly appRepo: GetInstalledAppRepository,
    private readonly credentialRepo: GetCredentialRepository,
    private readonly messageRepo: PrismaThinkzapMessageRepository,
  ) {}

  async execute(message: HubMessageWebhookMessage): Promise<void> {
    const channelId = message.channel_id

    log.info(
      {
        channelId,
        messageId: message._id,
        sender: message.sender?.identifier,
      },
      'Processing received HubMessage message',
    )

    const instance = await this.instanceRepo.getInstanceByChannelId(channelId)
    if (!instance) {
      log.warn(
        { channelId, messageId: message._id },
        'Instance not found for HubMessage channel',
      )
      throw new Error('Instance not found for HubMessage channel')
    }

    /**
     * A linha vem do **item de assinatura**, não de `Connector`.
     *
     * `Connector` servia para o guard de provider e para `appId`; o item dá os dois
     * — e de forma mais forte, porque ele declara o provider por qual par de
     * credencial está preenchido. Exigir a row fazia toda linha nascida na SPA
     * falhar com "Connector not found for instance".
     *
     * A row de `Instance` **continua** sendo o ponto de entrada: o webhook da
     * HubMessage entrega só `channel_id`, e ela é o único índice de canal →
     * instalação. Sem ela não há `domainId` para resolver o item.
     */
    const item = await findLineItemByChannelId(
      {
        channelId,
        domainId: instance.domainId,
        appCode: thinkzapAppCodeId(),
      },
      this.getAplicationContext,
    )

    /**
     * Item ausente cobre também o antigo guard de "conector não-oficial": a busca
     * filtra por `provider === HUBMESSAGE`, então canal que resolve para uma linha
     * Z-API simplesmente não corresponde. Uma checagem de provider depois disso
     * seria inalcançável.
     */
    if (!item) {
      log.warn(
        { channelId, internalInstanceId: instance.id, messageId: message._id },
        'Nenhuma linha HubMessage corresponde a este canal — recusando processar',
      )
      throw new Error(
        `Nenhuma linha HUBMESSAGE vinculada ao canal "${channelId}"`,
      )
    }

    /**
     * Vínculo do item: a coluna homônima da row deixou de ser escrita quando o
     * canal aberto passou para `ufCrm93Conector`.
     */
    const { vinculatedChannel } = item
    if (!vinculatedChannel) {
      log.warn(
        { channelId, subscriptionItemId: item.id, messageId: message._id },
        'Linha sem canal aberto vinculado',
      )
      throw new Error('Instance has no vinculated channel')
    }

    const alreadyProcessed = await this.messageRepo.findByProviderMessageId(
      instance.id,
      message._id,
    )
    if (alreadyProcessed) {
      log.info(
        {
          channelId,
          internalInstanceId: instance.id,
          messageId: message._id,
          duplicateSkipped: true,
        },
        'HubMessage message already delivered to Bitrix — skipping',
      )
      return
    }

    const content = buildHubMessageContent(message)
    if (!content) {
      log.warn(
        {
          channelId,
          messageId: message._id,
          contentTypes: message.contents?.map(item => item?.type),
          attachmentTypes: message.attachments?.map(item => item?.type),
          unsupportedContent: true,
        },
        'No supported content in HubMessage message — skipping',
      )
      return
    }

    const { domainId } = instance
    if (!domainId) {
      throw new Error('Domain ID is required')
    }

    // `appId` vinha de `Connector`; a instalação é alcançável pelo par canônico.
    const installedApp = await this.appRepo.getByAppCodeAndDomainId(
      thinkzapAppCodeId(),
      domainId,
    )
    if (!installedApp) {
      throw new Error(
        `Instalação não encontrada: domínio "${domainId}", app "${thinkzapAppCodeId()}"`,
      )
    }

    const domain = await this.domainRepo.getDomainById(domainId)
    const app = await this.appRepo.getById(installedApp.id)

    if (!app) {
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

    // Identidade do contato no canal aberto — NUNCA `message.chat_id` (ver doc
    // da classe). Usamos o identifier CRU: `normalizePhoneNumber` insere o 9o
    // digito em celular BR, e amarrar a sessao a essa heuristica faria o mesmo
    // contato ganhar sessao nova se ela mudasse. O normalizado vai so em
    // `user.phone`, onde serve pro Bitrix casar o contato no CRM.
    const contactId = message.sender.identifier
    const contactPhone = normalizePhoneNumber(contactId)
    const contactName = message.sender.name || contactPhone
    const moment = message.metadata?.moment ?? message.created

    const params: ISendMessageData = {
      CONNECTOR: env.bitrix.connector.code,
      LINE: Number(vinculatedChannel),
      MESSAGES: [
        {
          chat: {
            id: contactId,
            name: `${contactName} - ${contactPhone}`,
          },
          user: {
            id: contactId,
            name: contactName,
            last_name: '',
            phone: contactPhone,
          },
          message: {
            id: message._id,
            date: new Date(moment).toISOString(),
            text: content.text,
            files: content.files,
          },
        },
      ],
    }

    log.debug(
      {
        channelId,
        messageId: message._id,
        connectorCode: params.CONNECTOR,
        channel: params.LINE,
        chatId: contactId,
        type: content.type,
        filesCount: content.files?.length ?? 0,
      },
      'Prepared HubMessage payload to send to Bitrix',
    )

    const result: unknown = await bitrixClient.sendMessage(params)

    const bitrixChatId = extractBitrixChatId(result)

    log.info(
      {
        channelId,
        messageId: message._id,
        bitrixChatId,
      },
      'HubMessage message sent to Bitrix',
    )

    const bitrixMessageId = bitrixChatId
      ? await bitrixClient.getLastMessageId(bitrixChatId)
      : null

    if (bitrixChatId && !bitrixMessageId) {
      log.warn(
        {
          channelId,
          messageId: message._id,
          bitrixChatId,
          bitrixMessageIdLookupFailed: true,
        },
        'Failed to resolve real Bitrix message id via im.dialog.get',
      )
    }

    try {
      await this.messageRepo.create({
        instanceId: instance.id,
        source: 'HUBMESSAGE',
        providerMessageId: message._id,
        bitrixMessageId,
        bitrixChatId,
        type: content.type,
        text: content.text || null,
        fileName: content.fileName ?? null,
        chatId: contactId,
      })
    } catch (err) {
      // Sem re-throw: a mensagem já está no Bitrix e o retry a duplicaria.
      log.warn(
        { channelId, messageId: message._id, err, dbWriteFailed: true },
        'Failed to persist inbound HubMessage snapshot',
      )
    }
  }
}
