export interface RecordCredentialRefreshFailureRepository {
  /**
   * Incrementa o contador de falhas consecutivas de refresh e devolve o total
   * atualizado — é o chamador que decide se esse total esgotou as tentativas.
   * Separado de `update()` porque não há tokens novos pra gravar quando o
   * refresh falha.
   */
  recordFailure(appId: string): Promise<{ attempts: number }>
}
