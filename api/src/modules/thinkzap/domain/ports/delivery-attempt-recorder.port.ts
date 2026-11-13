/**
 * De quem é a tentativa: a row da outbox (envio) ou o `jobId` da fila de entrada
 * (recebimento, em que a tentativa nasce antes da row de falha).
 */
export type DeliveryAttemptRef = {
  kind: 'OUTBOX' | 'INBOUND'
  id: string
}

export type DeliveryAttemptFailure = {
  /** Código do catálogo de erros; `UNCLASSIFIED` quando o erro não foi classificado. */
  errorCode: string
  message: string
  /**
   * Resultado indeterminado (timeout/rede): pode ter entregue ou não. O suporte precisa
   * distinguir isso de um erro definitivo.
   */
  indeterminate?: boolean
  durationMs?: number
}

/**
 * Registra uma tentativa que **falhou**. Sucesso e adiamento sem gastar tentativa
 * (cadência, limite diário, destino ocupado) não chamam.
 *
 * Nunca lança — registro que derruba o envio ou o recebimento que estava observando é
 * pior que registro ausente. Ver as implementações.
 */
export interface DeliveryAttemptRecorder {
  recordFailure(
    ref: DeliveryAttemptRef,
    failure: DeliveryAttemptFailure,
  ): Promise<void>
}

/** Para quem não grava: testes e chamadas fora do worker. */
export const noopDeliveryAttemptRecorder: DeliveryAttemptRecorder = {
  recordFailure: () => Promise.resolve(),
}
