import { createHash, randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { env } from '@/config/env'

/**
 * Access token do MCP: JWT HS256 com segredo DEDICADO (env.mcpOauth.jwtSecret).
 * Nunca reusar JWT_SECRET — o token do portal é assinado sem `expiresIn`, então
 * um token de portal eterno passaria a valer no /mcp.
 *
 * O `mcp/` valida esse mesmo JWT localmente, sem tocar no banco. Só o refresh
 * (opaco, guardado como hash) bate aqui.
 */

export type McpTokenClaims = {
  /** id do McpUser */
  sub: string
  /** domínio ESCOLHIDO no login — vira o filtro obrigatório das tools de log */
  domain: string
  isAdmin: boolean
  client_id: string
  scope: string
}

const ALGORITHM = 'HS256' as const

function secret(): string {
  const value = env.mcpOauth.jwtSecret
  if (!value) throw new Error('MCP_JWT_SECRET não configurado')
  return value
}

/** Resource (RFC 8707) que o token é válido para: o endpoint do MCP. */
export function mcpResourceUrl(): string {
  return `${env.mcpOauth.mcpServerUrl.replace(/\/$/, '')}/mcp`
}

export type SignedAccessToken = {
  token: string
  expiresInSeconds: number
}

export function signAccessToken(claims: McpTokenClaims): SignedAccessToken {
  const expiresInSeconds = env.mcpOauth.accessTokenTtlSeconds
  const token = jwt.sign(claims, secret(), {
    algorithm: ALGORITHM,
    expiresIn: expiresInSeconds,
    issuer: env.mcpOauth.issuerUrl,
    audience: mcpResourceUrl(),
    jwtid: randomUUID(),
  })
  return { token, expiresInSeconds }
}

/**
 * Valida assinatura + `iss` + `aud` + `exp`. Sem hit no banco.
 * Lança se o token for inválido — quem chama traduz pro erro OAuth.
 */
export function verifyAccessToken(token: string): AuthInfo {
  const payload = jwt.verify(token, secret(), {
    algorithms: [ALGORITHM],
    issuer: env.mcpOauth.issuerUrl,
    audience: mcpResourceUrl(),
  }) as jwt.JwtPayload & McpTokenClaims

  return {
    token,
    clientId: payload.client_id,
    scopes: payload.scope ? payload.scope.split(' ') : [],
    expiresAt: payload.exp,
    resource: new URL(mcpResourceUrl()),
    extra: {
      userId: payload.sub,
      domain: payload.domain,
      isAdmin: payload.isAdmin,
    },
  }
}

/**
 * Refresh token: opaco (não é JWT — não carrega claim nenhum). Só o hash vai pro
 * banco, então vazamento da tabela não permite forjar sessão.
 */
export function generateRefreshToken(): string {
  return `${randomUUID()}${randomUUID()}`.replace(/-/g, '')
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
