import { Domain } from '@/shared/domain/entities/domain'

export interface GetDomainRepository {
  getDomainById(id: string): Promise<Domain | null>
  getDomain(name: string): Promise<Domain | null>
}
