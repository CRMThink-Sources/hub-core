/**
 * Hospedagem temporária da imagem do cabeçalho enviada pelo widget. A Meta baixa a
 * imagem pela URL a cada envio, então o que importa é devolver uma URL pública,
 * direta para o arquivo e estável enquanto a fila puder reenviar.
 *
 * Não lista nem apaga: a expiração é responsabilidade do armazenamento (regra de
 * ciclo de vida do bucket).
 */

export type StoreTemplateImageInput = {
  data: Buffer
  /** Decidido pela assinatura do arquivo, nunca pelo que o navegador declarou. */
  contentType: 'image/jpeg' | 'image/png'
  scope: { domainId: string }
  /**
   * `temporary` (padrão): imagem de um envio, expira em até 30 dias.
   * `permanent`: imagem padrão do envio de um template, sem expiração — o template
   * continua sendo enviado com ela por tempo indeterminado.
   */
  retention?: 'temporary' | 'permanent'
}

export type StoredTemplateImage = {
  /** URL pública `https` do arquivo. */
  url: string
  /** Chave do objeto no armazenamento, para log e suporte. */
  key: string
}

/** Armazenamento não configurado ou fora do ar: o operador pode usar um link. */
export class TemplateImageStorageUnavailableError extends Error {
  constructor(readonly detail?: string) {
    super(
      'O envio de arquivo da imagem está indisponível no momento. Informe um link público da imagem.',
    )
    this.name = 'TemplateImageStorageUnavailableError'
  }
}

export interface TemplateImageStorage {
  /** Rejeita com `TemplateImageStorageUnavailableError` quando não consegue gravar. */
  store(input: StoreTemplateImageInput): Promise<StoredTemplateImage>
}
