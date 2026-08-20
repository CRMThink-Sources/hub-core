import { Domain } from '@/shared/domain/entities/domain'
import {
  UpsertDomainParams,
  UpsertDomainRepository,
} from '@/shared/domain/repositories/domain/upsert-domain.repository'

export type UpsertDomainInput = UpsertDomainParams

/**
 * Passo `upsert-domain` da instalação. Substitui o `GetOrCreateDomain`, que
 * devolvia a linha existente sem tocar nela — reinstalação com `member_id` novo
 * ficava com o valor antigo para sempre.
 */
export class UpsertDomain {
  constructor(private readonly domainRepository: UpsertDomainRepository) {}

  async execute(input: UpsertDomainInput): Promise<Domain> {
    return this.domainRepository.upsertDomain(input)
  }
}
