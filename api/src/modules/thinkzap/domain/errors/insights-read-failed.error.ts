/**
 * O cálculo do painel do Insights falhou, ou passou do prazo sem terminar. É o
 * que a consulta devolve no lugar de "calculando": a tela não pode esperar para
 * sempre.
 *
 * O motivo real (Vibe API fora do ar, `429`, worker parado) fica no log do
 * worker; aqui só se diz o que fazer. Quem apresenta ao cliente é o controller,
 * com a mensagem curta de falha de leitura, sem repassar dado do portal.
 */
export class InsightsReadFailedError extends Error {
  constructor(readonly reason: 'failed' | 'timeout') {
    super(
      reason === 'timeout'
        ? 'O cálculo do painel do Insights não terminou no prazo. Abra o painel de novo para tentar outra vez; se persistir, confira se o worker de Insights está no ar.'
        : 'O cálculo do painel do Insights falhou. Abra o painel de novo para tentar outra vez; o motivo está no log do worker de Insights.',
    )
    this.name = 'InsightsReadFailedError'
  }
}
