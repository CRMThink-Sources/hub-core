import { Domain } from '@/shared/domain/entities/domain'

export interface CreateDomainRepository {
  createDomain(
    domain: Omit<Domain, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Domain>
}
