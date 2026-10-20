import { randomUUID } from 'node:crypto'
import { PutObjectCommand, type S3Client } from '@aws-sdk/client-s3'
import {
  StoredTemplateImage,
  StoreTemplateImageInput,
  TemplateImageStorage,
  TemplateImageStorageUnavailableError,
} from '@/modules/thinkzap/domain/ports/template-image-storage.port'

export type R2TemplateImageStorageConfig = {
  bucket: string
  /** Domínio público do bucket (próprio ou `r2.dev`), sem barra no fim. */
  publicBaseUrl: string
}

const EXTENSION = { 'image/png': 'png', 'image/jpeg': 'jpg' } as const

/**
 * Adapter Cloudflare R2 (API compatível com S3) de `TemplateImageStorage`.
 *
 * Chave `template-headers/<domainId>/<AAAA-MM>/<uuid>.<ext>`: o `uuid` torna a URL
 * impossível de adivinhar, e o `domainId` permite apagar por cliente se preciso.
 * A expiração (30 dias) é a regra de ciclo de vida do bucket.
 */
export class R2TemplateImageStorage implements TemplateImageStorage {
  constructor(
    private readonly s3: S3Client,
    private readonly config: R2TemplateImageStorageConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async store(input: StoreTemplateImageInput): Promise<StoredTemplateImage> {
    const month = this.now().toISOString().slice(0, 7)
    const key = [
      'template-headers',
      input.scope.domainId,
      month,
      `${randomUUID()}.${EXTENSION[input.contentType]}`,
    ].join('/')

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
      throw new TemplateImageStorageUnavailableError(
        error instanceof Error ? error.message : String(error),
      )
    }

    return {
      url: `${this.config.publicBaseUrl.replace(/\/+$/, '')}/${key}`,
      key,
    }
  }
}
