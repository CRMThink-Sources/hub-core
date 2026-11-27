/**
 * Um filtro da aba Envios veio com valor que a lista não sabe aplicar.
 *
 * Só o que não tem leitura razoável vira erro (status desconhecido, data
 * inválida): período longo demais e página fora da faixa são ajustados, para o
 * front não precisar tratar recusa por isso. O controller responde 400.
 */
export class InvalidSendListFilterError extends Error {
  constructor(
    readonly field: 'status' | 'from' | 'to',
    readonly value: string,
  ) {
    super(
      field === 'status'
        ? `Status "${value}" não é aceito na lista de envios. Use WAITING, SENT, DELIVERED, READ, FAILED, PARTIAL ou UNKNOWN.`
        : `Data "${value}" inválida no filtro "${field}" da lista de envios. Envie a data em formato ISO 8601.`,
    )
    this.name = 'InvalidSendListFilterError'
  }
}
