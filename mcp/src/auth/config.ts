// Config de auth do MCP (resource server). O MCP NÃO emite token — só valida o
// JWT que o api (Authorization Server) assinou. Segredo compartilhado via env.

const JWT_SECRET = process.env.MCP_JWT_SECRET ?? ''
// Issuer = URL pública do api (AS). Entra no PRM e na validação do `iss`.
const ISSUER_URL = process.env.MCP_OAUTH_ISSUER_URL ?? ''
// URL pública deste MCP. `${PUBLIC_URL}/mcp` = resource (RFC 8707) = `aud` do token.
const PUBLIC_URL = (process.env.MCP_PUBLIC_URL ?? '').replace(/\/$/, '')

export function authConfigured(): boolean {
  return Boolean(JWT_SECRET && ISSUER_URL && PUBLIC_URL)
}

export function jwtSecret(): string {
  return JWT_SECRET
}

export function issuerUrl(): string {
  return ISSUER_URL
}

export function resourceUrl(): string {
  return `${PUBLIC_URL}/mcp`
}

export function protectedResourceMetadataUrl(): string {
  return `${PUBLIC_URL}/.well-known/oauth-protected-resource`
}
