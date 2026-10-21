import { S3Client } from '@aws-sdk/client-s3'
import { env } from '@/config/env'
import type { OutboundMediaStorage } from '@/modules/thinkzap/domain/ports/outbound-media-storage.port'
import { R2OutboundMediaStorage } from '@/modules/thinkzap/infra/adapters/r2-outbound-media-storage.adapter'

type R2MediaEnv = {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  outboundMediaBucket?: string
}

let cached: { config: R2MediaEnv; storage: OutboundMediaStorage } | undefined

/**
 * Guarda privada dos anexos na fila, ou `null` quando o ambiente não tem a conta R2
 * ou o bucket próprio — é isso que mantém o envio com anexo no caminho síncrono.
 */
export function makeOutboundMediaStorage(
  config: R2MediaEnv = env.r2,
): OutboundMediaStorage | null {
  const bucket = config.outboundMediaBucket?.trim()
  if (
    !bucket ||
    !config.accountId.trim() ||
    !config.accessKeyId.trim() ||
    !config.secretAccessKey.trim()
  ) {
    return null
  }
  if (cached?.config === config) return cached.storage

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  const storage = new R2OutboundMediaStorage(s3, bucket)
  cached = { config, storage }
  return storage
}
