import { randomUUID } from 'node:crypto'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3'
import {
  LoadedOutboundMedia,
  OutboundMediaNotFoundError,
  OutboundMediaStorage,
  OutboundMediaStorageUnavailableError,
  StoreOutboundMediaInput,
} from '@/modules/thinkzap/domain/ports/outbound-media-storage.port'

/**
 * Adapter Cloudflare R2 de `OutboundMediaStorage`, num **bucket próprio, sem domínio
 * público**: no R2 o acesso público vale para o bucket inteiro, então um prefixo no
 * bucket das imagens de cabeçalho deixaria o anexo do cliente legível por URL.
 *
 * Chave `outbound-media/<domainId>/<AAAA-MM>/<uuid>`: o `domainId` permite apagar
 * por cliente. Expiração (30 dias) é a regra de ciclo de vida do bucket.
 */
export class R2OutboundMediaStorage implements OutboundMediaStorage {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async store(input: StoreOutboundMediaInput): Promise<{ key: string }> {
    const key = [
      'outbound-media',
      input.scope.domainId,
      this.now().toISOString().slice(0, 7),
      randomUUID(),
    ].join('/')

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: input.data,
          ContentType: input.contentType,
          ContentLength: input.data.length,
        }),
      )
    } catch (error) {
      throw new OutboundMediaStorageUnavailableError(
        error instanceof Error ? error.message : String(error),
      )
    }

    return { key }
  }

  async load(key: string): Promise<LoadedOutboundMedia> {
    try {
      const result = await this.s3.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      )
      const bytes = await result.Body?.transformToByteArray()
      if (!bytes) throw new OutboundMediaNotFoundError(key)
      return {
        data: Buffer.from(bytes),
        contentType: result.ContentType ?? 'application/octet-stream',
      }
    } catch (error) {
      if (error instanceof OutboundMediaNotFoundError) throw error
      if ((error as { name?: string })?.name === 'NoSuchKey') {
        throw new OutboundMediaNotFoundError(key)
      }
      throw new OutboundMediaStorageUnavailableError(
        error instanceof Error ? error.message : String(error),
      )
    }
  }

  async remove(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    )
  }
}
