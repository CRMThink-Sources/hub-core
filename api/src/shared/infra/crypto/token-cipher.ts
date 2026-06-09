import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { env } from '@/config/env'

/**
 * Cifra simétrica para tokens sensíveis (refresh_token/access_token) at-rest.
 *
 * AES-256-GCM (autenticado: detecta adulteração). Formato de saída:
 *   `v1:<base64(iv | authTag | ciphertext)>`
 *
 * O prefixo de versão permite backward-compat: valores sem prefixo são tratados
 * como legado em plaintext e devolvidos as-is na leitura. Reconexão/refresh
 * regrava cifrado, migrando a row de forma transparente.
 */

const VERSION_PREFIX = 'v1:'
const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12 // recomendado para GCM
const AUTH_TAG_BYTES = 16
const KEY_BYTES = 32 // AES-256

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const raw = env.tokenEncryptionKey
  if (!raw) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY não configurada — necessária para cifrar tokens at-rest',
    )
  }
  const key = Buffer.from(raw, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY inválida: esperado ${KEY_BYTES} bytes (base64), recebido ${key.length}`,
    )
  }
  cachedKey = key
  return key
}

/** Cifra um valor. Retorna sempre com prefixo de versão. */
export function encryptToken(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  const packed = Buffer.concat([iv, authTag, ciphertext])
  return VERSION_PREFIX + packed.toString('base64')
}

/** Decifra um valor. Sem prefixo de versão = legado plaintext, devolve as-is. */
export function decryptToken(value: string): string {
  if (!value.startsWith(VERSION_PREFIX)) {
    return value
  }
  const packed = Buffer.from(value.slice(VERSION_PREFIX.length), 'base64')
  const iv = packed.subarray(0, IV_BYTES)
  const authTag = packed.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES)
  const ciphertext = packed.subarray(IV_BYTES + AUTH_TAG_BYTES)
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8')
}

/** Cifra opcional (passa null/undefined adiante). */
export function encryptTokenNullable(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null
  return encryptToken(value)
}

/** Decifra opcional (passa null/undefined adiante). */
export function decryptTokenNullable(
  value: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null
  return decryptToken(value)
}
