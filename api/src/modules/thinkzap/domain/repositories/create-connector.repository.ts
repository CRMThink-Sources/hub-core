import { Connector } from '@/modules/thinkzap/domain/entities/connector'

/** `provider` é opcional na criação — default `ZAPI` quando ausente. */
export type CreateConnectorInput = Omit<Connector, 'id' | 'provider'> &
  Partial<Pick<Connector, 'provider'>>

export interface CreateConnectorRepository {
  createConnector(connector: CreateConnectorInput): Promise<void>
}
