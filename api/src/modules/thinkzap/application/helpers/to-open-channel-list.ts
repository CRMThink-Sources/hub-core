/**
 * `imopenlines.config.list.get` devolve **array ou objeto** indexado por id.
 *
 * O spike contra portal real já tratava as duas formas, mas `IGetOpenChannelsResponse`
 * declara só array e `ListOpenChannelsController` fazia `.map` direto — resposta em
 * objeto virava `TypeError: result.map is not a function`, e o cliente via 500 sem
 * pista de causa. Normalizar aqui mantém o `.map` dos chamadores válido.
 */
export type OpenChannelRow = {
  ID: string
  LINE_NAME: string
  ACTIVE: string
}

export function toOpenChannelList(result: unknown): OpenChannelRow[] {
  if (Array.isArray(result)) return result as OpenChannelRow[]

  if (result && typeof result === 'object') {
    return Object.values(result as Record<string, OpenChannelRow>).filter(
      (row): row is OpenChannelRow => Boolean(row) && typeof row === 'object',
    )
  }

  return []
}
