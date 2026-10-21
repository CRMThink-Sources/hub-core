import { thinkzapAppCodeId } from '@/shared/app-catalog/app-catalog'
import { GetAplicationContext } from '@/modules/application/application/get-aplication-context'
import { SubscriptionItem } from '@/modules/application/domain/entities/subscription-item'
import { findLineItemByInstanceId } from '@/modules/thinkzap/application/helpers/resolve-settings-by-instance-id'
import { DisconnectExpiredLine } from '@/modules/thinkzap/application/disconnect-expired-line'
import { GetInstanceRepository } from '@/modules/thinkzap/domain/repositories/get-instance.repository'
import { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { ReceivedMessageEvent } from '@/shared/infra/handlers/z-api/z-api'
import { GetCredentialRepository } from '@/shared/domain/repositories/credential/get-credential'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'
import { GetInstalledAppRepository } from '@/shared/domain/repositories/instaled-app/get-installed-app.repository'
import { Domain } from '@/shared/domain/entities/domain'
import { Credential } from '@/shared/domain/entities/credential'
import { Instance } from '@/modules/thinkzap/domain/entities/instance'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '@/modules/thinkzap/errors/catalog'
import {
  noopJobLog,
  type AppendJobLog,
} from '@/modules/thinkzap/domain/ports/job-log.port'
import {
  toQuoteInput,
  PrismaThinkzapMessageRepository,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import {
  ThinkzapMessageQuoteInput,
  buildMessageTextWithReply,
  extractQuoteInput,
} from './build-reply-quote'

/**
 * O que a entrega de um evento Z-API no canal aberto tem em comum, venha a mensagem
 * do contato (`ProcessZApiInboundMessageUseCase`) ou do próprio aparelho da linha
 * (`MirrorZApiSentByMeMessageUseCase`).
 *
 * A resolução vem em três passos, e não num só, porque o espelhamento precisa checar
 * o toggle da linha **entre** eles: depois de ter o item, antes de exigir canal e
 * credencial — toggle desligado é descarte, não falha.
 */

const log = createWorkerSourceLogger('z-api')

export type ZApiInstanceContext = {
  instance: Instance
  domainId: string
  domain: Domain | null
  /** Endereço do portal, ou `'não resolvido'` — só para log. */
  domainName: string
}

/**
 * Instância e domínio. Lança quando não há instância: nenhuma instalação é alcançável
 * pela chave, e retentativa cai no mesmo lugar.
 */
export async function loadZApiInstance(
  deps: {
    instanceRepo: GetInstanceRepository
    domainRepo: GetDomainRepository
  },
  event: ReceivedMessageEvent,
  appendJobLog: AppendJobLog,
): Promise<ZApiInstanceContext> {
  const instance = await deps.instanceRepo.getInstanceByInstanceId(
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
  const domain = await deps.domainRepo.getDomainById(domainId)
  const domainName = domain?.name ?? 'não resolvido'

  return { instance, domainId, domain, domainName }
}

/**
 * Item de assinatura da linha, com assinatura ativa. `null` quando a linha não tem
 * assinatura ativa: o evento foi descartado (já registrado) e o job encerra sem
 * falha. Lança quando não há item nenhum.
 */
export async function resolveActiveZApiLine(
  deps: {
    getAplicationContext: GetAplicationContext
    disconnectExpiredLine: DisconnectExpiredLine
  },
  context: ZApiInstanceContext,
  event: ReceivedMessageEvent,
  appendJobLog: AppendJobLog,
): Promise<SubscriptionItem | null> {
  const { instance, domainId, domainName } = context

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
    deps.getAplicationContext,
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
    deps.disconnectExpiredLine.schedule(item, line.entitlement)
    return null
  }

  return item
}

export type ZApiBitrixAccess = {
  vinculatedChannel: string
  domain: Domain
  credential: Credential
}

/**
 * Canal aberto vinculado, instalação e credencial — tudo que falta para chamar o
 * Bitrix. Lança em qualquer ausência: são estados que retentativa não conserta, mas
 * que precisam aparecer como falha.
 */
export async function resolveZApiBitrixAccess(
  deps: {
    appRepo: GetInstalledAppRepository
    credentialRepo: GetCredentialRepository
  },
  context: ZApiInstanceContext,
  item: SubscriptionItem,
  event: ReceivedMessageEvent,
  appendJobLog: AppendJobLog,
): Promise<ZApiBitrixAccess> {
  const { domainId, domain, domainName } = context

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

  const installedApp = await deps.appRepo.getByAppCodeAndDomainId(
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

  const app = await deps.appRepo.getById(installedApp.id)

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

  const credential = await deps.credentialRepo.get({ appId: app.id })

  if (!domain || !credential) {
    await appendJobLog(
      `Sem como chamar o Bitrix | domínio=${domain ? 'ok' : 'não encontrado'} | ` +
        `credencial=${credential ? 'ok' : 'não encontrada'}. Reinstalar o app renova a ` +
        'credencial. Job vai falhar; retentativa cai no mesmo lugar.',
    )
    throw new Error('Domain or credential not found')
  }

  return { vinculatedChannel, domain, credential }
}

/**
 * Qual das três chamadas ao Bitrix vai sair. O caminho Z-API é o único inbound que
 * tem mais de uma, e duas delas **não** produzem mensagem nova no canal aberto — sem
 * o rótulo, um job `completed` de edição parece um job que perdeu a mensagem.
 */
export function describeZApiOperation(event: ReceivedMessageEvent): string {
  if (event.isEdit) return 'atualização de mensagem existente (updateMessage)'
  if (event.notification === 'REVOKE') {
    return event.fromMe
      ? 'remoção de mensagem apagada pelo aparelho (deleteMessage)'
      : 'remoção de mensagem apagada pelo contato (deleteMessage)'
  }
  return 'envio de mensagem nova (sendMessage)'
}

export async function resolveBitrixMessageId(
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

export async function applyReplyContext(
  messageRepo: Pick<PrismaThinkzapMessageRepository, 'findByProviderMessageId'>,
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
    const record = await messageRepo.findByProviderMessageId(
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

export async function persistInboundSnapshot(
  messageRepo: Pick<PrismaThinkzapMessageRepository, 'create'>,
  event: ReceivedMessageEvent,
  instanceDbId: string,
  bitrixMessageId: string | null,
  bitrixChatId: string | null,
  chatId: string | null,
  /**
   * Texto já com menção resolvida (`@<lid>` → telefone), só no caminho de
   * grupo. `null` no 1:1, que não tem participante nem menção a resolver.
   * Sem isto, o histórico persistiria o `@<lid>` bruto enquanto o Bitrix já
   * mostra o telefone — o mesmo texto tem que valer para os dois.
   */
  resolvedText: string | null = null,
  appendJobLog: AppendJobLog = noopJobLog,
  /**
   * Só no espelhamento do aparelho: o operador como quem a cópia foi postada, para
   * edição e remoção saírem com o mesmo autor. `null` = postada como o contato.
   */
  bitrixUserId: string | null = null,
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
    const text =
      quoteInput.type === 'TEXT' && resolvedText !== null
        ? resolvedText
        : (quoteInput.text ?? null)
    await messageRepo.create({
      instanceId: instanceDbId,
      source: 'ZAPI',
      providerMessageId: event.messageId,
      bitrixMessageId,
      bitrixChatId,
      type: quoteInput.type,
      text,
      fileName: quoteInput.fileName ?? null,
      chatId,
      // `undefined` sem autor: o upsert parcial não apaga um autor já gravado.
      bitrixUserId: bitrixUserId ?? undefined,
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
export function resolveInboundText(event: ReceivedMessageEvent): string {
  if (event.image) return event.image.caption || ''
  if (event.video) return event.video.caption || ''
  if (event.document) return event.document.caption || ''
  if (event.buttonReply) return event.buttonReply.message || ''
  return event.text?.message || ''
}

export function buildMessageFiles(
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

export function buildContactText(
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

export function resolveGroupChatId(event: ReceivedMessageEvent): string | null {
  return event.phone.includes('-group') ? event.phone : event.chatLid
}
