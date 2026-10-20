import { S3Client } from '@aws-sdk/client-s3'
import { env } from '@/config/env'
import type { TemplateImageStorage } from '@/modules/thinkzap/domain/ports/template-image-storage.port'
import { R2TemplateImageStorage } from '@/modules/thinkzap/infra/adapters/r2-template-image-storage.adapter'

export type R2Env = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
}

let cached: { config: R2Env; storage: TemplateImageStorage } | undefined

/**
 * Armazenamento da imagem do cabeçalho do widget, ou `null` quando o ambiente não
 * tem as cinco variáveis `R2_*` — é isso que desliga o upload no widget.
 *
 * O `S3Client` é reaproveitado entre requisições (mantém conexões abertas).
 */
export function makeTemplateImageStorage(
  config: R2Env = env.r2,
): TemplateImageStorage | null {
  if (!Object.values(config).every(value => value.trim())) return null
  if (cached?.config === config) return cached.storage

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  const storage = new R2TemplateImageStorage(s3, {
    bucket: config.bucket,
    publicBaseUrl: config.publicBaseUrl,
  })
  cached = { config, storage }
  return storage
}
