/** Teto do arquivo de imagem de uma novidade. */
export const PRODUCT_UPDATE_IMAGE_MAX_BYTES = 5 * 1024 * 1024

export type ProductUpdateImageContentType = 'image/jpeg' | 'image/png'

export type StoreProductUpdateImageInput = {
  data: Buffer
  /** Decidido pela assinatura do arquivo, nunca pelo que o navegador declarou. */
  contentType: ProductUpdateImageContentType
}

export type StoredProductUpdateImage = {
  /** Chave do objeto, gravada em `content.imageKey`. */
  key: string
  url: string
}

/**
 * Armazenamento permanente da imagem de uma novidade (sem expiração). Não apaga:
 * trocar ou remover a imagem não remove o objeto antigo, que pode estar no snapshot
 * publicado.
 */
export interface ProductUpdateImageStorage {
  /** Rejeita com `ProductUpdateImageStorageUnavailableError` quando não grava. */
  store(input: StoreProductUpdateImageInput): Promise<StoredProductUpdateImage>
}

/**
 * URL pública de uma chave: domínio público do bucket + chave. Pura para servir à
 * leitura (backoffice e cliente) sem depender do adapter.
 */
export function productUpdateImageUrl(
  publicBaseUrl: string,
  key: string | null,
): string | null {
  if (!key || !publicBaseUrl.trim()) return null
  return `${publicBaseUrl.trim().replace(/\/+$/, '')}/${key}`
}
