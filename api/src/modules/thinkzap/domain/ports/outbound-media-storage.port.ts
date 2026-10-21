/**
 * Guarda **privada** do arquivo de uma mensagem que espera a vez na fila de saída
 * (anexo do widget). Sem URL pública: o worker lê o arquivo na hora do envio e o
 * entrega ao provider, e apaga depois do desfecho.
 *
 * A espera da cadência não tem prazo, mas o bucket tem regra de ciclo de vida (30
 * dias): arquivo expirado faz a parte falhar, com o motivo na timeline.
 */

export type StoreOutboundMediaInput = {
  data: Buffer
  contentType: string
  scope: { domainId: string }
}

export type LoadedOutboundMedia = {
  data: Buffer
  contentType: string
}

/** Armazenamento fora do ar ao gravar ou ler. */
export class OutboundMediaStorageUnavailableError extends Error {
  constructor(readonly detail?: string) {
    super('O arquivo do anexo não pôde ser guardado ou lido agora.')
    this.name = 'OutboundMediaStorageUnavailableError'
  }
}

/** O arquivo não existe mais (expirou ou já foi apagado). */
export class OutboundMediaNotFoundError extends Error {
  constructor(readonly key: string) {
    super('O arquivo do anexo não está mais disponível.')
    this.name = 'OutboundMediaNotFoundError'
  }
}

export interface OutboundMediaStorage {
  store(input: StoreOutboundMediaInput): Promise<{ key: string }>
  load(key: string): Promise<LoadedOutboundMedia>
  /** Idempotente: apagar o que não existe não é erro. */
  remove(key: string): Promise<void>
}
