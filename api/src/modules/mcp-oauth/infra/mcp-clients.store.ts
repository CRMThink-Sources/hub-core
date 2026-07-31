import { randomUUID } from 'node:crypto'
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js'
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js'
import { prisma } from '@/config/prisma'
import type { McpOauthClient } from '@/prisma/client'

function toClientInfo(row: McpOauthClient): OAuthClientInformationFull {
  return {
    client_id: row.clientId,
    client_name: row.clientName ?? undefined,
    redirect_uris: row.redirectUris as string[],
    grant_types: row.grantTypes as string[],
    response_types: row.responseTypes as string[],
    scope: row.scope ?? undefined,
    token_endpoint_auth_method: row.tokenEndpointAuthMethod,
    client_uri: row.clientUri ?? undefined,
    client_id_issued_at: Math.floor(row.createdAt.getTime() / 1000),
  }
}

// Store dos clients OAuth registrados via DCR (RFC 7591). O claude.ai se registra
// sozinho como public client (sem secret — PKCE é a prova). O SDK gera o client_id.
export const mcpClientsStore: OAuthRegisteredClientsStore = {
  async getClient(clientId) {
    const row = await prisma.mcpOauthClient.findUnique({ where: { clientId } })
    return row ? toClientInfo(row) : undefined
  },

  async registerClient(client) {
    const clientId = randomUUID()
    const row = await prisma.mcpOauthClient.create({
      data: {
        clientId,
        clientName: client.client_name ?? null,
        redirectUris: client.redirect_uris,
        grantTypes: client.grant_types ?? [
          'authorization_code',
          'refresh_token',
        ],
        responseTypes: client.response_types ?? ['code'],
        scope: client.scope ?? null,
        // Public client: sem secret. PKCE substitui a autenticação do client.
        tokenEndpointAuthMethod: client.token_endpoint_auth_method ?? 'none',
        clientUri: client.client_uri ?? null,
      },
    })
    return toClientInfo(row)
  },
}
