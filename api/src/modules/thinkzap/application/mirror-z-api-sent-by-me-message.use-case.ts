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

const log = createWorkerSourceLogger('z-api')

type MirrorMessageStore = Pick<
  PrismaThinkzapMessageRepository,
  'findByProviderMessageId' | 'findLatestOpenChannelChat' | 'create'
>

/**
 * Espelha no canal aberto uma mensagem que o cliente enviou do **próprio aparelho**
 * (celular ou WhatsApp Web) numa linha Z-API — `fromMe=true`, `fromApi=false`.
 *
 * Só entra em conversa que **já existe** no canal aberto da linha: mensagem saída do
 * celular para um número qualquer não pode abrir atendimento. "Existe" é o contato (ou
 * grupo) ter ao menos uma mensagem já entregue ao canal aberto por esta linha.
 *
 * Posta pelo `imconnector`, como fala do contato — é o único autor que o conector
 * aceita (ver `post-open-channel-system-notice`). O prefixo é o que diz ao operador que
 * a mensagem saiu do aparelho, no mesmo padrão do `[Mensagem enviada a partir do CRM]`
 * do widget. `imconnector.send.messages` não dispara `ONIMCONNECTORMESSAGEADD`, então
 * a mensagem não volta para o WhatsApp.
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
  ) {}

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

    if (!isUpdate) {
      const conversation = await this.messageRepo.findLatestOpenChannelChat(
        instance.id,
        target.chatId,
      )
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

type MirrorTarget = {
  chatId: string
  chatName: string
  user: ISendMessageData['MESSAGES'][number]['user']
}
