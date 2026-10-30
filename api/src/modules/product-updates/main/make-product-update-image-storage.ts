import { S3Client } from '@aws-sdk/client-s3'
import { env } from '@/config/env'
import type { R2Env } from '@/modules/thinkzap/main/make-template-image-storage'
import {
  ProductUpdateImageStorage,
  productUpdateImageUrl,
} from '../domain/ports/product-update-image-storage.port'
import type { ProductUpdateImageUrlResolver } from '../application/product-update-view'
import { R2ProductUpdateImageStorage } from '../infra/adapters/r2-product-update-image-storage.adapter'

let cached:
  | { signature: string; storage: ProductUpdateImageStorage }
  | undefined

const R2_FIELDS = [
  'accountId',
  'accessKeyId',
  'secretAccessKey',
  'bucket',
  'publicBaseUrl',
] as const satisfies readonly (keyof R2Env)[]

/**
 * Armazenamento da imagem das novidades, ou `null` sem as cinco variáveis `R2_*` —
 * o upload responde `503` e o resto das novidades funciona.
 *
 * Mesmo bucket e credenciais da imagem de template (`env.r2`); só os cinco campos
 * contam (`outboundMediaBucket` é de outro uso). O `S3Client` é reaproveitado entre
 * requisições (mantém conexões abertas).
 */
export function makeProductUpdateImageStorage(
  config: R2Env = env.r2,
): ProductUpdateImageStorage | null {
  const values = R2_FIELDS.map(field => config[field])
  if (!values.every(value => value.trim())) return null

  const signature = values.join('\n')
  if (cached?.signature === signature) return cached.storage

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  const storage = new R2ProductUpdateImageStorage(s3, {
    bucket: config.bucket,
    publicBaseUrl: config.publicBaseUrl,
  })
  cached = { signature, storage }
  return storage
}

/** URL pública na leitura (backoffice e cliente): `R2_PUBLIC_BASE_URL` + chave. */
export function makeProductUpdateImageUrlResolver(
  publicBaseUrl: string = env.r2.publicBaseUrl,
): ProductUpdateImageUrlResolver {
  return key => productUpdateImageUrl(publicBaseUrl, key)
}
