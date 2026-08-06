import { LineEntitlement } from '../connector-trial'

/**
 * A linha existe, mas não está habilitada.
 *
 * Distinto de `LineNotFoundError` de propósito: "não existe" e "existe e está
 * bloqueada" pedem respostas diferentes na tela. Bloqueada por trial vencido tem
 * o que explicar e o que oferecer; inexistente é erro de navegação.
 *
 * Também distinto de falta de permissão, que sai como `403` genérico — o front
 * precisa separar "seu teste acabou" de "você não pode fazer isso".
 */
export class LineBlockedError extends Error {
  constructor(
    readonly subscriptionItemId: string,
    readonly entitlement: Extract<
      LineEntitlement,
      'trial-expired' | 'inactive'
    >,
  ) {
    super(
      entitlement === 'trial-expired'
        ? `Linha "${subscriptionItemId}" está com o período de teste encerrado`
        : `Linha "${subscriptionItemId}" não tem assinatura ativa`,
    )
    this.name = 'LineBlockedError'
  }
}
