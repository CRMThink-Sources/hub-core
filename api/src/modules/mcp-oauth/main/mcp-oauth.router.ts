import { randomUUID } from 'node:crypto'
import type { Request, RequestHandler, Response } from 'express'
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { prisma } from '@/config/prisma'
import { env } from '@/config/env'
import { verifyPassword } from '@/modules/portal/application/password.service'
import { mcpOAuthProvider } from '../application/mcp-oauth.provider'
import { mcpResourceUrl } from '../application/mcp-token.service'
import {
  renderLoginPage,
  type LoginHiddenParams,
} from '../presentation/login-page'

export function isMcpOAuthConfigured(): boolean {
  return Boolean(
    env.mcpOauth.jwtSecret &&
    env.mcpOauth.issuerUrl &&
    env.mcpOauth.mcpServerUrl,
  )
}

// Endpoints OAuth 2.1 (discovery + DCR + /authorize + /token + /revoke). Precisa
// ficar na RAIZ do app (o SDK monta /.well-known/* e /authorize etc. absolutos).
export function buildMcpOAuthRouter(): RequestHandler {
  const issuerUrl = new URL(env.mcpOauth.issuerUrl)
  return mcpAuthRouter({
    provider: mcpOAuthProvider,
    issuerUrl,
    baseUrl: issuerUrl,
    resourceServerUrl: new URL(mcpResourceUrl()),
    scopesSupported: ['mcp'],
    resourceName: 'Suporte CRMThink',
  })
}

function readParams(req: Request): LoginHiddenParams {
  const b = req.body as Record<string, string>
  return {
    clientId: b.client_id ?? '',
    redirectUri: b.redirect_uri ?? '',
    state: b.state || undefined,
    codeChallenge: b.code_challenge ?? '',
    scope: b.scope ?? '',
    resource: b.resource || undefined,
  }
}

function renderError(
  res: Response,
  params: LoginHiddenParams,
  email: string,
  error: string,
): void {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.status(401).send(renderLoginPage({ params, email, error }))
}

// Submit da tela de login: valida credencial + regra de domínio e, se ok, emite o
// authorization code amarrado ao domínio ESCOLHIDO. Redireciona pro callback do Claude.
export const mcpLoginHandler: RequestHandler = async (req, res) => {
  const params = readParams(req)
  const b = req.body as Record<string, string>
  const email = (b.email ?? '').trim().toLowerCase()
  const password = b.password ?? ''

  const client = await mcpOAuthProvider.clientsStore.getClient(params.clientId)
  if (!client) {
    res.status(400).send('client_id inválido')
    return
  }
  // Anti open-redirect: só redireciona pra redirect_uri registrada no client.
  if (!client.redirect_uris.includes(params.redirectUri)) {
    res.status(400).send('redirect_uri não registrada')
    return
  }

  const user = await prisma.mcpUser.findUnique({ where: { email } })
  const passwordOk =
    user?.isActive === true &&
    (await verifyPassword(password, user.passwordHash))
  if (!user || !passwordOk) {
    renderError(res, params, email, 'E-mail ou senha inválidos.')
    return
  }

  // Domínio da sessão = o do cadastro (não vem do login). Admin não é filtrado
  // (vê todos); o code guarda o domainId só como referência/log.
  const code = `${randomUUID()}${randomUUID()}`.replace(/-/g, '')
  await prisma.mcpAuthCode.create({
    data: {
      code,
      userId: user.id,
      clientId: params.clientId,
      domainId: user.domainId,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: 'S256',
      redirectUri: params.redirectUri,
      resource: params.resource ?? null,
      scopes: params.scope ? params.scope.split(' ') : ['mcp'],
      expiresAt: new Date(Date.now() + env.mcpOauth.authCodeTtlSeconds * 1000),
    },
  })

  const redirect = new URL(params.redirectUri)
  redirect.searchParams.set('code', code)
  if (params.state) redirect.searchParams.set('state', params.state)
  res.redirect(302, redirect.href)
}
