import { randomUUID } from 'node:crypto'
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import { ProductUpdateImageStorageUnavailableError } from '../../domain/errors/product-update.errors'
import {
  ProductUpdateImageStorage,
  StoreProductUpdateImageInput,
  StoredProductUpdateImage,
  productUpdateImageUrl,
} from '../../domain/ports/product-update-image-storage.port'

export type R2ProductUpdateImageStorageConfig = {
  bucket: string
  /** Domínio público do bucket (próprio ou `r2.dev`). */
  publicBaseUrl: string
}

const EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg' } as const

/**
 * Adapter Cloudflare R2 (API compatível com S3) de `ProductUpdateImageStorage`, no
 * mesmo bucket da imagem de template.
 *
 * Chave `product-updates/<uuid>.<ext>`: fora da regra de expiração do bucket (que
 * vale só para `template-headers/`), e o `uuid` torna a URL impossível de adivinhar.
 */
export class R2ProductUpdateImageStorage implements ProductUpdateImageStorage {
  constructor(
    private readonly s3: S3Client,
    private readonly config: R2ProductUpdateImageStorageConfig,
  ) {}

  async store(
    input: StoreProductUpdateImageInput,
  ): Promise<StoredProductUpdateImage> {
    const key = `product-updates/${randomUUID()}.${EXTENSION[input.contentType]}`

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: input.data,
          ContentType: input.contentType,
          ContentLength: input.data.length,
        }),
      )
    } catch (error) {
      throw new ProductUpdateImageStorageUnavailableError(
        error instanceof Error ? error.message : String(error),
      )
    }

    return {
      key,
      url: productUpdateImageUrl(this.config.publicBaseUrl, key) ?? key,
    }
  }
}
