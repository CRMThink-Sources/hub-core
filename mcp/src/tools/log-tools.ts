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

// Sessão autenticada (claims do JWT propagados pelo bearer). `domain` = filtro de
// tenant do não-admin; admin vê todos. Nunca vem do caller.
type Session = { domain?: string; isAdmin: boolean }

function session(extra: {
  authInfo?: { extra?: Record<string, unknown> }
}): Session {
  const raw = extra.authInfo?.extra ?? {}
  const domain = raw.domain
  return {
    domain:
      typeof domain === 'string' && domain.length > 0 ? domain : undefined,
    isAdmin: raw.isAdmin === true,
  }
}

// Domínio efetivo do filtro: admin não filtra (undefined); não-admin exige domínio.
// Retorna { error } quando falta domínio numa sessão não-admin (defense-in-depth).
function scopeDomain(s: Session): { domain?: string; error?: string } {
  if (s.isAdmin) return { domain: undefined }
  if (!s.domain) return { error: 'Sessão sem domínio — refaça o login.' }
  return { domain: s.domain }
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
    async ({ traceKey, sinceHours }, extra) =>
      withLoki(async () => {
        const scope = scopeDomain(session(extra))
        if (scope.error) return text(scope.error)
        const key = traceKey.trim()
        const entries = await queryByTrace(key, scope.domain, sinceHours)
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
        'por app e/ou errorCode. O domínio é o da sessão autenticada (não se passa ' +
        'por parâmetro). Use quando não há traceKey — devolve traceKeys de exemplo.',
      inputSchema: {
        errorCode: z.string().optional().describe('Filtra por um errorCode'),
        app: z.string().optional().describe('Filtra por app, ex: importsheet'),
        sinceHours: z
          .number()
          .optional()
          .describe('Janela em horas (padrão 24)'),
      },
    },
    async ({ errorCode, app, sinceHours }, extra) =>
      withLoki(async () => {
        const scope = scopeDomain(session(extra))
        if (scope.error) return text(scope.error)
        const entries = await queryErrors({
          errorCode,
          app,
          domain: scope.domain,
          sinceHours,
        })
        if (entries.length === 0) {
          return text('Nenhum erro classificado no período/filtro.')
        }
        const scopeLabel = [
          scope.domain ? `domínio=${scope.domain}` : 'domínio=todos (admin)',
          app ? `app=${app}` : '',
          errorCode ? `errorCode=${errorCode}` : '',
        ]
          .filter(Boolean)
          .join(', ')
        return text(fmtErrorAggregation(entries, scopeLabel))
      }),
  )
}
