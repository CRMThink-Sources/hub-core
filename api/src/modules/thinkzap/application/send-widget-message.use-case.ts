import type { DailySendQuota } from '@/modules/thinkzap/domain/ports/daily-send-quota.port'
import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import {
  DEFAULT_NOTICE_LOCALE,
  dailyLimitNotices,
} from '@/modules/thinkzap/domain/daily-limit-notices'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  assertDailyLimitNotReached,
  dailyLimitPolicyOf,
  isDailyLimitReachedError,
  sendWithinDailyQuota,
} from './helpers/send-within-daily-quota'
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
import { ConnectorSettings } from '@/modules/thinkzap/domain/value-objects/connector-settings'

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
    /**
     * Preparo do texto que vai para o contato — `prepareOpenLineOutboundText`, o
     * mesmo do canal aberto e do worker do widget.
     *
     * Porta e não import direto porque fala com o Bitrix, e este caso de uso é
     * testado sem rede. Ausente, o texto sai cru.
     */
    private readonly prepareOutboundText?: (input: {
      text: string
      settings: ConnectorSettings
      operatorUserId: string
      appId: string
    }) => Promise<string>,
    /** Ausente, o envio não é contado nem limitado. A factory sempre injeta. */
    private readonly quota: DailySendQuota | null = null,
    /** Idioma do aviso de limite na timeline. Ausente, português. */
    private readonly locales: InstallationLocaleRepository | null = null,
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

    // Antes de enviar qualquer parte: limite já atingido recusa o envio inteiro.
    await assertDailyLimitNotReached(this.quota, line.item)

    const dailyLimitPolicy = this.quota
      ? dailyLimitPolicyOf({
          provider: ConnectorProvider.ZAPI,
          lineKey: line.zApiInstanceId,
          settings: line.item.settings,
        })
      : null
    // Cada parte (texto e cada anexo) é uma mensagem no WhatsApp, e conta como tal.
    const withinQuota = <T>(send: () => Promise<T>): Promise<T> =>
      this.quota
        ? sendWithinDailyQuota(this.quota, dailyLimitPolicy, send)
        : send()

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
      /**
       * O prefixo de nome do operador é só do **contato**: `sentMessages[].text`
       * segue com o texto digitado, porque é dele que saem a row de histórico, o
       * espelho no canal aberto e o comentário de timeline — e nos três o autor já é
       * conhecido.
       *
       * Este caminho é síncrono, então o operador vem do request e não de coluna
       * nenhuma. Os anexos não entram: a Z-API os recebe sem legenda aqui, cada um
       * como mensagem própria, e não há texto onde encaixar prefixo.
       */
      const textForContact = this.prepareOutboundText
        ? await this.prepareOutboundText({
            text: message.trim(),
            settings: line.item.settings,
            operatorUserId: input.operatorBitrixUserId ?? '',
            appId: context.aplication.id,
          })
        : message.trim()

      const result = await withinQuota(() =>
        this.zApiClient.sendMessage(
          line.zApiInstanceId,
          line.zApiInstanceToken,
          textForContact,
          normalizedPhone,
        ),
      )

      sentMessages.push({
        providerMessageId: result.messageId,
        type: 'TEXT',
        text: message.trim(),
        fileName: null,
      })
    }

    /**
     * O limite pode acabar no meio do envio (texto saiu, anexo não). Com algo já
     * entregue, para de enviar e segue com histórico e timeline do que saiu —
     * recusar o request inteiro faria o operador reenviar o que o contato já tem.
     * Sem nada entregue, a recusa sobe como sempre.
     */
    let skippedByDailyLimit = 0
    for (const [index, attachment] of attachments.entries()) {
      let messageId: string
      try {
        messageId = await withinQuota(() =>
          this.sendAttachment(
            attachment,
            line.zApiInstanceId,
            line.zApiInstanceToken,
            normalizedPhone,
          ),
        )
      } catch (err) {
        if (!isDailyLimitReachedError(err) || sentMessages.length === 0) {
          throw err
        }
        skippedByDailyLimit = attachments.length - index
        logThinkzapError(
          apiLogger,
          'thinkzap.line.daily_limit_reached',
          { app: 'thinkzap', subscriptionItemId, skippedByDailyLimit },
          {
            level: 'warn',
            msg: 'Limite diário atingido no meio do envio pelo widget — anexos restantes não enviados',
          },
        )
        break
      }

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

    /**
     * O registro do que **este request** entregou.
     *
     * Este caminho é síncrono: não há job, e portanto não há aba de Logs no Bull Board
     * onde procurar depois. Sem esta linha, um envio por aqui não deixa rastro
     * correlacionável — que é exatamente o caso de "o widget disse que enviou e não
     * chegou no telefone".
     *
     * `missingProviderMessageId` marca o estado que a tipagem não admite mas a rede
     * produz: `200` da Z-API sem `messageId`. Ele vira `providerMessageId` nulo na
     * persistência, e sem a marca ninguém saberia de onde veio.
     */
    apiLogger.info(
      {
        app: 'thinkzap',
        deliveryPath: 'sync',
        subscriptionItemId,
        instanceId: instance.id,
        zApiInstanceId: line.zApiInstanceId,
        destination: normalizedPhone,
        sentCount: sentMessages.length,
        sent: sentMessages.map(item => ({
          providerMessageId: item.providerMessageId,
          type: item.type,
        })),
        missingProviderMessageId: sentMessages.some(
          item => !item.providerMessageId,
        ),
      },
      'Envio pelo widget concluído no request (caminho síncrono)',
    )

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
      entity,
      entityId,
    })

    await this.sendBitrixNotification.execute({
      contextId: entityId,
      entity,
      message:
        `De: ${phoneData?.phone ?? ''}\nPara: ${destination}\nMensagem: ${message?.trim() || ''}` +
        (skippedByDailyLimit > 0
          ? '\n' +
            dailyLimitNotices(
              (await this.locales?.byAppId(context.aplication.id)) ??
                DEFAULT_NOTICE_LOCALE,
            ).attachmentsSkipped(skippedByDailyLimit)
          : ''),
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
    /** Só para nomear a conversa com o nome do contato, em vez do número. */
    entity?: string
    entityId?: string
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
        entity: input.entity,
        entityId: input.entityId,
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
