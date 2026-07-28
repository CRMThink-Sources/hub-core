import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { INSTRUCTIONS } from './instructions.js'
import { registerKbTools } from './tools/kb-tools.js'
import { registerLogTools } from './tools/log-tools.js'

export function buildServer(): McpServer {
  const server = new McpServer(
    { name: 'crmthink-suporte', version: '0.1.0' },
    { instructions: INSTRUCTIONS },
  )
  registerKbTools(server) // Camada 2B — KB (runbooks + contexto de app)
  registerLogTools(server) // Camada 2A — logs (traceKey / erros)
  return server
}
