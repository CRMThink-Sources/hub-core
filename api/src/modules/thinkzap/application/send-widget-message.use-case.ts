import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { CreateInstanceRepository } from '@/modules/thinkzap/domain/repositories/create-instance.repository'
import { apiLogger } from '@/shared/infra/logger'
import { assertLineConnected } from './helpers/assert-line-connected'
import { ensureLineInstance } from './helpers/ensure-line-instance'
import {
  assertLineEnabled,
  findLineInContext,
} from './helpers/resolve-line-by-subscription-item'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { ZApiClient } from '@/modules/thinkzap/infra/clients/z-api.client'
import { convertToMp3 } from '@/shared/helpers/convert-to-mp3'
import {
  isValidZApiPhoneNumber,
  normalizePhoneNumber,
} from '@/shared/helpers/normalize-phone-number'
import { SendNotification } from '@/shared/data/contracts/send-notification'
import {
  SendWidgetMessageInput,
  SendWidgetMessageResult,
  WidgetAttachmentKind,
  WidgetMessageAttachmentInput,
} from './send-widget-message.types'
import { PrismaThinkzapMessageRepository } from '../infra/persistence/repositories/prisma-thinkzap-message.repository'
import { OpenChannelConversationQueue } from '@/modules/thinkzap/domain/ports/open-channel-queue.port'
import { resolveOpenChannelText } from './helpers/describe-attachment-text'

/** Uma mensagem aceita pelo provider — uma row de `core_thinkerszap_messages`. */
type SentMessage = {
  providerMessageId: string
  type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'
  text: string | null
  fileName: string | null
}

/**
 * O `type` persistido de cada tipo de anexo do widget.
 *
 * O caminho antigo gravava `type: 'TEXT'` fixo para o envio inteiro, então a row de
 * uma imagem mentia o tipo — e o quote de reply decide o formato do BBCode por
 * `type`.
 */
const TYPE_BY_ATTACHMENT_KIND: Record<
  WidgetAttachmentKind,
  SentMessage['type']
> = {
  image: 'IMAGE',
  video: 'VIDEO',
  audio: 'AUDIO',
  file: 'DOCUMENT',
}

export class SendWidgetMessageUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instances: GetInstanceRepository &
      CreateInstanceRepository,
    private readonly zApiClient: ZApiClient,
    private readonly sendBitrixNotification: SendNotification,
    private readonly messageRepository: PrismaThinkzapMessageRepository,
    /**
     * A abertura da conversa no canal aberto, **enfileirada**.
     *
     * Era chamada direta aqui dentro; virou job para ganhar retentativa — Bitrix fora
     * por trinta segundos deixava a conversa sem abrir e ninguém tentava de novo. É
     * seguro retentar porque a abertura é idempotente pelo `chat_id` persistido.
     *
     * Um port, e não a fila concreta: este use case é testado sem Redis.
     */
    private readonly openChannelQueue: OpenChannelConversationQueue,
  ) {}

  async execute(
    input: SendWidgetMessageInput,
  ): Promise<SendWidgetMessageResult> {
    const {
      subscriptionItemId,
      domainId,
      appCode,
      destination,
      message,
      attachments = [],
      entity,
      entityId,
    } = input

    if (!message?.trim() && attachments.length === 0) {
      throw new Error('Message or at least one attachment is required')
    }

    /**
     * A linha vem do item de assinatura. `Connector` saiu: linha nascida direto na
     * SPA não tem row naquela tabela, e o widget passou a identificar a linha pelo
     * id do item.
     *
     * A autorização sai de graça: o contexto é resolvido pelo par (`domainId`,
     * `appCode`) do JWT, então item de outra instalação não está na árvore.
     */
    const context = await this.getAplicationContext.execute({
      domainId,
      appCode,
    })

    /**
     * Recusa antes de resolver credencial: enviar é operação de linha habilitada, e
     * `LineBlockedError` é o que o front distingue de falta de permissão.
     */
    assertLineEnabled(context, subscriptionItemId, new Date())

    const line = findLineInContext(context, subscriptionItemId)

    /**
     * Ordem: **habilitação → conexão → provider.**
     *
     * Entitlement primeiro porque linha de trial vencido não envia mesmo conectada, e
     * responder "não está conectada" descreveria errado o motivo. Conexão antes do
     * provider porque, sem esta checagem, a desconexão só aparecia como falha de
     * `sendMessage` — com o texto cru da Z-API na tela do operador, depois de ele ter
     * digitado a mensagem e escolhido os anexos.
     *
     * E **antes** de `ensureLineInstance`: um envio recusado não pode deixar row de
     * `Instance` para trás.
     *
     * Status ilegível não recusa — ver `assertLineConnected`.
     */
    await assertLineConnected(this.zApiClient, line, subscriptionItemId)

    /**
     * A âncora de `Instance` existe porque a mensagem persistida tem chave
     * estrangeira para `Instance.id`. Criada quando falta — ver `ensureLineInstance`.
     */
    const instance = await ensureLineInstance(
      line.item,
      domainId,
      this.instances,
    )

    const phoneData = await this.zApiClient.getPhoneData(
      line.zApiInstanceId,
      line.zApiInstanceToken,
    )

    const normalizedPhone = normalizePhoneNumber(destination)
    if (!isValidZApiPhoneNumber(normalizedPhone)) {
      throw new Error('Invalid destination phone number')
    }

    /**
     * Uma entrada por mensagem aceita pelo provider, e não só os ids: o tipo e o
     * nome do arquivo de cada uma precisam chegar até a persistência. O caminho
     * antigo guardava apenas `string[]`, gravava **uma** row com o primeiro id e
     * `type: 'TEXT'` fixo — então um envio de texto com dois anexos virava três
     * mensagens no WhatsApp e uma row mentindo o tipo.
     */
    const sentMessages: SentMessage[] = []

    if (message?.trim()) {
      const result = await this.zApiClient.sendMessage(
        line.zApiInstanceId,
        line.zApiInstanceToken,
        message.trim(),
        normalizedPhone,
      )

      sentMessages.push({
        providerMessageId: result.messageId,
        type: 'TEXT',
        text: message.trim(),
        fileName: null,
      })
    }

    for (const attachment of attachments) {
      const messageId = await this.sendAttachment(
        attachment,
        line.zApiInstanceId,
        line.zApiInstanceToken,
        normalizedPhone,
      )

      const type = TYPE_BY_ATTACHMENT_KIND[attachment.kind]

      sentMessages.push({
        providerMessageId: messageId,
        type,
        text: null,
        /**
         * Só documento persiste `fileName` — imagem, vídeo e áudio nunca gravaram o
         * nome do arquivo, e o fluxo do operador (`persistOutboundMessage`) faz o
         * mesmo recorte.
         */
        fileName: type === 'DOCUMENT' ? (attachment.name ?? null) : null,
      })
    }

    for (const sent of sentMessages) {
      await this.messageRepository.create({
        instanceId: instance.id,
        source: 'BITRIX',
        providerMessageId: sent.providerMessageId,
        type: sent.type,
        text: sent.text,
        fileName: sent.fileName,
      })
    }

    /**
     * A conversa do canal aberto é enfileirada aqui, **uma vez por envio** — não uma
     * vez por mídia, que dobraria o prefixo `[Mensagem enviada a partir do CRM]` no
     * histórico do cliente.
     *
     * Ancorada na **primeira** mensagem enviada: é a row cujo `chat_id` guarda a
     * sessão, e é por ela que o guard de idempotência decide.
     *
     * Depois da persistência, porque o worker vai ler essa row para decidir se a
     * conversa já está aberta. Enfileirar antes abriria uma corrida com a própria
     * escrita — exatamente o defeito que o callback de status tinha.
     */
    await this.openConversation({
      subscriptionItemId,
      domainId,
      appCode,
      instanceId: instance.id,
      providerMessageId: sentMessages[0]?.providerMessageId,
      destination: normalizedPhone,
      text: resolveOpenChannelText(
        message,
        attachments.map(attachment => attachment.kind),
      ),
    })

    await this.sendBitrixNotification.execute({
      contextId: entityId,
      entity,
      message: `De: ${phoneData?.phone ?? ''}\nPara: ${destination}\nMensagem: ${message?.trim() || ''}`,
    })

    return {
      message: 'Message sent successfully',
      destination: normalizedPhone,
      sentMessageIds: sentMessages.map(sent => sent.providerMessageId),
    }
  }

  /**
   * `try/catch` em volta de um `enqueue`: a mensagem **já está no telefone do
   * contato** quando isto roda. Redis fora não pode virar `500` na tela — o operador
   * reenviaria e o contato receberia duas vezes, desfecho pior do que uma conversa
   * que não abriu.
   *
   * O que se perde nesse caso é a conversa daquela mensagem, e não há retentativa
   * possível: enfileirar é o que cria a retentativa. É o único ponto do fluxo em que
   * uma falha ainda é definitiva, e é por isso que o callback de status da Z-API
   * continua existindo como reparo.
   */
  private async openConversation(input: {
    subscriptionItemId: string
    domainId: string
    appCode: string
    instanceId: string
    providerMessageId: string | undefined
    destination: string
    text: string | null
  }): Promise<void> {
    const { providerMessageId, text } = input
    if (!providerMessageId || !text) return

    try {
      await this.openChannelQueue.enqueue({
        subscriptionItemId: input.subscriptionItemId,
        domainId: input.domainId,
        appCode: input.appCode,
        instanceId: input.instanceId,
        providerMessageId,
        destination: input.destination,
        text,
      })
    } catch (err) {
      apiLogger.error(
        { app: 'thinkzap', subscriptionItemId: input.subscriptionItemId, err },
        'Não foi possível enfileirar a abertura da conversa; envio preservado',
      )
    }
  }

  private async sendAttachment(
    attachment: WidgetMessageAttachmentInput,
    instanceId: string,
    zApiToken: string,
    normalizedPhone: string,
  ): Promise<string> {
    if (attachment.kind === 'image') {
      const result = await this.zApiClient.sendImage(
        instanceId,
        zApiToken,
        attachment.content,
        normalizedPhone,
      )
      return result.messageId
    }

    if (attachment.kind === 'video') {
      const result = await this.zApiClient.sendVideo(
        instanceId,
        zApiToken,
        attachment.content,
        normalizedPhone,
      )
      return result.messageId
    }

    if (attachment.kind === 'audio') {
      const mp3Audio = await this.convertAudioToMp3DataUrl(attachment.content)
      const result = await this.zApiClient.sendAudio(
        instanceId,
        zApiToken,
        mp3Audio,
        normalizedPhone,
      )
      return result.messageId
    }

    const result = await this.zApiClient.sendDocument(
      instanceId,
      zApiToken,
      attachment.content,
      normalizedPhone,
      attachment.name,
    )
    return result.messageId
  }

  async convertAudioBufferToMp3DataUrl(inputBuffer: Buffer): Promise<string> {
    const mp3Buffer = await convertToMp3(inputBuffer)
    return `data:audio/mpeg;base64,${mp3Buffer.toString('base64')}`
  }

  private async convertAudioToMp3DataUrl(
    audioContent: string,
  ): Promise<string> {
    const base64Audio = this.extractBase64Payload(audioContent)

    if (!base64Audio) {
      throw new Error('Invalid audio payload')
    }

    const inputBuffer = Buffer.from(base64Audio, 'base64')
    return this.convertAudioBufferToMp3DataUrl(inputBuffer)
  }

  private extractBase64Payload(content: string): string {
    const dataUrlSeparator = ';base64,'
    if (content.includes(dataUrlSeparator)) {
      return content.split(dataUrlSeparator)[1] ?? ''
    }

    return content.trim()
  }
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

export function guessMimeTypeFromFileName(fileName?: string): string {
  if (!fileName) return 'application/octet-stream'
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.gif')) return 'image/gif'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.mp4')) return 'video/mp4'
  if (lower.endsWith('.webm')) return 'video/webm'
  if (lower.endsWith('.ogg')) return 'audio/ogg'
  if (lower.endsWith('.mp3')) return 'audio/mpeg'
  if (lower.endsWith('.wav')) return 'audio/wav'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}
