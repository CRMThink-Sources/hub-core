import { Connector } from "@/modules/thinkzap/domain/entities/connector";

export interface CreateConnectorRepository {
  createConnector(connector: Omit<Connector, "id">): Promise<void>;
}