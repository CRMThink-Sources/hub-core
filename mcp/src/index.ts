import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { buildServer } from './server.js'

const PORT = Number(process.env.PORT ?? 3200)
const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

// Streamable HTTP em modo stateless: um server+transport por request. Sem sessão,
// sem estado compartilhado — o KB é read-only, então cada chamada é independente.
// É o transporte que o connector do claude.ai exige (não roda stdio local).
app.post('/mcp', async (req, res) => {
  const server = buildServer()
  const transport = new StreamableHTTPServerTransport({
    // Stateless: sem sessão. Cada request é independente (KB read-only), então
    // não precisa persistir handshake — casa com deploy serverless/proxy.
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
