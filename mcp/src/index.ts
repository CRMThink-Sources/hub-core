import 'dotenv/config'
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { buildServer } from './server.js'
import {
  authConfigured,
  issuerUrl,
  resourceUrl,
  protectedResourceMetadataUrl,
} from './auth/config.js'
import { tokenVerifier } from './auth/verify.js'

const PORT = Number(process.env.PORT ?? 3200)
const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

if (!authConfigured()) {
  // Sem auth configurada o /mcp ficaria aberto (vazamento cross-tenant). Aborta o
  // boot — melhor não subir do que subir inseguro.
  console.error(
    'Auth não configurada (MCP_JWT_SECRET/MCP_OAUTH_ISSUER_URL/MCP_PUBLIC_URL). Abortando.',
  )
  process.exit(1)
}

// Protected Resource Metadata (RFC 9728): o claude.ai bate aqui após o 401 e
// descobre qual Authorization Server usar (o api).
app.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: resourceUrl(),
    authorization_servers: [issuerUrl()],
    scopes_supported: ['mcp'],
    resource_name: 'Suporte CRMThink',
  })
})

// Guarda do recurso: exige Bearer válido. 401 sem token traz WWW-Authenticate
// apontando pro PRM acima. O domínio do token vira contexto das tools.
const bearer = requireBearerAuth({
  verifier: tokenVerifier,
  resourceMetadataUrl: protectedResourceMetadataUrl(),
})

// Streamable HTTP em modo stateless: um server+transport por request. O authInfo
// validado pelo bearer é propagado pelo transport e lido pelas tools (extra.authInfo).
app.post('/mcp', bearer, async (req, res) => {
  const server = buildServer()
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  })
  res.on('close', () => {
    void transport.close()
    void server.close()
  })
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

app.listen(PORT, () => {
  console.log(`MCP suporte CRMThink ouvindo em :${PORT}/mcp`)
})
