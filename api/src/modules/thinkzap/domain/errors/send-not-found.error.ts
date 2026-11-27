/**
 * O envio pedido no detalhe não pode ser mostrado a quem pediu.
 *
 * Uma única classe para todas as negações — id inexistente, outra instalação,
 * envio de outro remetente, mais de 90 dias, envio não acompanhado —, porque
 * qualquer diferença na resposta revelaria que o envio existe. O controller
 * responde 404.
 */
export class SendNotFoundError extends Error {
  constructor() {
    super(
      'Envio não encontrado. Confira o id ou volte à lista de envios: só aparecem os seus envios dos últimos 90 dias.',
    )
    this.name = 'SendNotFoundError'
  }
}
