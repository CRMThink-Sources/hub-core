import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'
import {
  logsConfigured,
  queryByTrace,
  queryErrors,
  queryBySonaxCall,
  queryBySonaxPhone,
} from '../log/index.js'
import {
  fmtTimeline,
  fmtErrorAggregation,
  fmtCallTimeline,
  fmtPhoneTimeline,
} from '../format.js'
import { text, errMsg } from '../respond.js'

// Guarda comum das tools de log: ao menos uma fonte configurada + captura de falha.
async function withLogs(
  run: () => Promise<CallToolResult>,
): Promise<CallToolResult> {
  if (!logsConfigured())
    return text('Busca de logs indisponível (nenhuma fonte configurada).')
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

// Tools de log (Camada 2A): normalizam as fontes (Loki/BetterStack) via router.
// Query crua (LogQL/SQL) nunca é exposta ao suporte.
export function registerLogTools(server: McpServer): void {
  server.registerTool(
    'query_by_trace',
    {
      title: 'Linha do tempo do evento (traceKey)',
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
      withLogs(async () => {
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
      withLogs(async () => {
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

  // Específico do Sonax: uma chamada gera eventos separados (início/andamento/
  // encerramento/áudio), cada um com traceKey próprio, mas o mesmo id de chamada.
  // Junta as fases pelo id — o que aconteceu com a chamada inteira.
  server.registerTool(
    'query_sonax_call',
    {
      title: 'Linha do tempo da chamada Sonax (id da chamada)',
      description:
        'Para o app sonax: junta os eventos de uma mesma chamada (início, ' +
        'andamento, encerramento e anexo de áudio) pelo id da chamada (id_chamada) ' +
        'e devolve a timeline com os errorCodes e os traceKeys de cada fase. Use ' +
        'quando o ticket traz o id da chamada em vez de um traceKey.',
      inputSchema: {
        callId: z
          .string()
          .describe('Id da chamada Sonax (id_chamada), só dígitos'),
        sinceHours: z
          .number()
          .optional()
          .describe('Janela em horas (padrão 72)'),
      },
    },
    async ({ callId, sinceHours }, extra) =>
      withLogs(async () => {
        const scope = scopeDomain(session(extra))
        if (scope.error) return text(scope.error)
        const id = callId.trim()
        const entries = await queryBySonaxCall(id, scope.domain, sinceHours)
        if (entries.length === 0) {
          return text(
            `Nenhum evento para a chamada "${id}" na janela. Confira o id da chamada ou aumente sinceHours.`,
          )
        }
        return text(fmtCallTimeline(id, entries))
      }),
  )

  // Específico do Sonax: busca eventos pelo telefone do cliente. Casa o sufixo local
  // do número (sem DDI/DDD) em qualquer campo — o mesmo telefone aparece com prefixos
  // e chaves variadas conforme a fase. Pode trazer várias chamadas do mesmo número.
  server.registerTool(
    'query_sonax_phone',
    {
      title: 'Eventos da chamada Sonax por telefone',
      description:
        'Para o app sonax: busca os eventos de chamada pelo número de telefone do ' +
        'cliente e devolve a timeline com os errorCodes e traceKeys. Pode retornar ' +
        'mais de uma chamada do mesmo número. Use quando o ticket traz o telefone ' +
        'em vez de um traceKey ou id de chamada.',
      inputSchema: {
        phone: z
          .string()
          .describe(
            'Telefone do cliente (com ou sem DDI/DDD, pontuação ignorada)',
          ),
        sinceHours: z
          .number()
          .optional()
          .describe('Janela em horas (padrão 72)'),
      },
    },
    async ({ phone, sinceHours }, extra) =>
      withLogs(async () => {
        const scope = scopeDomain(session(extra))
        if (scope.error) return text(scope.error)
        const p = phone.trim()
        const entries = await queryBySonaxPhone(p, scope.domain, sinceHours)
        if (entries.length === 0) {
          return text(
            `Nenhum evento para o telefone "${p}" na janela. Confira o número ou aumente sinceHours.`,
          )
        }
        return text(fmtPhoneTimeline(p, entries))
      }),
  )
}
