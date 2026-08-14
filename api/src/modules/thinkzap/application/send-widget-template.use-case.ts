import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { TemplateMessageSenderResolver } from '@/modules/thinkzap/domain/ports/template-sender-resolver.port'
import { SendNotification } from '@/shared/data/contracts/send-notification'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'
import { apiLogger } from '@/shared/infra/logger'
import { PrismaThinkzapMessageRepository } from '../infra/persistence/repositories/prisma-thinkzap-message.repository'
import { OpenChannelConversationQueue } from '@/modules/thinkzap/domain/ports/open-channel-queue.port'
import { ensureLineInstance } from './helpers/ensure-line-instance'
import { resolveTemplateBody } from './helpers/resolve-template-body'
import { resolveTemplateLine } from './helpers/resolve-template-context'
import {
  SendWidgetTemplateInput,
  SendWidgetTemplateResult,
} from './send-widget-template.types'

/**
 * Envio de **template aprovado** pelo widget — o caminho da linha do WhatsApp
 * Oficial.
 *
 * Use case separado de `SendWidgetMessageUseCase` de propósito: aquele recebe
 * `ZApiClient` concreto e trata anexo, áudio e conversão para mp3. Tornar aquele
 * provider-aware misturaria conversão de mídia com template e arriscaria o caminho
 * Z-API, que é o que está em produção. Duas rotas, um use case cada.
 *
 * A ordem das recusas é a mesma do envio livre, e por isso mesmo:
 * **habilitação → capacidade de provider → canal conectado → destino → envio.**
 * Entitlement primeiro porque linha de trial vencido não envia mesmo conectada, e
 * responder "provider não suporta" descreveria errado o motivo. Destino antes do
 * provider porque telefone inválido não merece uma ida à rede.
 */
export class SendWidgetTemplateUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instances: GetInstanceRepository &
      CreateInstanceRepository,
    private readonly templateSenderResolver: TemplateMessageSenderResolver,
    private readonly sendBitrixNotification: SendNotification,
    private readonly messageRepository: PrismaThinkzapMessageRepository,
    /**
     * Abertura da conversa no canal aberto, enfileirada — a mesma fila do envio livre.
     *
     * Abrir a conversa é operação Bitrix, idêntica nos dois providers, então o mesmo
     * job serve. E é aqui que a linha do WhatsApp Oficial ganha retentativa junto: ela
     * não tinha bridge nenhum enquanto a abertura vivia no callback de status da Z-API.
     */
    private readonly openChannelQueue: OpenChannelConversationQueue,
  ) {}

  async execute(
    input: SendWidgetTemplateInput,
  ): Promise<SendWidgetTemplateResult> {
    const {
      subscriptionItemId,
      domainId,
      appCode,
      destination,
      templateName,
      language,
      bodyParameters,
      templateBody,
      entity,
      entityId,
    } = input

    /**
     * `requireEnabled: true` — enviar é operação de linha habilitada, e
     * `LineBlockedError` é o que o front distingue de falta de permissão. A mesma
     * chamada valida provider (`ConnectorNotTemplateCapableError` para Z-API) e canal
     * conectado (`ChannelNotConnectedError` sem `wabaId`), nessa ordem.
     */
    const { item } = await resolveTemplateLine(
      { subscriptionItemId, domainId, appCode },
      { getAplicationContext: this.getAplicationContext },
      { requireEnabled: true },
    )

    const normalizedPhone = normalizePhoneNumber(destination)
    if (!isValidZApiPhoneNumber(normalizedPhone)) {
      throw new Error('Invalid destination phone number')
    }

    /**
     * `resolveTemplateLine` já garantiu `provider === 'HUBMESSAGE'`; o narrow aqui é
     * para o TypeScript alcançar `hubmessageChannelId` na união discriminada.
     */
    if (item.metadata.provider !== 'HUBMESSAGE') {
      throw new Error('Linha sem canal HubMessage para envio de template')
    }

    const sender = this.templateSenderResolver.resolve(
      ConnectorProvider.HUBMESSAGE,
      {
        channelId: item.metadata.hubmessageChannelId,
        recipientIdentifier: normalizedPhone,
      },
    )

    const { messageId } = await sender.send({
      templateName,
      language,
      bodyParameters,
    })

    /**
     * A âncora de `Instance` nasce **depois** do envio aceito: a mensagem persistida
     * tem chave estrangeira para `Instance.id`, e um envio recusado não pode deixar
     * row para trás. Mesma ordem do envio livre.
     */
    const instance = await ensureLineInstance(item, domainId, this.instances)

    /**
     * O texto persistido é o corpo **resolvido** — o que o contato recebeu. Guardar o
     * template cru deixaria `{{1}}` no histórico do CRM.
     *
     * `type: 'TEXT'` porque o enum de tipo de mensagem não tem valor para template, e
     * criar um exigiria migração sem mudar nada para o operador. `source: 'BITRIX'`
     * porque a origem é o widget, como no envio livre.
     */
    const sentText = resolveTemplateBody(templateBody, bodyParameters)

    await this.messageRepository.create({
      instanceId: instance.id,
      source: 'BITRIX',
      providerMessageId: messageId,
      type: 'TEXT',
      text: sentText,
    })

    /**
     * O texto que abre a conversa é o corpo **resolvido** — o mesmo que foi
     * persistido e o mesmo que o contato recebeu. Postar o template cru deixaria
     * `{{1}}` no histórico do canal aberto.
     *
     * `try/catch` porque o envio já aconteceu: o template está no telefone do
     * contato, e um erro que subisse daqui faria o operador reenviar um template —
     * que na maioria dos casos é cobrado pela Meta.
     */
    try {
      await this.openChannelQueue.enqueue({
        subscriptionItemId,
        domainId,
        appCode,
        instanceId: instance.id,
        providerMessageId: messageId,
        destination: normalizedPhone,
        text: sentText,
      })
    } catch (err) {
      apiLogger.error(
        { app: 'thinkzap', subscriptionItemId: item.id, err },
        'Não foi possível enfileirar a abertura da conversa; envio de template preservado',
      )
    }

    await this.sendBitrixNotification.execute({
      contextId: entityId,
      entity,
      message: `Para: ${destination}\nTemplate: ${templateName}\nMensagem: ${sentText}`,
    })

    return {
      message: 'Template sent successfully',
      destination: normalizedPhone,
      sentMessageId: messageId,
      sentText,
    }
  }
}
