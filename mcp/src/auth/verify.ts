import jwt from 'jsonwebtoken'
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { jwtSecret, issuerUrl, resourceUrl } from './config.js'

type McpClaims = jwt.JwtPayload & {
  sub: string
  domain: string
  isAdmin: boolean
  client_id: string
  scope?: string
}

// jwt.verify é síncrono; a interface do SDK pede Promise, então envolvemos.
function decode(token: string): AuthInfo {
  const payload = jwt.verify(token, jwtSecret(), {
    algorithms: ['HS256'],
    issuer: issuerUrl(),
    audience: resourceUrl(),
  }) as McpClaims

  return {
    token,
    clientId: payload.client_id,
    scopes: payload.scope ? payload.scope.split(' ') : [],
    expiresAt: payload.exp,
    resource: new URL(resourceUrl()),
    extra: {
      userId: payload.sub,
      domain: payload.domain,
      isAdmin: payload.isAdmin,
    },
  }
}

// Valida o JWT emitido pelo api: assinatura HS256 + iss + aud. Sem banco. O claim
// `domain` vira o filtro obrigatório das tools (isolamento por tenant).
export const tokenVerifier: OAuthTokenVerifier = {
  verifyAccessToken(token: string): Promise<AuthInfo> {
    return Promise.resolve(decode(token))
  },
}
