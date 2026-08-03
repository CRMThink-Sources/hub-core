import { Domain } from '@/shared/domain/entities/domain'

export type UpsertDomainParams = {
  name: string
  memberId: string
}

/**
 * Escrita idempotente de `core_domains` no fluxo de instalação: cria quando o
 * portal é novo, atualiza `member_id` quando divergir do gravado, e preserva o
 * `id` — assinaturas, saldos e instâncias apontam para ele.
 */
export interface UpsertDomainRepository {
  /** Lança `MemberIdAlreadyLinkedError` quando o `memberId` já é de outro domínio. */
  upsertDomain(params: UpsertDomainParams): Promise<Domain>
}
