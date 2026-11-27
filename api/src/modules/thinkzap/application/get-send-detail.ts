import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import type {
  SendLineCatalog,
  SendListReader,
  SendSenderNameResolver,
} from '@/modules/thinkzap/domain/ports/send-list-lookups.port'
import { SendNotFoundError } from '@/modules/thinkzap/domain/errors/send-not-found.error'
import type { RecipientState } from '@/modules/thinkzap/domain/send-notice'
import { crmRecordReference } from '@/modules/thinkzap/application/helpers/crm-record-reference'
import {
  describePart,
  failureReasonFor,
  groupKindOf,
  sendKindOf,
  sendOriginOf,
  summarizeParts,
  type SendKind,
  type SendOrigin,
} from '@/modules/thinkzap/application/helpers/send-view'
import type { SendListScope } from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-list.repository'
import type { WidgetOutboxRecord } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'

export type GetSendDetailInput = {
  /** O id do envio da lista (`SendListEntry.id`). */
  id: string
  domainId: string
  appCode: string
  bitrixUserId: string
  isAdmin: boolean
}

export type SendDetail = {
  id: string
  createdAt: string
  line: { id: string; name: string }
  destination: string
  kind: SendKind
  origin: SendOrigin
  sender: { id: string | null; name: string | null }
  status: RecipientState
  failureReason: string | null
  text: string
  template: { name: string; language: string | null } | null
  timestamps: {
    sentAt: string | null
    deliveredAt: string | null
    readAt: string | null
    rejectedAt: string | null
  }
  /** Código da Meta e motivo traduzido; `null` quando o envio não falhou. */
  failure: { code: string | null; reason: string } | null
  parts: {
    kind: SendKind
    fileName: string | null
    status: RecipientState
    failureReason: string | null
  }[]
  /** `url` é relativa ao portal Bitrix, como `crmRecordReference` a monta. */
  crmRecord: { entity: string; entityId: string; url: string } | null
}

/**
 * O detalhe de um envio. A visibilidade é a do repositório (`findDetail`): toda
 * negação — outra instalação, outro remetente, inexistente, mais de 90 dias,
 * envio não acompanhado — chega aqui como `null` e vira o mesmo
 * `SendNotFoundError`, sem revelar que o envio existe.
 */
export class GetSendDetail {
  constructor(
    private readonly sends: SendListReader,
    private readonly locales: InstallationLocaleRepository,
    private readonly lines: SendLineCatalog,
    private readonly senderNames: SendSenderNameResolver,
  ) {}

  async execute(input: GetSendDetailInput): Promise<SendDetail> {
    const scope: SendListScope = {
      domainId: input.domainId,
      appCode: input.appCode,
      onlyOperatorId: input.isAdmin ? null : input.bitrixUserId,
    }
    const item = await this.sends.findDetail(input.id, scope)
    const head = item?.parts[0]
    const summary = item ? summarizeParts(item.parts) : null
    if (!item || !head || !summary) throw new SendNotFoundError()

    const [locale, catalog] = await Promise.all([
      this.locales.byInstallation(input.domainId, input.appCode),
      this.lines.listLines({
        domainId: input.domainId,
        appCode: input.appCode,
      }),
    ])

    const senderId =
      item.parts.find(part => part.operatorBitrixUserId)
        ?.operatorBitrixUserId ?? null
    const senderName = senderId ? await this.resolveName(senderId) : null

    const reason = failureReasonFor(summary, locale)
    const crm = crmRecordReference(head.entity, head.entityId)
    const template = item.parts.find(part => part.kind === 'TEMPLATE')

    return {
      id: item.headId,
      createdAt: item.createdAt.toISOString(),
      line: {
        id: head.subscriptionItemId,
        name:
          catalog.find(line => line.id === head.subscriptionItemId)?.name ??
          head.subscriptionItemId,
      },
      destination: item.destination,
      kind: groupKindOf(item.parts),
      origin: sendOriginOf(head),
      sender: { id: senderId, name: senderName },
      status: summary.state,
      failureReason: reason,
      text: textOf(item.parts),
      template: template?.templateName
        ? { name: template.templateName, language: template.templateLanguage }
        : null,
      timestamps: timestampsOf(item.parts),
      failure:
        reason === null
          ? null
          : { code: summary.failedPart?.failureCode ?? null, reason },
      parts: item.parts.map(part => ({
        kind: sendKindOf(part),
        fileName: part.fileName,
        ...describePart(part, locale),
      })),
      crmRecord: crm
        ? { entity: head.entity, entityId: head.entityId, url: crm.url }
        : null,
    }
  }

  private async resolveName(id: string): Promise<string | null> {
    try {
      return (await this.senderNames.resolveNames([id])).get(id) ?? null
    } catch {
      return null
    }
  }
}

/**
 * O texto da primeira parte que o tem. Não usa `dispatchMeta`: no disparo de
 * robô ele só existe na row do primeiro destinatário, e o detalhe de qualquer
 * outro ficaria sem texto.
 */
function textOf(parts: WidgetOutboxRecord[]): string {
  return (
    parts.find(part => part.text.trim() !== '')?.text ??
    parts.find(part => part.caption)?.caption ??
    ''
  )
}

/**
 * Horários do envio inteiro. O envio só "saiu" quando a primeira parte saiu
 * (o `sentAt` mais cedo); entregue e lido seguem a regra do status — o menor
 * avanço —, então só têm valor quando **todas** as partes os têm, e é o da
 * última parte a chegar. A entrega de uma parte lida conta como entregue. A
 * recusa mostra a primeira que a Meta informou.
 */
function timestampsOf(parts: WidgetOutboxRecord[]) {
  const dates = (pick: (part: WidgetOutboxRecord) => Date | null) =>
    parts.flatMap(part => {
      const at = pick(part)
      return at ? [at.getTime()] : []
    })
  const iso = (ms: number) => new Date(ms).toISOString()
  const earliest = (times: number[]) =>
    times.length === 0 ? null : iso(Math.min(...times))
  const whenAll = (times: number[]) =>
    times.length > 0 && times.length === parts.length
      ? iso(Math.max(...times))
      : null

  return {
    sentAt: earliest(dates(part => part.sentAt)),
    deliveredAt: whenAll(dates(part => part.deliveredAt ?? part.readAt)),
    readAt: whenAll(dates(part => part.readAt)),
    rejectedAt: earliest(dates(part => part.rejectedAt)),
  }
}
