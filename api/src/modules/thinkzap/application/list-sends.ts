import type { InstallationLocaleRepository } from '@/modules/thinkzap/domain/ports/installation-locale.port'
import type {
  SendLineCatalog,
  SendListReader,
  SendSenderNameResolver,
} from '@/modules/thinkzap/domain/ports/send-list-lookups.port'
import {
  SEND_HISTORY_MAX_DAYS,
  type SendListFilters,
  type SendListStatus,
} from '@/modules/thinkzap/domain/send-list-filters'
import {
  failureReasonFor,
  groupKindOf,
  sendOriginOf,
  summarizeParts,
  type SendKind,
  type SendOrigin,
} from '@/modules/thinkzap/application/helpers/send-view'
import type { SendListScope } from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-list.repository'

export type ListSendsInput = {
  /** Já normalizados por `normalizeSendListFilters`. */
  filters: SendListFilters
  /** Identidade do token; nunca da query string. */
  domainId: string
  appCode: string
  bitrixUserId: string
  /** `thinkzapAccess.canManageAccess`. */
  isAdmin: boolean
}

export type SendListEntry = {
  /** O id do envio: o que o detalhe recebe. */
  id: string
  createdAt: string
  line: { id: string; name: string }
  destination: string
  kind: SendKind
  origin: SendOrigin
  /** `id` nulo = robô sem usuário; `name` nulo = o Bitrix não resolveu. */
  sender: { id: string | null; name: string | null }
  status: SendListStatus
  /** Só em FAILED, PARTIAL e UNKNOWN; já traduzido, nunca vazio. */
  failureReason: string | null
}

export type ListSendsOutput = {
  items: SendListEntry[]
  total: number
  page: number
  limit: number
  retentionDays: number
  /** Opções do filtro de linha. */
  lines: { id: string; name: string }[]
  /** Opções do filtro de remetente: só o administrador as recebe. */
  senders: { id: string; name: string | null }[]
}

/**
 * A lista da aba Envios: aplica o perfil, calcula o estado de cada destinatário
 * e traduz o motivo da falha.
 *
 * O filtro de status já foi aplicado no SQL (`recipientStateCase`); aqui o estado
 * mostrado é recalculado por `summarizeRecipients`, a fonte da verdade, e **não**
 * se filtra de novo em memória — refiltrar quebraria o `total` e a paginação.
 *
 * Nada que identifique pessoa ou mensagem (telefone, texto) vai para log.
 */
export class ListSends {
  constructor(
    private readonly sends: SendListReader,
    private readonly locales: InstallationLocaleRepository,
    private readonly lines: SendLineCatalog,
    private readonly senderNames: SendSenderNameResolver,
  ) {}

  async execute(input: ListSendsInput): Promise<ListSendsOutput> {
    const { filters, isAdmin } = input
    // Quem não é administrador vê só os próprios envios, sem exceção: o
    // `senderId` pedido some aqui e o repositório também o ignora.
    const scope: SendListScope = {
      domainId: input.domainId,
      appCode: input.appCode,
      onlyOperatorId: isAdmin ? null : input.bitrixUserId,
    }
    const period = { from: filters.from, to: filters.to }
    const effective: SendListFilters = isAdmin
      ? filters
      : { ...filters, senderId: null }

    const [locale, page, catalog, lineIds, senderIds] = await Promise.all([
      this.locales.byInstallation(input.domainId, input.appCode),
      this.sends.list(effective, scope),
      this.lines.listLines({
        domainId: input.domainId,
        appCode: input.appCode,
      }),
      this.sends.listLineIds(scope, period),
      this.sends.listSenderIds(scope, period),
    ])

    const lineNames = new Map(catalog.map(line => [line.id, line.name]))
    const nameOfLine = (id: string) => lineNames.get(id) ?? id

    // Uma única chamada ao Bitrix para quem aparece na página e nas opções.
    const pageSenderIds = page.items.flatMap(item => {
      const id = senderIdOf(item.parts)
      return id === null ? [] : [id]
    })
    const optionSenderIds = isAdmin ? senderIds : []
    const names = await this.resolveNames([
      ...new Set([...pageSenderIds, ...optionSenderIds]),
    ])

    const items = page.items.flatMap<SendListEntry>(item => {
      const head = item.parts[0]
      const summary = summarizeParts(item.parts)
      if (!head || !summary) return []
      const senderId = senderIdOf(item.parts)
      return [
        {
          id: item.headId,
          createdAt: item.createdAt.toISOString(),
          line: {
            id: head.subscriptionItemId,
            name: nameOfLine(head.subscriptionItemId),
          },
          destination: item.destination,
          kind: groupKindOf(item.parts),
          origin: sendOriginOf(head),
          sender: {
            id: senderId,
            name: senderId === null ? null : (names.get(senderId) ?? null),
          },
          status: summary.state,
          failureReason: failureReasonFor(summary, locale),
        },
      ]
    })

    // Linhas do contexto mais as que só aparecem no histórico (linha excluída).
    const lineOptions = new Map(catalog.map(line => [line.id, line.name]))
    for (const id of lineIds) if (!lineOptions.has(id)) lineOptions.set(id, id)

    return {
      items,
      total: page.total,
      page: filters.page,
      limit: filters.limit,
      retentionDays: SEND_HISTORY_MAX_DAYS,
      lines: [...lineOptions]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      senders: optionSenderIds.map(id => ({
        id,
        name: names.get(id) ?? null,
      })),
    }
  }

  /** Melhor esforço: o Bitrix fora do ar deixa a lista sem nomes, não sem lista. */
  private async resolveNames(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map()
    try {
      return await this.senderNames.resolveNames(ids)
    } catch {
      return new Map()
    }
  }
}

/** O remetente do envio: o de qualquer parte que o tenha (robô sem usuário: nenhum). */
function senderIdOf(
  parts: { operatorBitrixUserId: string | null }[],
): string | null {
  return (
    parts.find(part => part.operatorBitrixUserId)?.operatorBitrixUserId ?? null
  )
}
