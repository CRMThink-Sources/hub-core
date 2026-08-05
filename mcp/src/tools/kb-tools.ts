import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getRunbook, listCatalog, describeApp, knownApps } from '../kb.js'
import { text } from '../respond.js'

// Tools de conhecimento (Camada 2B): servem o KB do repo (runbooks + contexto de app).
export function registerKbTools(server: McpServer): void {
  server.registerTool(
    'get_runbook',
    {
      title: 'Buscar guia de resolução',
      description:
        'Retorna o runbook completo de um errorCode: o que significa, causa ' +
        'provável, como verificar, como resolver e quando escalar.',
      inputSchema: {
        errorCode: z
          .string()
          .describe(
            'errorCode estável, ex: clicksign.webhook.signature_invalid',
          ),
      },
    },
    ({ errorCode }) => {
      const rb = getRunbook(errorCode)
      if (!rb) {
        return text(
          `Sem runbook para "${errorCode}". Confira o code em list_error_catalog ou escale pro dev.`,
        )
      }
      // Stub = catalogado mas sem passo de suporte (dev/observabilidade). O CORPO
      // desses runbooks é escrito pro dev e pode conter detalhe interno (arquitetura,
      // nomes de método, SQL) — NUNCA servir o body. Só o summary (linguagem de
      // suporte, curado) + o pacote de escalonamento. Anti-vazamento estrutural.
      if (rb.stub) {
        const cause = rb.summary
          ? `${rb.summary}\n\n`
          : `Erro interno catalogado como \`${rb.errorCode}\`.\n\n`
        return text(
          `${cause}## Como agir\n` +
            `Este erro precisa da equipe de desenvolvimento — não há passo que ` +
            `você resolva direto. Monte o pacote de escalonamento: identificador do ` +
            `evento (traceKey), código de erro \`${rb.errorCode}\`, domínio do ` +
            `parceiro, horário e o que já tentou.`,
        )
      }
      return text(rb.body)
    },
  )

  server.registerTool(
    'list_error_catalog',
    {
      title: 'Listar catálogo de erros',
      description:
        'Lista os errorCodes conhecidos (com resumo de 1 linha). Filtra por app ' +
        'quando informado.',
      inputSchema: {
        app: z
          .string()
          .optional()
          .describe('Filtra por app, ex: clicksign, thinkzap, importsheet'),
      },
    },
    ({ app }) => {
      const items = listCatalog(app)
      if (items.length === 0) {
        return text(
          app
            ? `Nenhum errorCode catalogado para o app "${app}".`
            : 'Catálogo vazio.',
        )
      }
      // Agrupa app → area pra leitura, em vez de lista chapada.
      const byApp = new Map<string, Map<string, typeof items>>()
      for (const it of items) {
        const areas = byApp.get(it.app) ?? new Map<string, typeof items>()
        areas.set(it.area, [...(areas.get(it.area) ?? []), it])
        byApp.set(it.app, areas)
      }
      const blocks: string[] = []
      for (const [appName, areas] of byApp) {
        blocks.push(`## ${appName}`)
        for (const [area, list] of areas) {
          blocks.push(`### ${area}`)
          for (const it of list) {
            const tag = it.stub ? `${it.category}, escalar` : it.category
            blocks.push(`- ${it.errorCode} [${tag}] — ${it.summary}`)
          }
        }
      }
      return text(blocks.join('\n'))
    },
  )

  server.registerTool(
    'describe_app',
    {
      title: 'Contexto do app',
      description:
        'Scaffolding INTERNO de triagem: os modos de falha de um app e como agir ' +
        'sobre eles. Uso exclusivo pra classificar o erro e guiar a resolução. NÃO ' +
        'relatar/parafrasear o retorno ao solicitante nem explicar o produto.',
      inputSchema: { app: z.string().describe('Nome do app, ex: clicksign') },
    },
    ({ app }) => {
      const doc = describeApp(app)
      if (!doc) {
        const apps = knownApps()
        return text(
          `Sem descrição para "${app}".` +
            (apps.length ? ` Apps conhecidos: ${apps.join(', ')}.` : ''),
        )
      }
      return text(doc)
    },
  )
}
