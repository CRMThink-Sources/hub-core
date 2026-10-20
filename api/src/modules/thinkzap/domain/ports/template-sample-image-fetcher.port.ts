/**
 * Download da imagem de exemplo do cabeçalho de um template novo, antes de mandar
 * o template para a Meta. Recusar aqui troca as recusas opacas da Meta
 * (`2388215 invalid media sample`, `380 media download failed`) por uma mensagem
 * que o operador entende e corrige.
 */

/** Teto da Meta para imagem de cabeçalho. */
export const TEMPLATE_SAMPLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export type TemplateSampleImageContentType = 'image/jpeg' | 'image/png'

export type TemplateSampleImage = {
  data: Buffer
  contentType: TemplateSampleImageContentType
}

export type TemplateSampleImageFailure =
  | 'not_https'
  | 'meta_cdn'
  | 'private_host'
  | 'unreachable'
  | 'too_large'
  | 'invalid_type'

/** A imagem de exemplo não serve; `reason` diz por quê. */
export class TemplateSampleImageError extends Error {
  constructor(
    readonly reason: TemplateSampleImageFailure,
    detail?: string,
  ) {
    super(
      `Template sample image rejected: ${reason}${detail ? ` (${detail})` : ''}`,
    )
    this.name = 'TemplateSampleImageError'
  }
}

export interface TemplateSampleImageFetcher {
  /** Rejeita com `TemplateSampleImageError` quando a imagem não serve. */
  fetch(url: string): Promise<TemplateSampleImage>
}
