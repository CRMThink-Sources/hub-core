import { env } from '@/config/env'
import { ConnectorProvider } from '@/modules/thinkzap/domain/entities/connector'
import type { HubMessageWebhookMessage } from '@/modules/thinkzap/domain/interfaces/hubmessage-events.interface'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { findLineItemByChannelId } from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { DisconnectExpiredLine } from '@/modules/thinkzap/application/disconnect-expired-line'
import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import {
  noopJobLog,
  type AppendJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { normalizePhoneNumber } from '@/shared/helpers/normalize-phone-number'
import { resolveOpenChannelContactId } from '@/shared/helpers/open-channel-contact-id'
import {
  BitrixClient,
  ISendMessageData,
} from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
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
 *   contato é `sender.identifier`, canonizado por `resolveOpenChannelContactId`.
 *   Usar `chat_id` colapsaria todos os contatos numa única sessão de canal
 *   aberto; usar o identifier cru fazia o contato iniciado pelo widget ganhar
 *   uma segunda sessão ao responder.
 * - **Idempotência**: o registro só é gravado depois do envio ao Bitrix, então
 *   o guard por `_id` roda ANTES do envio — é ele que impede a mensagem
 *   duplicada no canal aberto quando a HubMessage reentrega o webhook.
 *
 * Além do log de processo (stdout → Promtail → Loki), escreve a história desta
 * execução na **aba Logs do job** via `appendJobLog`. Três dos desvios daqui são
 * `return` sem exceção (assinatura inativa, duplicata, conteúdo não suportado): sem
 * essas linhas o job fecha em `completed` com a aba idêntica à de um job que
 * entregou, e "a mensagem não entrou no canal aberto" fica sem resposta. Uma linha
 * por decisão e por desfecho, não por passo — cada chamada é um round-trip ao Redis.
 */
export class ProcessHubMessageInboundMessageUseCase {
  constructor(
    private readonly getAplicationContext: GetAplicationContext,
    private readonly instanceRepo: GetInstanceRepository,
    private readonly domainRepo: GetDomainRepository,
    private readonly appRepo: GetInstalledAppRepository,
    private readonly credentialRepo: GetCredentialRepository,
    private readonly messageRepo: PrismaThinkzapMessageRepository,
    /** Mesmo papel do caminho Z-API: mensagem chegando prova canal ainda vivo. */
    private readonly disconnectExpiredLine: DisconnectExpiredLine,
  ) {}

  /**
   * `context` entra pelo argumento, e não como oitava dependência de construtor: o
   * log de job pertence ao **job**, que existe por execução, não à regra de entrega.
   * O default `noopJobLog` cobre chamada fora da fila e teste.
   */
  async execute(
    message: HubMessageWebhookMessage,
    context: { appendJobLog: AppendJobLog } = { appendJobLog: noopJobLog },
  ): Promise<void> {
    const { appendJobLog } = context
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
      logThinkzapError(
        log,
        'thinkzap.message.inbound_hubmessage_failed',
        { channelId, messageId: message._id },
        { level: 'warn', msg: 'Instance not found for HubMessage channel' },
      )
      await appendJobLog(
        `Instância não encontrada para o canal "${channelId}". A HubMessage entrega só ` +
          'o `channel_id`, e a row de `Instance` é o único índice canal → instalação: ' +
          'sem ela não há domínio nem linha para resolver. Job vai falhar; retentativa ' +
          'cai no mesmo lugar.',
      )
      throw new Error('Instance not found for HubMessage channel')
    }

    const { domainId } = instance
    if (!domainId) {
      throw new Error('Domain ID is required')
    }

    /**
     * Domínio resolvido **aqui**, e não junto da credencial lá embaixo.
     *
     * `instance.domainId` é o único pré-requisito, e ele já existe antes de qualquer
     * desvio de roteamento. Enquanto a leitura ficava depois da instalação, os cinco
     * desvios anteriores a ela — linha não resolvida, assinatura inativa, sem canal
     * vinculado, duplicata, conteúdo não suportado — encerravam sem que ninguém
     * soubesse **de qual portal** era a mensagem, que é o primeiro dado que o suporte
     * precisa. `domainId` é uuid de `core_domains`; quem vai abrir o portal precisa do
     * endereço.
     *
     * Custo: uma leitura por PK nos caminhos que retornam cedo (duplicata e assinatura
     * inativa), que antes não chegavam a ler domínio. No caminho completo o total não
     * muda — a leitura tardia saiu daqui para cá.
     *
     * Ausência **não** antecipa falha: registra e segue. O `throw` por domínio ausente
     * fica onde sempre esteve, junto do da credencial, no ponto em que o `BitrixClient`
     * precisa dele de fato — antecipá-lo derrubaria desvios que hoje encerram sem
     * domínio nenhum.
     */
    const domain = await this.domainRepo.getDomainById(domainId)
    const domainName = domain?.name ?? 'não resolvido'

    /**
     * Tradução do conteúdo antecipada só para a **linha de contexto**: é função pura,
     * sem I/O, então chamá-la aqui não custa nada. O guard de conteúdo não suportado
     * continua lá embaixo, depois do guard de duplicata: subi-lo mudaria qual dos dois
     * descartes ganha numa reentrega de mensagem de tipo desconhecido.
     */
    const content = buildHubMessageContent(message)

    await appendJobLog(
      `Mensagem recebida | domínio=${domainName} | canal=${channelId} | ` +
        `contato=${message.sender?.identifier ?? '—'} | _id=${message._id} | ` +
        `conteúdo=${content?.type ?? 'nenhum tipo suportado'} | ` +
        `arquivos=${content?.files?.length ?? 0}`,
    )

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
    const line = await findLineItemByChannelId(
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
    if (!line) {
      logThinkzapError(
        log,
        'thinkzap.message.inbound_hubmessage_failed',
        {
          channelId,
          domain: domainName,
          internalInstanceId: instance.id,
          messageId: message._id,
        },
        {
          level: 'warn',
          msg: 'Nenhuma linha HubMessage corresponde a este canal — recusando processar',
        },
      )
      await appendJobLog(
        `Nenhuma linha ${ConnectorProvider.HUBMESSAGE} corresponde ao canal "${channelId}" ` +
          `no domínio ${domainName}. A busca filtra por provider, então canal que resolve ` +
          'para linha Z-API também cai aqui. Conserto é no CRM: conferir o canal da linha ' +
          'oficial na SPA. Job vai falhar; retentativa cai no mesmo lugar.',
      )
      throw new Error(
        `Nenhuma linha HUBMESSAGE vinculada ao canal "${channelId}"`,
      )
    }

    const { item } = line

    await appendJobLog(
      `Linha resolvida | item=${item.id} | entitlement=${line.entitlement} | ` +
        `canal aberto=${item.vinculatedChannel ?? '—'}`,
    )

    /**
     * Descarta antes de persistir, mesmo tratamento do caminho Z-API: retorna em
     * vez de lançar, porque exceção aqui vira retry e o provider reentregaria uma
     * mensagem que nunca vai ser aceita.
     */
    if (line.entitlement !== 'active') {
      log.info(
        {
          channelId,
          domain: domainName,
          subscriptionItemId: item.id,
          messageId: message._id,
          entitlement: line.entitlement,
        },
        'Mensagem descartada: linha sem assinatura ativa',
      )

      await appendJobLog(
        `Mensagem DESCARTADA: linha sem assinatura ativa | item=${item.id} | ` +
          `entitlement=${line.entitlement}. É assinatura, não falha técnica — reprocessar ` +
          'o job não muda nada. Job encerrado sem falha, e a mensagem não vai chegar ao ' +
          'canal aberto.',
      )

      /** Sem `await`: o descarte já aconteceu e o worker não espera o provider. */
      this.disconnectExpiredLine.schedule(item, line.entitlement)
      return
    }

    /**
     * Vínculo do item: a coluna homônima da row deixou de ser escrita quando o
     * canal aberto passou para `ufCrm93Conector`.
     */
    const { vinculatedChannel } = item
    if (!vinculatedChannel) {
      logThinkzapError(
        log,
        'thinkzap.message.inbound_hubmessage_failed',
        {
          channelId,
          domain: domainName,
          subscriptionItemId: item.id,
          messageId: message._id,
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

    const alreadyProcessed = await this.messageRepo.findByProviderMessageId(
      instance.id,
      message._id,
    )
    if (alreadyProcessed) {
      log.info(
        {
          channelId,
          domain: domainName,
          internalInstanceId: instance.id,
          messageId: message._id,
          duplicateSkipped: true,
        },
        'HubMessage message already delivered to Bitrix — skipping',
      )
      await appendJobLog(
        `Mensagem DESCARTADA: _id=${message._id} já foi entregue ao canal aberto ` +
          `(domínio=${domainName}). Este job é reentrega do webhook pela HubMessage — ` +
          'reenviar duplicaria a mensagem no CRM. Job encerrado sem falha.',
      )
      return
    }

    if (!content) {
      log.warn(
        {
          channelId,
          domain: domainName,
          messageId: message._id,
          contentTypes: message.contents?.map(item => item?.type),
          attachmentTypes: message.attachments?.map(item => item?.type),
          unsupportedContent: true,
        },
        'No supported content in HubMessage message — skipping',
      )
      await appendJobLog(
        'Mensagem DESCARTADA: nenhum tipo de conteúdo suportado | ' +
          `contents=[${message.contents?.map(item => item?.type ?? '?').join(', ') || '—'}] | ` +
          `attachments=[${message.attachments?.map(item => item?.type ?? '?').join(', ') || '—'}]. ` +
          'Nada havia para enviar. Job encerrado sem falha; retentativa não muda nada.',
      )
      return
    }

    // `appId` vinha de `Connector`; a instalação é alcançável pelo par canônico.
    const installedApp = await this.appRepo.getByAppCodeAndDomainId(
      thinkzapAppCodeId(),
      domainId,
    )
    if (!installedApp) {
      logThinkzapError(
        log,
        'thinkzap.app.not_found',
        { channelId, domainId, domain: domainName, messageId: message._id },
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
        { channelId, domainId, domain: domainName, messageId: message._id },
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

    // Identidade do contato no canal aberto — NUNCA `message.chat_id` (ver doc
    // da classe): aquele campo e identico para todos os contatos do canal e
    // colapsaria todos numa sessao so.
    //
    // O identifier passa por `resolveOpenChannelContactId`, e nao vai cru. Usar o
    // cru era a decisao anterior, pelo receio de amarrar a sessao a heuristica do
    // 9o digito; o efeito real foi pior e imediato. A HubMessage entrega celular BR
    // SEM o 9o digito (`554792259475`) e o envio pelo widget identifica o mesmo
    // contato COM ele (`5547992259475`), entao todo contato iniciado pelo CRM
    // ganhava um segundo canal aberto ao responder. O risco da heuristica e
    // hipotetico; o desencontro entre as direcoes era certo. Canonizar e o que faz
    // as duas formas convergirem.
    const contactId = resolveOpenChannelContactId(message.sender.identifier)
    const contactPhone = normalizePhoneNumber(message.sender.identifier)
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
        domain: domainName,
        messageId: message._id,
        connectorCode: params.CONNECTOR,
        channel: params.LINE,
        chatId: contactId,
        type: content.type,
        filesCount: content.files?.length ?? 0,
      },
      'Prepared HubMessage payload to send to Bitrix',
    )

    await appendJobLog(
      `Entregando no canal aberto | domínio=${domain.name} | CONNECTOR=${params.CONNECTOR} | ` +
        `LINE=${params.LINE} | chat.id=${contactId} | tipo=${content.type} | ` +
        `arquivos=${content.files?.length ?? 0}`,
    )

    const result: unknown = await bitrixClient.sendMessage(params)

    const bitrixChatId = extractBitrixChatId(result)

    log.info(
      {
        channelId,
        domain: domainName,
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
          domain: domainName,
          messageId: message._id,
          bitrixChatId,
          bitrixMessageIdLookupFailed: true,
        },
        'Failed to resolve real Bitrix message id via im.dialog.get',
      )
    }

    /**
     * `session.CHAT_ID` ausente não é falha de entrega: a mensagem já está no canal
     * aberto. É a perda da referência que a resposta do operador usa para citar — por
     * isso a linha diz qual dos dois faltou, em vez de só omitir.
     */
    await appendJobLog(
      `Bitrix aceitou | session.CHAT_ID=${bitrixChatId ?? 'não devolvido'} | ` +
        `bitrixMessageId=${bitrixMessageId ?? 'não resolvido (im.dialog.get)'}`,
    )

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
        {
          channelId,
          domain: domainName,
          messageId: message._id,
          err,
          dbWriteFailed: true,
        },
        'Failed to persist inbound HubMessage snapshot',
      )
      await appendJobLog(
        `Desfecho: mensagem ENTREGUE no canal aberto, mas a persistência falhou — ` +
          `${err instanceof Error ? err.message : String(err)}. Job encerrado sem falha ` +
          'de propósito: retentar duplicaria a mensagem no CRM. Sem o registro, a citação ' +
          'de resposta a esta mensagem não resolve.',
      )
      return
    }

    await appendJobLog(
      `Desfecho: mensagem ENTREGUE no canal aberto ${vinculatedChannel} do domínio ` +
        `${domain.name} e registro persistido.`,
    )
  }
}
