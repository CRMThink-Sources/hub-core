import { Domain } from '@/shared/domain/entities/domain'
import { CreateDomainRepository } from '@/shared/domain/repositories/domain/create-domain.repository'
import { GetDomainRepository } from '@/shared/domain/repositories/domain/get-domain.repository'

export type GetOrCreateDomainInput = {
  name: string
  memberId: string
}

export class GetOrCreateDomain {
  constructor(
    private readonly getDomainRepository: GetDomainRepository,
    private readonly createDomainRepository: CreateDomainRepository,
  ) {}

  async execute(input: GetOrCreateDomainInput): Promise<Domain> {
    const existing = await this.getDomainRepository.getDomain(input.name)

    if (existing) {
      return existing
    }

    return this.createDomainRepository.createDomain({
      name: input.name,
      memberId: input.memberId,
    })
  }
}
