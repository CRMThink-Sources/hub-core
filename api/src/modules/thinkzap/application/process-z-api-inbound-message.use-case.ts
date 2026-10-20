import { env } from '@/config/env'
import { DisconnectExpiredLine } from '@/modules/thinkzap/application/disconnect-expired-line'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
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
  noopJobLog,
  type AppendJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
import type { ResolveContactIdentity } from '@/modules/thinkzap/main/make-resolve-contact-identity'
import type { ResolveGroupMentions } from './resolve-group-mentions'
import { describeContactIdentity } from './resolve-zapi-contact-identity'
import {
  buildOpenChannelChatName,
  buildOpenChannelUser,
  resolveContactDisplayName,
} from './open-channel-contact-display'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { extractQuoteInput, getQuoteInputType } from './build-reply-quote'
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
} from './z-api-delivery'

/**
 * Texto do aviso quando a mensagem inbound é uma mídia de visualização única sem
 * conteúdo entregável (ver `isBareViewOnceMarker` em `execute`).
 */
const VIEW_ONCE_NOTICE =
  'Você recebeu uma mensagem de visualização única. Por motivos de ' +
  'privacidade, você só pode abrir essa mensagem no seu celular.'

const log = createWorkerSourceLogger('z-api')

/**
 * Entrega no canal aberto do Bitrix uma mensagem recebida no WhatsApp não-oficial
 * (Z-API).
 *
 * Além do log de processo (stdout → Promtail → Loki), escreve a história desta
 * execução na **aba Logs do job** via `appendJobLog`. Aqui isso pesa mais que no
 * caminho oficial, porque três desfechos deste fluxo terminam em `completed` **sem**
 * mensagem nova no canal aberto e são o esperado: grupo (identidade de chat de outra
 * forma), `isEdit` (atualiza mensagem existente, não persiste) e `REVOKE` (apaga a
 * mensagem). Sem linha na aba, os três são indistinguíveis de mensagem perdida.
 */
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
    /**
     * Resolve a identidade do contato pela cadeia de LID. Entra como porta porque as
     * credenciais da Z-API — necessárias para o último elo, `phone-exists` — só são
     * conhecidas depois de resolver a instância.
     */
    private readonly resolveContactIdentity: ResolveContactIdentity,
    /**
     * Porta, pelo mesmo motivo de `resolveContactIdentity`: a credencial da
     * Z-API (`instance.zApiToken`) só é conhecida depois de resolver a
     * instância, então quem monta o use case não tem como injetar um cliente
     * já pronto para consultar `group-metadata`.
     */
    private readonly resolveGroupMentions: ResolveGroupMentions,
  ) {}

  /**
   * `context` entra pelo argumento, e não como oitava dependência de construtor: o
   * log de job pertence ao **job**, que existe por execução, não à regra de entrega.
   * O default `noopJobLog` cobre chamada fora da fila e teste.
   */
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
      /**
       * Sem domínio nesta linha, e é o único desvio assim: o guard roda antes da
       * leitura da instância de propósito — payload malformado não deve custar
       * consulta ao banco.
       */
      await appendJobLog(
        `Mensagem DESCARTADA: evento de edição sem \`editMessageId\` | ` +
          `instância=${event.instanceId} | messageId=${event.messageId}. Sem o id da ` +
          'mensagem original não há o que atualizar no canal aberto. Payload malformado ' +
          'do provider — job encerrado sem falha, e retentativa não muda nada.',
      )
      return
    }

    const instanceContext = await loadZApiInstance(
      { instanceRepo: this.instanceRepo, domainRepo: this.domainRepo },
      event,
      appendJobLog,
    )
    const { instance, domainName } = instanceContext

    /**
     * `extractQuoteInput` é pura e já resolve o tipo do conteúdo — é a mesma função que
     * o snapshot usa para gravar `type`, então a linha de contexto não pode divergir do
     * que vai ao banco.
     */
    const inboundType = extractQuoteInput(event).type

    await appendJobLog(
      `Mensagem recebida | domínio=${domainName} | instância=${event.instanceId} | ` +
        `contato=${event.phone} | messageId=${event.messageId} | conteúdo=${inboundType}` +
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

    const { vinculatedChannel, domain, credential } =
      await resolveZApiBitrixAccess(
        { appRepo: this.appRepo, credentialRepo: this.credentialRepo },
        instanceContext,
        item,
        event,
        appendJobLog,
      )

    const bitrixClient = new BitrixClient({
      bitrixCredential: credential,
      domain: domain.name,
    })

    const files = buildMessageFiles(event)

    if (event.isGroup) {
      /**
       * A linha existe porque explica a forma das seguintes: no caminho de grupo o
       * `chat.id` sai de `phone`/`chatLid` do grupo, não do telefone do remetente, e
       * o texto ganha o nome de quem escreveu como prefixo.
       */
      await appendJobLog(
        `Mensagem de grupo — segue pelo caminho de grupo: a identidade do chat é o ` +
          `grupo (${event.phone}), não o contato, e o autor (${event.senderName ?? '—'}) ` +
          'vai como prefixo do texto.',
      )
      await this.sendGroupMessage(
        event,
        domain,
        credential,
        instance,
        vinculatedChannel,
        normalizePhoneNumber(event.phone),
        files,
        appendJobLog,
      )
      return
    }

    /**
     * Identidade, nome e telefone deixaram de ser o mesmo valor — e isto roda **só no
     * 1:1**, depois do desvio de grupo.
     *
     * A identidade sai da cadeia de LID (ver `resolveZApiContactIdentity`): o `phone` da
     * Z-API vem ora número, ora `@lid`, e usá-lo como chave fazia o mesmo contato abrir
     * duas conversas no canal aberto.
     *
     * Grupo fica de fora de propósito: a identidade dele é o jid, que já é estável, e
     * resolver aqui gravaria rows de grupo no mapa de contato — um índice de pessoas
     * poluído por conversas que não são pessoas.
     *
     * `contactPhone` é `null` para contato lid-only, e é isso que impede o LID de virar
     * telefone no CRM: `normalizePhoneNumber('3577724534928@lid')` devolvia
     * `3577724534928`, que ia direto para `user.phone`.
     */
    const identity = await this.resolveContactIdentity({
      event,
      instanceDbId: instance.id,
      zApiInstanceId: event.instanceId,
      zApiToken: instance.zApiToken,
    })
    const contactPhone = identity.phone

    await appendJobLog(`Contato: ${describeContactIdentity(identity)}`)

    if (identity.source === 'none') {
      logThinkzapError(
        log,
        'thinkzap.message.inbound_zapi_failed',
        {
          instanceId: event.instanceId,
          domain: domainName,
          messageId: event.messageId,
          phone: event.phone,
          lidResolutionFailed: true,
        },
        {
          level: 'warn',
          msg: 'Nenhum lid resolvido para o contato — identidade cai no telefone, e ele volta a poder duplicar',
        },
      )
    }

    /**
     * O guard reprova string vazia: payload malformado, sem telefone e sem lid, tem que
     * falhar visivelmente em vez de mandar um `chat.id` vazio ao Bitrix e abrir uma
     * sessão sem dono.
     */
    const chatId = identity.identity
    if (!chatId) {
      await appendJobLog(
        `Payload sem telefone utilizável (\`phone\`="${event.phone}") — sem identidade ` +
          'de contato, enviar abriria uma sessão de canal aberto sem dono. Job vai falhar.',
      )
      throw new Error('Chat ID not found')
    }

    const outgoingMessageId = event.messageId

    /**
     * `senderName` primeiro: em 1:1 ele é o push name de quem escreveu. A cadeia existe
     * porque ele pode vir vazio, e `resolveContactDisplayName` descarta qualquer
     * candidato com `@lid` — sem isso, contato em modo privacidade sem push name
     * apareceria para o operador com o identificador interno do WhatsApp como nome.
     */
    const contactName = resolveContactDisplayName([
      event.senderName,
      event.chatName,
      contactPhone,
    ])

    let baseText = event.contact
      ? buildContactText(event.contact)
      : resolveInboundText(event)

    /**
     * `event.viewOnce` (mensagem de mídia de visualização única): a Z-API não expõe a
     * mídia em si — o evento chega sem `image`/`audio`/`video`/`text`, só o metadado.
     * O texto do aviso vira o próprio conteúdo enviado a `sendMessage`, no mesmo
     * caminho de qualquer mensagem TEXT.
     *
     * Testado em produção: mandar o evento com texto vazio não confiavelmente abre
     * nem continua a sessão do canal aberto (`session.CHAT_ID` nunca voltou), e um
     * aviso postado à parte, num `bitrixChatId` obtido de mensagem antiga do contato,
     * foi aceito pelo Bitrix mas não apareceu na sessão ATIVA que o atendente vê —
     * provavelmente uma conversa já fechada/arquivada. Dar conteúdo real ao envio usa
     * o pipeline já comprovado para toda mensagem de texto.
     */
    if (event.viewOnce && !files?.length && !baseText) {
      baseText = VIEW_ONCE_NOTICE
    }

    const { text, cached, replyLookupFailed } = await applyReplyContext(
      this.messageRepo,
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
            name: buildOpenChannelChatName(contactName, contactPhone),
          },
          user: buildOpenChannelUser({
            id: chatId,
            name: contactName,
            phone: contactPhone,
            pictureUrl: event.photo,
          }),
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

    /**
     * `describeZApiOperation` nomeia qual das três chamadas vai sair. Job `completed`
     * sem mensagem nova no canal aberto é o **esperado** em edição e em `REVOKE`, e sem
     * esta linha isso é indistinguível de mensagem perdida.
     */
    await appendJobLog(
      `Entregando no canal aberto | operação=${describeZApiOperation(event)} | ` +
        `domínio=${domain.name} | CONNECTOR=${params.CONNECTOR} | LINE=${params.LINE} | ` +
        `chat.id=${chatId} | tipo=${inboundType} | arquivos=${files?.length ?? 0}` +
        (event.referenceMessageId
          ? ` | citação=${cached ? 'resolvida' : 'não resolvida'}`
          : ''),
    )

    const result: unknown = event.isEdit
      ? await bitrixClient.updateMessage(params)
      : event.notification === 'REVOKE'
        ? await bitrixClient.deleteMessage(params)
        : await bitrixClient.sendMessage(params)

    log.info(
      {
        messageId: event.messageId,
        domain: domainName,
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

    await appendJobLog(
      `Bitrix aceitou | session.CHAT_ID=${bitrixChatId ?? 'não devolvido'} | ` +
        `bitrixMessageId=${bitrixMessageId ?? 'não resolvido (im.dialog.get)'}`,
    )

    await persistInboundSnapshot(
      this.messageRepo,
      event,
      instance.id,
      bitrixMessageId,
      bitrixChatId,
      chatId,
      null,
      appendJobLog,
    )

    await appendJobLog(
      `Desfecho: ${describeZApiOperation(event)} concluída no canal aberto ` +
        `${vinculatedChannel} do domínio ${domain.name}.`,
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
    appendJobLog: AppendJobLog = noopJobLog,
  ): Promise<void> {
    log.info(
      {
        instanceId: event.instanceId,
        domain: domain.name,
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
      await appendJobLog(
        `Grupo sem identidade de chat: \`phone\`="${event.phone}" não é grupo e ` +
          '`chatLid` está vazio. Job vai falhar.',
      )
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

    /**
     * `null` fora do texto puro (notificação, contato encaminhado): não há
     * `@<lid>` a resolver nesses casos, e não vale gastar cache/chamada à
     * Z-API por nada. `undefined` de `instance.zApiToken` também vira no-op
     * dentro de `resolveGroupMentions` — sem token não há como consultar
     * `group-metadata`.
     */
    let resolvedText: string | null = null
    if (!event?.notification && !event.contact) {
      const rawGroupText = resolveInboundText(event)
      resolvedText = await this.resolveGroupMentions(rawGroupText, {
        instanceId: event.instanceId,
        zApiToken: instance.zApiToken,
        groupId: chatId,
      })

      /**
       * Sem isto, "menção não resolveu" é indistinguível de "não tinha
       * menção": os três motivos de no-op (sem token, sem match, falha na
       * Z-API) já são logados como `warn` dentro de `resolveGroupMentions`,
       * mas nada aparecia na aba Logs do job — que é o que o suporte olha
       * primeiro.
       */
      if (/@\d{5,}/.test(rawGroupText)) {
        await appendJobLog(
          resolvedText !== rawGroupText
            ? 'Menção de grupo resolvida para telefone antes do envio.'
            : `Menção de grupo NÃO resolvida (texto igual ao original) | ` +
                `zApiToken=${instance.zApiToken ? 'presente' : 'ausente'}.`,
        )
      }
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
          (resolvedText ?? resolveInboundText(event))

    const { text, cached, replyLookupFailed } = await applyReplyContext(
      this.messageRepo,
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

    await appendJobLog(
      `Entregando no canal aberto (grupo) | operação=${describeZApiOperation(event)} | ` +
        `domínio=${domain.name} | CONNECTOR=${params.CONNECTOR} | LINE=${params.LINE} | ` +
        `chat.id=${chatId} | arquivos=${files?.length ?? 0}` +
        (event.referenceMessageId
          ? ` | citação=${cached ? 'resolvida' : 'não resolvida'}`
          : ''),
    )

    let result: unknown
    if (event.isEdit) {
      result = await bitrixClient.updateMessage(params)
    } else {
      result = await bitrixClient.sendMessage(params)
    }

    log.info(
      {
        instanceId: event.instanceId,
        domain: domain.name,
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

    await appendJobLog(
      `Bitrix aceitou | session.CHAT_ID=${bitrixChatId ?? 'não devolvido'} | ` +
        `bitrixMessageId=${bitrixMessageId ?? 'não resolvido (im.dialog.get)'}`,
    )

    await persistInboundSnapshot(
      this.messageRepo,
      event,
      instance.id,
      bitrixMessageId,
      bitrixChatId,
      chatId,
      resolvedText,
      appendJobLog,
    )

    await appendJobLog(
      `Desfecho: ${describeZApiOperation(event)} de grupo concluída no canal aberto ` +
        `${vinculatedChannel} do domínio ${domain.name}.`,
    )
  }
}
