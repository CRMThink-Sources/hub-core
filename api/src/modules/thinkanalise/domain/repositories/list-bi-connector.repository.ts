import { BiConnector } from '@/modules/thinkanalise/domain/entities/bi-connector'

export interface ListBiConnectorRepository {
  listBiConnectors(appId: string): Promise<BiConnector[]>
}
