import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import { lokiConfigured, queryByTrace, queryErrors } from '../loki.js'
import { fmtTimeline, fmtErrorAggregation } from '../format.js'
import { text, errMsg } from '../respond.js'

// Guarda comum das tools de log: Loki configurado + captura de falha de rede.
async function withLoki(
  run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  if (!lokiConfigured())
    return text('Busca de logs indisponível (Loki não configurado).')
  try {
    return await run()
  } catch (err) {
    return text(
      `Falha ao consultar os logs: ${errMsg(err)}. Tente de novo ou escale pro dev.`,
    )
  }
}

// Tools de log (Camada 2A): normalizam o Loki. LogQL nunca é exposto ao suporte.
export function registerLogTools(server: McpServer): void {
  server.registerTool(
    'query_by_trace',
    {
      title: 'Timeline por traceKey',
      description:
        'Busca a timeline de um traceKey nos logs (HTTP + worker) e destaca os ' +
        'errorCodes encontrados. Caminho preferido: o suporte copia o traceKey da ' +
        'tela de Logs. Não exige domínio.',
      inputSchema: {
        traceKey: z.string().describe('traceKey copiado da tela de Logs'),
        sinceHours: z
          .number()
          .optional()
          .describe('Janela em horas (padrão 72)'),
      },
    },
    async ({ traceKey, sinceHours }) =>
      withLoki(async () => {
        const key = traceKey.trim()
        const entries = await queryByTrace(key, sinceHours)
        if (entries.length === 0) {
          return text(
            `Nenhum log para o traceKey "${key}" na janela. Confira o traceKey ou aumente sinceHours.`,
          )
        }
        return text(fmtTimeline(key, entries))
      }),
  )

  server.registerTool(
    'query_errors',
    {
      title: 'Erros classificados no período',
      description:
        'Lista os erros classificados (com errorCode) agregados por code. Filtra ' +
        'por app, domínio e/ou errorCode. Use quando não há traceKey — devolve ' +
        'traceKeys de exemplo pra investigar.',
      inputSchema: {
        errorCode: z.string().optional().describe('Filtra por um errorCode'),
        app: z.string().optional().describe('Filtra por app, ex: importsheet'),
        domain: z
          .string()
          .optional()
          .describe('Domínio real do parceiro, ex: cliente.bitrix24.com.br'),
        sinceHours: z
          .number()
          .optional()
          .describe('Janela em horas (padrão 24)'),
      },
    },
    async ({ errorCode, app, domain, sinceHours }) =>
      withLoki(async () => {
        const entries = await queryErrors({
          errorCode,
          app,
          domain,
          sinceHours,
        })
        if (entries.length === 0) {
          return text('Nenhum erro classificado no período/filtro.')
        }
        const scope = [
          app ? `app=${app}` : '',
          domain ? `domínio=${domain}` : '',
          errorCode ? `errorCode=${errorCode}` : '',
        ]
          .filter(Boolean)
          .join(', ')
        return text(fmtErrorAggregation(entries, scope))
      }),
  )
}
