import type { SendListFilters } from '@/modules/thinkzap/domain/send-list-filters'
import type {
  SendListItem,
  SendListPage,
  SendListScope,
} from '@/modules/thinkzap/infra/persistence/repositories/prisma-send-list.repository'

/** O que os casos de uso da aba Envios leem do outbox (o repositório Prisma). */
export interface SendListReader {
  list(filters: SendListFilters, scope: SendListScope): Promise<SendListPage>
  listLineIds(
    scope: SendListScope,
    period: { from: Date; to: Date },
  ): Promise<string[]>
  listSenderIds(
    scope: SendListScope,
    period: { from: Date; to: Date },
  ): Promise<string[]>
  findDetail(id: string, scope: SendListScope): Promise<SendListItem | null>
}

export type SendLineInfo = { id: string; name: string }

/**
 * As linhas da instalação, lidas do contexto de assinatura. Não consulta Z-API
 * nem HubMessage: a aba só precisa do nome.
 */
export interface SendLineCatalog {
  listLines(input: {
    domainId: string
    appCode: string
  }): Promise<SendLineInfo[]>
}

/**
 * Nomes dos usuários do Bitrix, em uma chamada para o conjunto. Melhor esforço:
 * quem não vier no mapa fica sem nome; a implementação pode lançar, e os casos
 * de uso tratam isso como "ninguém resolvido".
 */
export interface SendSenderNameResolver {
  resolveNames(userIds: string[]): Promise<Map<string, string>>
}
