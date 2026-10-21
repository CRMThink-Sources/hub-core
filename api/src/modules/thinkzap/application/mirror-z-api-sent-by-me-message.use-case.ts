import type { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { SendCadence } from '@/modules/thinkzap/domain/ports/send-cadence.port'
import { cadencePolicyOf } from '@/modules/thinkzap/domain/send-cadence'
import { env } from '@/config/env'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { DisconnectExpiredLine } from '@/modules/thinkzap/application/disconnect-expired-line'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import { historyNotices } from '@/modules/thinkzap/domain/notices/history-notices'
import {
  DEFAULT_NOTICE_LOCALE,
  type NoticeLocale,
} from '@/modules/thinkzap/domain/notices/notice-locale'
import {
  BitrixClient,
  ISendMessageData,
} from '@/shared/infra/clients/bitrix.client'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { normalizePhoneNumber } from '@/shared/helpers/normalize-phone-number'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import {
  noopJobLog,
  type AppendJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
import type { ResolveContactIdentity } from '@/modules/thinkzap/main/make-resolve-contact-identity'
import type {
  PrismaThinkzapMessageRepository,
  ThinkzapMessageRecord,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import type { ResolveGroupMentions } from './resolve-group-mentions'
import { describeContactIdentity } from './resolve-zapi-contact-identity'
import {
  buildOpenChannelChatName,
  buildOpenChannelUser,
  resolveContactDisplayName,
} from './open-channel-contact-display'
import { extractQuoteInput } from './build-reply-quote'
import { extractBitrixChatId } from './helpers/extract-bitrix-chat-id'
import {
  applyReplyContext,
  buildContactText,
  buildMessageFiles,
  describeZApiOperation,
  loadZApiInstance,
  persistInboundSnapshot,
  resolveActiveZApiLine,
  resolveBitrixMessageId,
  resolveGroupChatId,
  resolveInboundText,
  resolveZApiBitrixAccess,
  type ZApiInstanceContext,
} from './z-api-delivery'
import {
  describeImMessageRefusal,
  type ImMessageResponse,
  type MirrorOperatorAuthor,
} from './mirror-operator-author'

const log = createWorkerSourceLogger('z-api')

type MirrorMessageStore = Pick<
  PrismaThinkzapMessageRepository,
  | 'findByProviderMessageId'
  | 'findLatestOpenChannelChat'
  | 'findLatestOperatorForChat'
  | 'create'
>

/**
 * Espelha no canal aberto uma mensagem que o cliente enviou do **próprio aparelho**
 * (celular ou WhatsApp Web) numa linha Z-API — `fromMe=true`, `fromApi=false`.
 *
 * Só entra em conversa que **já existe** no canal aberto da linha: mensagem saída do
 * celular para um número qualquer não pode abrir atendimento. "Existe" é o contato (ou
 * grupo) ter ao menos uma mensagem já entregue ao canal aberto por esta linha.
 *
 * Posta **como o operador da sessão** — o último que respondeu na conversa — com
 * `im.message.add` e o token dele, do lado da empresa. Isso dispara
 * `ONIMCONNECTORMESSAGEADD`, e a reserva anti-loop (`MirroredMessageReservations`) é o
 * que faz o worker de saída não reenviar a cópia ao WhatsApp.
 *
 * Sem operador, sem token, com recusa do Bitrix, sem reserva, ou com mídia, posta pelo
 * `imconnector`, como fala do contato — que não dispara o evento de saída. O prefixo é
 * o que diz ao operador que a mensagem saiu do aparelho, no mesmo padrão do
 * `[Mensagem enviada a partir do CRM]` do widget, com qualquer um dos dois autores.
 *
 * Todo descarte termina o job **sem falha** e com a razão na aba Logs: nenhum deles
 * melhora com retentativa.
 */
export class MirrorZApiSentByMeMessageUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instanceRepo: GetInstanceRepository,
    private readonly domainRepo: GetDomainRepository,
    private readonly appRepo: GetInstalledAppRepository,
    private readonly credentialRepo: GetCredentialRepository,
    private readonly messageRepo: MirrorMessageStore,
    private readonly disconnectExpiredLine: DisconnectExpiredLine,
    private readonly resolveContactIdentity: ResolveContactIdentity,
    private readonly resolveGroupMentions: ResolveGroupMentions,
    private readonly installationLocale: Pick<
      InstallationLocaleRepository,
      'byInstallation'
    >,
    private readonly operatorAuthor: MirrorOperatorAuthor,
    /** Ausente, a mensagem do aparelho não conta na janela da cadência. */
    private readonly cadence: SendCadence | null = null,
  ) {}

  /**
   * A mensagem saiu do aparelho. Por padrão **não conta** na janela da cadência; com
   * a opção `cadenceCountDeviceMessages` da linha ligada, conta (é volume real da
   * linha) mas não espera — `registerExternal` nunca nega nem estende a pausa —, e
   * conta mesmo que a cópia não chegue ao canal aberto. Falha do Redis só vai para o
   * log: o espelhamento segue.
   */
  private async registerInCadence(
    item: SubscriptionItem,
    event: ReceivedMessageEvent,
    appendJobLog: AppendJobLog,
  ): Promise<void> {
    if (!this.cadence) return
    // Por padrão o aparelho não conta: só com a opção ligada na linha.
    if (item.settings.cadenceCountDeviceMessages !== true) return
    const policy = cadencePolicyOf({
      provider: ConnectorProvider.ZAPI,
      lineKey: event.instanceId,
      settings: item.settings,
    })
    if (!policy) return

    try {
      await this.cadence.registerExternal(policy, new Date())
      await appendJobLog('Envio do aparelho contado na janela da cadência.')
    } catch (err) {
      log.warn(
        { instanceId: event.instanceId, messageId: event.messageId, err },
        'Envio do aparelho não contado na cadência',
      )
    }
  }

  async execute(
    event: ReceivedMessageEvent,
    context: { appendJobLog: AppendJobLog } = { appendJobLog: noopJobLog },
  ): Promise<void> {
    const { appendJobLog } = context

    log.info(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        phone: event.phone,
        isGroup: event.isGroup,
        isEdit: event.isEdit,
        fromMe: true,
      },
      'Processing Z-API message sent from the device',
    )

    const instanceContext = await loadZApiInstance(
      { instanceRepo: this.instanceRepo, domainRepo: this.domainRepo },
      event,
      appendJobLog,
    )
    const { instance, domainName } = instanceContext

    await appendJobLog(
      `Mensagem ENVIADA PELO APARELHO | domínio=${domainName} | ` +
        `instância=${event.instanceId} | destino=${event.phone} | ` +
        `messageId=${event.messageId} | conteúdo=${extractQuoteInput(event).type}` +
        (event.isGroup ? ' | grupo=sim' : '') +
        (event.isEdit ? ' | edição=sim' : '') +
        (event.notification ? ` | notification=${event.notification}` : ''),
    )

    const item = await resolveActiveZApiLine(
      {
        getAplicationContext: this.getAplicationContext,
        disconnectExpiredLine: this.disconnectExpiredLine,
      },
      instanceContext,
      event,
      appendJobLog,
    )
    if (!item) return

    if (item.settings.deviceMessageMirrorEnabled !== true) {
      await this.discard(
        event,
        appendJobLog,
        'toggle "Espelhar mensagens enviadas pelo aparelho" desligado na linha ' +
          `(item=${item.id}). A notificação da Z-API pode ter ficado ligada; o ` +
          'descarte aqui é o que vale.',
      )
      return
    }

    // Antes de exigir canal: sem canal o espelhamento não tem onde entrar, e isso é
    // descarte — no inbound é falha porque a mensagem do contato se perderia.
    if (!item.vinculatedChannel) {
      await this.discard(
        event,
        appendJobLog,
        `linha sem canal aberto vinculado (item=${item.id}).`,
      )
      return
    }

    // Notificação de sistema (grupo criado, ícone trocado…) não é mensagem do cliente.
    if (event.notification && event.notification !== 'REVOKE') {
      await this.discard(
        event,
        appendJobLog,
        `notificação de sistema "${event.notification}", não é mensagem.`,
      )
      return
    }

    const isUpdate = event.isEdit || event.notification === 'REVOKE'
    const original = isUpdate
      ? await this.findMirroredOriginal(instance.id, event)
      : null

    if (isUpdate && !original) {
      await this.discard(
        event,
        appendJobLog,
        `${describeZApiOperation(event)} de mensagem que não foi espelhada — não há ` +
          'cópia no canal aberto para alterar.',
      )
      return
    }

    if (!isUpdate && (await this.isKnownMessage(instance.id, event))) {
      await this.discard(
        event,
        appendJobLog,
        `messageId=${event.messageId} já registrado — a mensagem saiu pela ` +
          'integração ou já foi espelhada.',
      )
      return
    }

    // Mensagem nova do aparelho — edição e remoção não são envio novo.
    if (!isUpdate) await this.registerInCadence(item, event, appendJobLog)

    const target = event.isGroup
      ? this.resolveGroupTarget(event)
      : await this.resolveContactTarget(event, instanceContext, appendJobLog)

    if (!target) {
      await this.discard(
        event,
        appendJobLog,
        `destino sem identidade utilizável (\`phone\`="${event.phone}").`,
      )
      return
    }

    // O chat do canal aberto da conversa: é onde o operador posta.
    let openChannelChatId: string | null = null
    if (!isUpdate) {
      const conversation = await this.messageRepo.findLatestOpenChannelChat(
        instance.id,
        target.chatId,
      )
      openChannelChatId = conversation?.bitrixChatId ?? null
      if (!conversation) {
        await this.discard(
          event,
          appendJobLog,
          `sem conversa existente no canal aberto para chat.id=${target.chatId}. ` +
            'Mensagem enviada pelo aparelho não abre conversa nova.',
        )
        return
      }
    }

    const { vinculatedChannel, domain, credential } =
      await resolveZApiBitrixAccess(
        { appRepo: this.appRepo, credentialRepo: this.credentialRepo },
        instanceContext,
        item,
        event,
        appendJobLog,
      )

    const prefix = historyNotices(
      await this.localeOf(instanceContext.domainId),
    ).sentFromDevicePrefix

    const body = event.contact
      ? buildContactText(event.contact)
      : event.isGroup && !event.notification
        ? await this.resolveGroupMentions(resolveInboundText(event), {
            instanceId: event.instanceId,
            zApiToken: instance.zApiToken,
            groupId: target.chatId,
          })
        : resolveInboundText(event)

    const { text } = await applyReplyContext(
      this.messageRepo,
      event,
      prefix + body,
      instance.id,
    )

    const files = buildMessageFiles(event)

    // Cópia postada como operador só se altera como ele: o conector não a encontraria.
    if (original?.bitrixUserId) {
      await this.alterAsOperator(
        original,
        event,
        text,
        domain.name,
        appendJobLog,
      )
      return
    }

    if (
      !isUpdate &&
      (await this.postAsOperator({
        event,
        instanceDbId: instance.id,
        domainName: domain.name,
        bitrixChatId: openChannelChatId,
        chatId: target.chatId,
        text,
        hasFiles: Boolean(files?.length),
        appendJobLog,
      }))
    ) {
      return
    }

    const params: ISendMessageData = {
      CONNECTOR: env.bitrix.connector.code,
      LINE: Number(vinculatedChannel),
      MESSAGES: [
        {
          chat: { id: target.chatId, name: target.chatName },
          user: target.user,
          message: {
            // Na edição/remoção, o id com que a cópia foi postada.
            id: original?.providerMessageId ?? event.messageId,
            date: new Date(event.momment).toISOString(),
            text,
            files,
          },
        },
      ],
    }

    await appendJobLog(
      `Espelhando no canal aberto | operação=${describeZApiOperation(event)} | ` +
        `domínio=${domain.name} | LINE=${params.LINE} | chat.id=${target.chatId} | ` +
        `arquivos=${files?.length ?? 0}`,
    )

    const bitrixClient = new BitrixClient({
      bitrixCredential: credential,
      domain: domain.name,
    })

    const result: unknown = event.isEdit
      ? await bitrixClient.updateMessage(params)
      : event.notification === 'REVOKE'
        ? await bitrixClient.deleteMessage(params)
        : await bitrixClient.sendMessage(params)

    const bitrixChatId = extractBitrixChatId(result)
    const bitrixMessageId = await resolveBitrixMessageId(
      bitrixClient,
      bitrixChatId,
      event,
    )

    log.info(
      {
        instanceId: event.instanceId,
        domain: domain.name,
        messageId: event.messageId,
        isGroup: event.isGroup,
        isEdit: event.isEdit,
        bitrixChatId,
        result: JSON.stringify(result),
      },
      'Device-sent message mirrored to Bitrix',
    )

    await persistInboundSnapshot(
      this.messageRepo,
      event,
      instance.id,
      bitrixMessageId,
      bitrixChatId,
      target.chatId,
      null,
      appendJobLog,
    )

    await appendJobLog(
      `Desfecho: ${describeZApiOperation(event)} espelhada no canal aberto ` +
        `${vinculatedChannel} do domínio ${domain.name}.`,
    )
  }

  /**
   * Posta a cópia como o operador da sessão. `true` = postada e registrada; `false` =
   * o chamador segue pelo `imconnector`, como o contato, com o motivo já na aba Logs.
   *
   * A ordem protege contra reenvio ao WhatsApp: o chat fica **pendente** antes do
   * `im.message.add`, a reserva por id entra assim que ele responde, e o pendente só
   * sai depois de a row `ZAPI` estar gravada. Se a reserva falhar, o worker de saída
   * espera o pendente e acha a row. Sem conseguir marcar o pendente, não posta como
   * operador: autor errado é melhor que mensagem duplicada no WhatsApp do cliente.
   */
  private async postAsOperator(params: {
    event: ReceivedMessageEvent
    instanceDbId: string
    domainName: string
    bitrixChatId: string | null
    chatId: string
    text: string
    hasFiles: boolean
    appendJobLog: AppendJobLog
  }): Promise<boolean> {
    const { event, instanceDbId, domainName, bitrixChatId, appendJobLog } =
      params

    const asContact = async (reason: string): Promise<false> => {
      await appendJobLog(
        `Autor: o contato — ${reason}. Postando pelo conector.`,
      )
      return false
    }

    if (params.hasFiles) {
      return asContact('mídia sai como o contato nesta versão')
    }
    if (!bitrixChatId) {
      return asContact('conversa sem chat do canal aberto gravado')
    }

    const operatorId = await this.messageRepo.findLatestOperatorForChat(
      instanceDbId,
      bitrixChatId,
    )
    if (!operatorId) return asContact('sem operador na conversa')

    let token: string | null
    try {
      token = await this.operatorAuthor.resolveAccessToken(
        domainName,
        operatorId,
      )
    } catch (err) {
      return asContact(
        `token do operador ${operatorId} não renovou (${describeError(err)})`,
      )
    }
    if (!token) {
      return asContact(
        `operador ${operatorId} sem autorização do app (autoriza uma vez pelo ` +
          'widget de áudio ou de botões)',
      )
    }

    const { reservations } = this.operatorAuthor
    try {
      await reservations.markPending(domainName, bitrixChatId)
    } catch (err) {
      return asContact(
        `reserva anti-loop indisponível (${describeError(err)}); postar como ` +
          'operador poderia reenviar a mensagem ao WhatsApp',
      )
    }

    try {
      let response: ImMessageResponse
      try {
        response = await this.operatorAuthor
          .createClient(domainName, token)
          .callMethod<ImMessageResponse>('im.message.add', {
            DIALOG_ID: `chat${bitrixChatId}`,
            MESSAGE: params.text,
          })
      } catch (err) {
        return asContact(
          `Bitrix recusou postar como o operador ${operatorId} (${describeError(err)})`,
        )
      }

      const messageId = response?.result
      if (!messageId || messageId === true) {
        return asContact(
          `Bitrix recusou postar como o operador ${operatorId} ` +
            `(${describeImMessageRefusal(response)})`,
        )
      }
      const bitrixMessageId = String(messageId)

      try {
        await reservations.register(
          domainName,
          bitrixMessageId,
          event.messageId,
        )
      } catch (err) {
        log.warn(
          { instanceId: event.instanceId, bitrixMessageId, err },
          'Reserva do espelhamento não gravada — o worker de saída cai na row',
        )
        await appendJobLog(
          `Reserva anti-loop não gravada (${describeError(err)}). O worker de ` +
            'saída reconhece a cópia pela row gravada a seguir.',
        )
      }

      await persistInboundSnapshot(
        this.messageRepo,
        event,
        instanceDbId,
        bitrixMessageId,
        bitrixChatId,
        params.chatId,
        null,
        appendJobLog,
        operatorId,
      )

      log.info(
        {
          instanceId: event.instanceId,
          messageId: event.messageId,
          bitrixChatId,
          bitrixMessageId,
          operatorId,
        },
        'Device-sent message mirrored to Bitrix as the session operator',
      )
      await appendJobLog(
        `Desfecho: mensagem do aparelho espelhada como o operador ${operatorId} no ` +
          `chat ${bitrixChatId} (bitrixMessageId=${bitrixMessageId}).`,
      )
      return true
    } finally {
      await reservations
        .clearPending(domainName, bitrixChatId)
        .catch((err: unknown) =>
          log.warn(
            { instanceId: event.instanceId, bitrixChatId, err },
            'Falha ao limpar o pendente do espelhamento — expira sozinho',
          ),
        )
    }
  }

  /**
   * Edita ou remove uma cópia que foi postada como operador, com o token **dele**: a
   * credencial do app não altera mensagem de outro usuário (ver
   * `parse-button-action-code`). Sem o token, a cópia fica como está.
   *
   * Erro lançado pelo Bitrix sobe e o job retenta — editar e apagar são idempotentes.
   */
  private async alterAsOperator(
    original: ThinkzapMessageRecord,
    event: ReceivedMessageEvent,
    text: string,
    domainName: string,
    appendJobLog: AppendJobLog,
  ): Promise<void> {
    const operatorId = original.bitrixUserId as string
    const operation = describeZApiOperation(event)

    if (!original.bitrixMessageId) {
      await this.discard(
        event,
        appendJobLog,
        `${operation} de cópia sem bitrixMessageId gravado — não há como achá-la.`,
      )
      return
    }

    let token: string | null
    try {
      token = await this.operatorAuthor.resolveAccessToken(
        domainName,
        operatorId,
      )
    } catch (err) {
      token = null
      await appendJobLog(
        `Token do operador ${operatorId} não renovou (${describeError(err)}).`,
      )
    }
    if (!token) {
      await this.discard(
        event,
        appendJobLog,
        `${operation} de cópia postada como o operador ${operatorId}, que não tem ` +
          'autorização válida do app — só ele pode alterá-la.',
      )
      return
    }

    const isRevoke = event.notification === 'REVOKE'
    const method = isRevoke ? 'im.message.delete' : 'im.message.update'
    const response = await this.operatorAuthor
      .createClient(domainName, token)
      .callMethod<ImMessageResponse>(
        method,
        isRevoke
          ? { MESSAGE_ID: original.bitrixMessageId }
          : { MESSAGE_ID: original.bitrixMessageId, MESSAGE: text },
      )

    if (!response?.result) {
      await this.discard(
        event,
        appendJobLog,
        `Bitrix recusou ${method} como o operador ${operatorId} ` +
          `(${describeImMessageRefusal(response)}).`,
      )
      return
    }

    await appendJobLog(
      `Desfecho: ${operation} aplicada à cópia do operador ${operatorId} ` +
        `(bitrixMessageId=${original.bitrixMessageId}) via ${method}.`,
    )
  }

  /**
   * Identidade do **destinatário**, pela mesma cadeia do inbound — é ela que faz a
   * cópia cair na mesma conversa das mensagens do contato.
   *
   * `senderLid` fica de fora: na mensagem enviada ele é o LID da **própria linha**.
   * Entrar na cadeia faria o contato herdar a identidade da linha e gravaria esse par
   * errado no mapa de contatos. `senderName`/`senderPhoto` também são da linha, por
   * isso nome e foto saem de `chatName`/`photo`.
   */
  private async resolveContactTarget(
    event: ReceivedMessageEvent,
    instanceContext: ZApiInstanceContext,
    appendJobLog: AppendJobLog,
  ): Promise<MirrorTarget | null> {
    const identity = await this.resolveContactIdentity({
      event: { phone: event.phone, chatLid: event.chatLid, senderLid: null },
      instanceDbId: instanceContext.instance.id,
      zApiInstanceId: event.instanceId,
      zApiToken: instanceContext.instance.zApiToken,
    })

    await appendJobLog(`Destinatário: ${describeContactIdentity(identity)}`)

    const chatId = identity.identity
    if (!chatId) return null

    const name = resolveContactDisplayName([event.chatName, identity.phone])
    return {
      chatId,
      chatName: buildOpenChannelChatName(name, identity.phone),
      user: buildOpenChannelUser({
        id: chatId,
        name,
        phone: identity.phone,
        pictureUrl: event.photo,
      }),
    }
  }

  /** O grupo é o chat, como no inbound — mas sem `[b]autor[/b]:`, o autor é a linha. */
  private resolveGroupTarget(event: ReceivedMessageEvent): MirrorTarget | null {
    const chatId = resolveGroupChatId(event)
    if (!chatId) return null

    const normalizedPhone = normalizePhoneNumber(event.phone)
    return {
      chatId,
      chatName: event.chatName,
      user: {
        id: chatId,
        name: event.chatName ?? normalizedPhone,
        last_name: '',
        phone: normalizedPhone,
        picture: { url: event.photo },
      },
    }
  }

  /**
   * A cópia espelhada da mensagem que está sendo editada/apagada. Só `ZAPI`: uma row
   * `BITRIX` é mensagem que o operador mandou pelo Bitrix, e a dele não é postada pelo
   * conector — alterar por aqui não acharia a mensagem.
   *
   * A Z-API reusa `messageId` entre envio e edição; `editMessageId` entra como segunda
   * tentativa porque o caminho de grupo do inbound trata ele como o id original.
   */
  private async findMirroredOriginal(
    instanceDbId: string,
    event: ReceivedMessageEvent,
  ): Promise<ThinkzapMessageRecord | null> {
    const candidates = [event.messageId, event.editMessageId].filter(Boolean)
    for (const id of candidates) {
      const record = await this.messageRepo.findByProviderMessageId(
        instanceDbId,
        id,
      )
      if (record?.source === 'ZAPI') return record
    }
    return null
  }

  /**
   * Segundo filtro contra duplicidade, além do `fromApi` do handler: qualquer row com
   * este `messageId` quer dizer que a mensagem já está no Bitrix.
   */
  private async isKnownMessage(
    instanceDbId: string,
    event: ReceivedMessageEvent,
  ): Promise<boolean> {
    const record = await this.messageRepo.findByProviderMessageId(
      instanceDbId,
      event.messageId,
    )
    return record !== null
  }

  /** Idioma do prefixo; a leitura não lança, e qualquer surpresa cai em português. */
  private async localeOf(domainId: string): Promise<NoticeLocale> {
    try {
      return await this.installationLocale.byInstallation(
        domainId,
        thinkzapAppCodeId(),
      )
    } catch {
      return DEFAULT_NOTICE_LOCALE
    }
  }

  private async discard(
    event: ReceivedMessageEvent,
    appendJobLog: AppendJobLog,
    reason: string,
  ): Promise<void> {
    log.info(
      {
        instanceId: event.instanceId,
        messageId: event.messageId,
        fromMe: true,
        mirrorDiscarded: true,
        reason,
      },
      'Device-sent message not mirrored',
    )
    await appendJobLog(
      `Mensagem do aparelho NÃO espelhada: ${reason} Job encerrado sem falha.`,
    )
  }
}

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

type MirrorTarget = {
  chatId: string
  chatName: string
  user: ISendMessageData['MESSAGES'][number]['user']
}
