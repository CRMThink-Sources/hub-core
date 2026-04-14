export interface UpdateBiConnectorRepository {
  updateBiConnector(
    biconnectorId: number,
    data: { label?: string; apiKey?: string },
  ): Promise<void>
}
