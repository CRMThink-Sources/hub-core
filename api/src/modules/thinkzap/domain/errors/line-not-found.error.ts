/**
 * Item de assinatura não existe nas assinaturas da instalação do token.
 *
 * Também é o erro de "item de outro cliente": o escopo vem do JWT, então um id
 * que não está na árvore da instalação é indistinguível de um id inexistente —
 * e é assim que se quer, para não confirmar a existência de recurso alheio.
 */
export class LineNotFoundError extends Error {
  constructor(subscriptionItemId: string) {
    super(`Linha "${subscriptionItemId}" não encontrada nesta instalação`)
    this.name = 'LineNotFoundError'
  }
}
