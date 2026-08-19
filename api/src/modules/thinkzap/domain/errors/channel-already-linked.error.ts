/**
 * O canal aberto já é de outra linha ativa da mesma instalação.
 *
 * Um canal por linha não é limite técnico arbitrário: o evento de saída do Bitrix
 * (`ONIMCONNECTORMESSAGEADD`) carrega **só** o id do canal, e não a linha. Com duas
 * linhas no mesmo canal não existe no payload nada que diga por qual número responder —
 * o roteamento pegava a primeira da listagem, a mensagem saía por um número arbitrário,
 * o provider aceitava, e o contato daquele chat não recebia nada.
 *
 * `409`: o pedido é válido, o estado do recurso é que não permite. Quem quer as duas
 * linhas atendendo desvincula uma ou cria um segundo canal aberto no Bitrix.
 */
export class ChannelAlreadyLinkedError extends Error {
  constructor(
    readonly line: string,
    /** Item que já ocupa o canal — a informação que torna o erro acionável. */
    readonly occupiedBySubscriptionItemId: string,
    occupiedByName: string,
  ) {
    super(
      `O canal aberto "${line}" já está vinculado à linha "${occupiedByName}". ` +
        'Cada canal aberto atende uma linha só: o Bitrix envia a resposta do operador ' +
        'identificando apenas o canal, então duas linhas no mesmo canal fazem a mensagem ' +
        'sair por um número imprevisível. Desvincule a outra linha ou crie um canal ' +
        'aberto novo para esta.',
    )
    this.name = 'ChannelAlreadyLinkedError'
  }
}
