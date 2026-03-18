import { Connector } from '@/modules/thinkzap/domain/entities/connector'

export interface ListConnectorsRepository {
  listConnectors(domainId: string): Promise<Connector[]>
}
