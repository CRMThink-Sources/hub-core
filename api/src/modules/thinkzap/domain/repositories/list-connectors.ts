import { Connector } from '@/modules/thinkzap/domain/entities/connector'

export interface ListConnectorsRepository {
  listConnectors(
    appId: string,
    includeZapiToken?: boolean,
  ): Promise<Connector[]>
}
