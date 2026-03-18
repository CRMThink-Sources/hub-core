import { Connector } from '../entities/connector'

export interface GetConnectorRepository {
  get(id: string): Promise<Connector | null>
  getConnectorByInstanceId(instanceId: string): Promise<Connector | null>
}
