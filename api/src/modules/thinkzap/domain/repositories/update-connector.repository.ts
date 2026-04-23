export interface UpdateConnectorRepository {
  markAsInactive(connectorId: string): Promise<void>
}
