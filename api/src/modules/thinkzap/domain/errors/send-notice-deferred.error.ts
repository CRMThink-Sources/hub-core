/**
 * O Bitrix recusou a publicação de um aviso de envio sem executá-la (método pausado
 * por limite ou recusa por intensidade): nada foi gravado, e o job deve voltar só em
 * `untilMs`.
 *
 * Erro próprio, e não o do Bitrix, porque quem trata é o worker: ele reagenda o job
 * sem gastar tentativa. Repetir pelo backoff comum esgotaria as tentativas durante a
 * pausa, e o comentário ou a notificação se perderiam.
 */
export class SendNoticeDeferredError extends Error {
  constructor(
    readonly noticeId: string,
    readonly untilMs: number,
    cause?: unknown,
  ) {
    super(
      `O Bitrix recusou por limite a publicação do aviso de envio ${noticeId}; o job volta em ${new Date(untilMs).toISOString()}.`,
      { cause },
    )
    this.name = 'SendNoticeDeferredError'
  }
}
