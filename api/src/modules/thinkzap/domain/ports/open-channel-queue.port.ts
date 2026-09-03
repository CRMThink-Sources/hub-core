/**
 * O que o envio precisa dizer para que a conversa do canal aberto seja criada depois.
 *
 * Um port, e não a fila concreta, porque os dois use cases de envio são testados sem
 * Redis — e porque a decisão de *quando* abrir a conversa é do envio, enquanto o
 * *como* (fila, worker, retentativa) é infraestrutura.
 */
export type OpenChannelConversationJob = {
  subscriptionItemId: string
  domainId: string
  appCode: string
  /** `Instance.id` — a âncora com que a mensagem foi persistida. */
  instanceId: string
  providerMessageId: string
  /** Telefone do destino, já normalizado. */
  destination: string
  /** O texto a postar; em envio só de anexo, o descritivo do tipo. */
  text: string
  /**
   * Entidade do CRM de onde o envio partiu. Serve **só para o nome** da conversa — o
   * operador prefere ver o nome do contato a ver o número.
   *
   * Opcional porque nem toda origem tem uma: o reparo pelo callback de status da Z-API
   * conhece só o evento do provider. Sem ela, o nome cai no telefone.
   */
  entity?: string
  entityId?: string
}

export interface OpenChannelConversationQueue {
  enqueue(job: OpenChannelConversationJob): Promise<void>
}
