export interface DeleteBiConnectorRepository {
  deleteBiConnector(biconnectorId: number): Promise<void>
}
