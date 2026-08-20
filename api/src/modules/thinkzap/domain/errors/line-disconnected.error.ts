/**
 * A linha existe, está habilitada, e a instância não está conectada no provider.
 *
 * **`409` e não `402`.** O `402` desta api significa "a instalação não tem mais
 * direito a esta linha" — é `LineBlockedError`, e a saída é contratar. Desconexão é
 * conflito de estado: o recurso existe, o direito existe, o estado não permite a
 * operação agora. A saída é reconectar o telefone, não pagar nada.
 *
 * Também distinto do erro cru do provider: antes desta checagem a desconexão só
 * aparecia como falha de `sendMessage`, com o texto da Z-API na tela do operador.
 * O `code` no corpo (`line-disconnected`) existe pelo mesmo motivo de
 * `line-blocked`: a mensagem é interpolada com o id do item, e comparar texto no
 * front nunca casaria.
 */
export class LineDisconnectedError extends Error {
  constructor(readonly subscriptionItemId: string) {
    super(`Linha "${subscriptionItemId}" não está conectada`)
    this.name = 'LineDisconnectedError'
  }
}
