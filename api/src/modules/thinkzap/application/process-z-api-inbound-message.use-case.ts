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
import { resolveOpenChannelContactId } from '@/shared/helpers/open-channel-contact-id'
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
import { describeContactIdentity } from './resolve-zapi-contact-identity'
import {
  buildOpenChannelChatName,
  buildOpenChannelUser,
  resolveContactDisplayName,
} from './open-channel-contact-display'
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
      await appendJobLog(
        `Instância não encontrada para "${event.instanceId}" — nenhuma instalação é ` +
          'alcançável por esta chave, então não há domínio nem linha para resolver. ' +
          'Job vai falhar; retentativa cai no mesmo lugar.',
      )
      throw new Error('Instance not found for received message')
    }
    const { domainId } = instance
    if (!domainId) {
      throw new Error('Domain ID is required')
    }

    /**
     * Domínio resolvido **aqui**, e não junto da credencial lá embaixo.
     *
     * `instance.domainId` é o único pré-requisito, e ele já existe antes de qualquer
     * desvio de roteamento. Enquanto a leitura ficava depois da instalação, os desvios
     * anteriores a ela — linha não resolvida, assinatura inativa, sem canal vinculado —
     * encerravam sem que ninguém soubesse **de qual portal** era a mensagem, que é o
     * primeiro dado que o suporte precisa. `domainId` é uuid de `core_domains`; quem vai
     * abrir o portal precisa do endereço.
     *
     * Ausência **não** antecipa falha: registra e segue. O `throw` por domínio ausente
     * fica onde sempre esteve, junto do da credencial, no ponto em que o `BitrixClient`
     * precisa dele de fato.
     */
    const domain = await this.domainRepo.getDomainById(domainId)
    const domainName = domain?.name ?? 'não resolvido'

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
          domain: domainName,
          internalInstanceId: instance.id,
          messageId: event.messageId,
        },
        {
          level: 'warn',
          msg: 'Nenhum item de assinatura corresponde a esta instância',
        },
      )
      await appendJobLog(
        `Nenhum item de assinatura corresponde à instância "${event.instanceId}" no ` +
          `domínio ${domainName}. Sem item não há assinatura que autorize a entrega. ` +
          'Conserto é no CRM: conferir a linha na SPA. Job vai falhar; retentativa cai ' +
          'no mesmo lugar.',
      )
      throw new Error('Line not found for received message')
    }

    const { item } = line

    await appendJobLog(
      `Linha resolvida | item=${item.id} | entitlement=${line.entitlement} | ` +
        `canal aberto=${item.vinculatedChannel ?? '—'}`,
    )

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
          domain: domainName,
          subscriptionItemId: item.id,
          messageId: event.messageId,
          entitlement: line.entitlement,
        },
        'Mensagem descartada: linha sem assinatura ativa',
      )

      await appendJobLog(
        `Mensagem DESCARTADA: linha sem assinatura ativa | item=${item.id} | ` +
          `entitlement=${line.entitlement}. É assinatura, não falha técnica — reprocessar ` +
          'o job não muda nada. Nada é persistido e nada aparece no CRM. Job encerrado ' +
          'sem falha.',
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
          domain: domainName,
          subscriptionItemId: item.id,
          messageId: event.messageId,
        },
        { level: 'warn', msg: 'Linha sem canal aberto vinculado' },
      )
      await appendJobLog(
        `Linha sem canal aberto vinculado | item=${item.id} | domínio=${domainName}. ` +
          'Sem `LINE` não há para onde entregar. Conserto é no CRM: vincular o canal ' +
          'aberto ao item (`ufCrm93Conector` na SPA 1146). Job vai falhar; retentativa ' +
          'cai no mesmo lugar.',
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
        {
          instanceId: event.instanceId,
          domainId,
          domain: domainName,
          messageId: event.messageId,
        },
        {
          level: 'error',
          msg: `Instalação não encontrada: domínio "${domainId}", app "${thinkzapAppCodeId()}"`,
        },
      )
      await appendJobLog(
        `Instalação não encontrada | domínio=${domainName} | app=${thinkzapAppCodeId()}. ` +
          'Sem instalação não há credencial para chamar o Bitrix. Conferir se o app segue ' +
          'instalado e ativo no portal. Job vai falhar; retentativa cai no mesmo lugar.',
      )
      throw new Error(
        `Instalação não encontrada: domínio "${domainId}", app "${thinkzapAppCodeId()}"`,
      )
    }

    const app = await this.appRepo.getById(installedApp.id)

    if (!app) {
      logThinkzapError(
        log,
        'thinkzap.app.not_found',
        {
          instanceId: event.instanceId,
          domainId,
          domain: domainName,
          messageId: event.messageId,
        },
        { level: 'error', msg: 'App not found' },
      )
      await appendJobLog(
        `App "${installedApp.id}" não encontrado, embora a instalação exista ` +
          `(domínio=${domainName}) — estado inconsistente. Job vai falhar.`,
      )
      throw new Error('App not found')
    }

    const credential = await this.credentialRepo.get({ appId: app.id })

    if (!domain || !credential) {
      await appendJobLog(
        `Sem como chamar o Bitrix | domínio=${domain ? 'ok' : 'não encontrado'} | ` +
          `credencial=${credential ? 'ok' : 'não encontrada'}. Reinstalar o app renova a ` +
          'credencial. Job vai falhar; retentativa cai no mesmo lugar.',
      )
      throw new Error('Domain or credential not found')
    }

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

    await this.persistInboundSnapshot(
      event,
      instance.id,
      bitrixMessageId,
      bitrixChatId,
      chatId,
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

    const baseText: string = event?.notification
      ? (getNotificationMessage[
          event.notification as keyof typeof getNotificationMessage
        ] ?? '')
      : event.contact
        ? `[b]${event.senderName}[/b]:\n${buildContactText(event.contact)}`
        : '[b]' + event.senderName + '[/b]:\n' + resolveInboundText(event)

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

    await this.persistInboundSnapshot(
      event,
      instance.id,
      bitrixMessageId,
      bitrixChatId,
      chatId,
      appendJobLog,
    )

    await appendJobLog(
      `Desfecho: ${describeZApiOperation(event)} de grupo concluída no canal aberto ` +
        `${vinculatedChannel} do domínio ${domain.name}.`,
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
    appendJobLog: AppendJobLog = noopJobLog,
  ): Promise<void> {
    if (event.notification === 'REVOKE' || event.isEdit) {
      /**
       * Edição e remoção agem sobre uma mensagem que já tem registro: gravar um
       * segundo faria a citação de resposta resolver para a linha errada. A linha
       * existe para que "job completed e nada novo no banco" leia como decisão.
       */
      await appendJobLog(
        `Nenhum registro persistido — ${describeZApiOperation(event)} age sobre a ` +
          'mensagem que já está no banco.',
      )
      return
    }

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
      await appendJobLog(
        'Mensagem ENTREGUE no canal aberto, mas a persistência falhou — ' +
          `${err instanceof Error ? err.message : String(err)}. Job segue sem falha de ` +
          'propósito: retentar duplicaria a mensagem no CRM. Sem o registro, a citação ' +
          'de resposta a esta mensagem não resolve.',
      )
    }
  }
}

/**
 * Qual das três chamadas ao Bitrix vai sair. O caminho Z-API é o único inbound que
 * tem mais de uma, e duas delas **não** produzem mensagem nova no canal aberto — sem
 * o rótulo, um job `completed` de edição parece um job que perdeu a mensagem.
 */
function describeZApiOperation(event: ReceivedMessageEvent): string {
  if (event.isEdit) return 'atualização de mensagem existente (updateMessage)'
  if (event.notification === 'REVOKE') {
    return 'remoção de mensagem apagada pelo contato (deleteMessage)'
  }
  return 'envio de mensagem nova (sendMessage)'
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

/**
 * Texto da mensagem do contato: a mensagem em si, ou a **legenda** quando vem
 * junto de mídia. O arquivo sai por `buildMessageFiles`; isto é só o texto.
 *
 * `document.caption` faltava aqui — documento com comentário chegava ao canal
 * aberto como arquivo sem texto, e o que o contato escreveu era descartado em
 * silêncio. Áudio e sticker não têm legenda no WhatsApp, por isso não aparecem.
 *
 * Uma função só, e não a cadeia de ternários repetida no privado e no grupo:
 * eram duas cópias, e a do grupo tinha o mesmo furo — corrigir uma deixaria a
 * outra para trás.
 */
function resolveInboundText(event: ReceivedMessageEvent): string {
  if (event.image) return event.image.caption || ''
  if (event.video) return event.video.caption || ''
  if (event.document) return event.document.caption || ''
  return event.text?.message || ''
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

/*
 * `resolveChatId` viveu aqui e saiu. Ela derivava a identidade 1:1 de `event.phone`
 * (`resolveOpenChannelContactId`), e a doc dela dizia: "Sai do telefone, não do
 * `chatLid`. (…) o envio pelo widget identifica o contato pelo número que o operador
 * digitou e não teria como adivinhá-lo."
 *
 * O raciocínio estava certo para o que se sabia; a premissa não. O `phone-exists` da
 * Z-API resolve telefone → lid, então o widget **adivinha** — e sem isso a identidade
 * ficava presa a um campo que a Z-API preenche ora com número, ora com `@lid`, o que
 * abria duas conversas para o mesmo contato. A resolução vive agora em
 * `resolveZApiContactIdentity`. Grupo continua em `resolveGroupChatId`.
 */

function resolveGroupChatId(event: ReceivedMessageEvent): string | null {
  return event.phone.includes('-group') ? event.phone : event.chatLid
}
