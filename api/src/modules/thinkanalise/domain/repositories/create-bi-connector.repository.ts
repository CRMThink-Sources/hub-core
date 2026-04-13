import { BiConnector } from '@/modules/thinkanalise/domain/entities/bi-connector'

export interface CreateBiConnectorRepository {
  createBiConnector(connector: Omit<BiConnector, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>
}
