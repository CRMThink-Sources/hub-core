import type { Response } from 'express'
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js'
import type {
  OAuthClientInformationFull,
  OAuthTokens,
  OAuthTokenRevocationRequest,
} from '@modelcontextprotocol/sdk/shared/auth.js'
import {
  InvalidGrantError,
  InvalidTokenError,
  ServerError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js'
import { prisma } from '@/config/prisma'
import { env } from '@/config/env'
import { mcpClientsStore } from '../infra/mcp-clients.store'
import { renderLoginPage } from '../presentation/login-page'
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  verifyAccessToken,
} from './mcp-token.service'

const DEFAULT_SCOPE = 'mcp'

// Emite o par (access JWT + refresh opaco) para um usuário/domínio já resolvidos.
// Ponto único de emissão — code e refresh convergem aqui.
async function issueTokens(input: {
  userId: string
  clientId: string
  domainId: string
  domainName: string
  isAdmin: boolean
  scopes: string[]
  resource?: string
}): Promise<OAuthTokens> {
  const scope = input.scopes.length ? input.scopes.join(' ') : DEFAULT_SCOPE
  const { token, expiresInSeconds } = signAccessToken({
    sub: input.userId,
    domain: input.domainName,
    isAdmin: input.isAdmin,
    client_id: input.clientId,
    scope,
  })

  const refreshToken = generateRefreshToken()
  const expiresAt = new Date(
    Date.now() + env.mcpOauth.refreshTokenTtlSeconds * 1000,
  )
  await prisma.mcpRefreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: input.userId,
      clientId: input.clientId,
      domainId: input.domainId,
      scopes: input.scopes.length ? input.scopes : [DEFAULT_SCOPE],
      resource: input.resource ?? null,
      expiresAt,
    },
  })

  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: expiresInSeconds,
    refresh_token: refreshToken,
    scope,
  }
}

export const mcpOAuthProvider: OAuthServerProvider = {
  get clientsStore() {
    return mcpClientsStore
  },

  // Não emite code aqui: renderiza a tela de login. O code nasce no POST
  // /mcp-oauth/login, já amarrado ao domínio digitado (ver mcp-oauth.router.ts).
  authorize(client, params, res: Response) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(
      renderLoginPage({
        params: {
          clientId: client.client_id,
          redirectUri: params.redirectUri,
          state: params.state,
          codeChallenge: params.codeChallenge,
          scope: params.scopes?.join(' ') ?? '',
          resource: params.resource?.href,
        },
      }),
    )
    return Promise.resolve()
  },

  async challengeForAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const code = await prisma.mcpAuthCode.findUnique({
      where: { code: authorizationCode },
    })
    if (
      !code ||
      code.clientId !== client.client_id ||
      code.consumedAt !== null ||
      code.expiresAt < new Date()
    ) {
      throw new InvalidGrantError('Authorization code inválido ou expirado')
    }
    return code.codeChallenge
  },

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<OAuthTokens> {
    // Consumo atômico: só a primeira troca marca consumedAt (guarda contra replay).
    const consumed = await prisma.mcpAuthCode.updateMany({
      where: {
        code: authorizationCode,
        clientId: client.client_id,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { consumedAt: new Date() },
    })
    if (consumed.count === 0) {
      throw new InvalidGrantError('Authorization code inválido ou expirado')
    }

    const code = await prisma.mcpAuthCode.findUnique({
      where: { code: authorizationCode },
      include: { user: { include: { domain: true } } },
    })
    if (!code) throw new ServerError('Authorization code sumiu após consumo')

    // O domínio do access token é o ESCOLHIDO no login (code.domainId), não
    // necessariamente o do cadastro — admin pode ter escolhido outro.
    const domain =
      code.domainId === code.user.domainId
        ? code.user.domain
        : await prisma.domain.findUnique({ where: { id: code.domainId } })
    if (!domain) throw new ServerError('Domínio do code não encontrado')

    return issueTokens({
      userId: code.userId,
      clientId: code.clientId,
      domainId: code.domainId,
      domainName: domain.name,
      isAdmin: code.user.isAdmin,
      scopes: code.scopes as string[],
      resource: code.resource ?? undefined,
    })
  },

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
  ): Promise<OAuthTokens> {
    const tokenHash = hashRefreshToken(refreshToken)
    const existing = await prisma.mcpRefreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    })

    if (!existing || existing.clientId !== client.client_id) {
      throw new InvalidGrantError('Refresh token inválido')
    }
    // Reuso de token já rotacionado/revogado = sinal de vazamento: revoga a cadeia.
    if (existing.revokedAt !== null) {
      await revokeChain(existing.id)
      throw new InvalidGrantError('Refresh token reutilizado — sessão revogada')
    }
    if (existing.expiresAt < new Date()) {
      throw new InvalidGrantError('Refresh token expirado')
    }

    const domain = await prisma.domain.findUnique({
      where: { id: existing.domainId },
    })
    if (!domain) throw new ServerError('Domínio do refresh não encontrado')

    const tokens = await issueTokens({
      userId: existing.userId,
      clientId: existing.clientId,
      domainId: existing.domainId,
      domainName: domain.name,
      isAdmin: existing.user.isAdmin,
      scopes: existing.scopes as string[],
      resource: existing.resource ?? undefined,
    })

    // Rotação de uso único: revoga o antigo e aponta pro novo.
    const rotated = await prisma.mcpRefreshToken.findUnique({
      where: { tokenHash: hashRefreshToken(tokens.refresh_token as string) },
    })
    await prisma.mcpRefreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date(), rotatedToId: rotated?.id ?? null },
    })

    return tokens
  },

  verifyAccessToken(token: string) {
    try {
      return Promise.resolve(verifyAccessToken(token))
    } catch {
      return Promise.reject(
        new InvalidTokenError('Access token inválido ou expirado'),
      )
    }
  },

  async revokeToken(
    _client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    // Access token é JWT stateless — não há o que revogar no banco. Só o refresh.
    await prisma.mcpRefreshToken.updateMany({
      where: { tokenHash: hashRefreshToken(request.token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  },
}

// Revoga toda a cadeia de rotação a partir de um token (defesa contra vazamento).
async function revokeChain(startId: string): Promise<void> {
  let current: string | null = startId
  const now = new Date()
  const seen = new Set<string>()
  while (current && !seen.has(current)) {
    seen.add(current)
    const row: { rotatedToId: string | null } =
      await prisma.mcpRefreshToken.update({
        where: { id: current },
        data: { revokedAt: now },
        select: { rotatedToId: true },
      })
    current = row.rotatedToId
  }
}
