/**
 * O usuário do widget não tem acesso à linha escolhida (grupos de acesso).
 *
 * Imposto no servidor, e não só escondido no seletor do widget: sem isso, qualquer
 * chamada direta à API com o `subscriptionItemId` de outra linha burlaria a regra.
 */
export class LineNotAllowedError extends Error {
  constructor(readonly subscriptionItemId: string) {
    super(
      'Você não tem acesso a esta linha. Escolha uma das linhas liberadas para o seu usuário ou peça ao administrador para incluí-lo em um grupo de acesso com ela.',
    )
    this.name = 'LineNotAllowedError'
  }
}
