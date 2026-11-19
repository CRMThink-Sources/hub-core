import { createHash } from 'node:crypto'

export type InsightsKind = 'dashboard' | 'today'

/**
 * Consulta normalizada: sem valores ausentes ou vazios e com as chaves em ordem,
 * para que a ordem dos parâmetros ou um filtro em branco não gerem entradas
 * distintas (nem jobs duplicados) para a mesma pergunta.
 */
export function normalizeInsightsQuery(q: Record<string, unknown>): string {
  return JSON.stringify(
    Object.entries(q)
      .filter(([, v]) => v !== undefined && v !== '')
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  )
}

/**
 * Identificador curto e estável da consulta. Serve de trecho de chave e de
 * `jobId`: este não aceita `:`, e a consulta crua tem aspas, vírgulas e datas.
 */
export function insightsQueryHash(
  kind: InsightsKind,
  q: Record<string, unknown>,
): string {
  return createHash('sha1')
    .update(`${kind}|${normalizeInsightsQuery(q)}`)
    .digest('hex')
    .slice(0, 16)
}

/**
 * Chaves do Insights no Redis. As chaves de aplicação **não têm prefixo de
 * ambiente** (só o BullMQ tem, via `QUEUE_PREFIX`), então o ambiente entra aqui:
 * staging e produção no mesmo Redis não leem nem apagam as chaves um do outro.
 */
export function makeInsightsKeys(env: string) {
  const app = (appId: string) => `insights:${env}:${appId}`
  return {
    appPrefix: app,
    result: (appId: string, kind: InsightsKind, hash: string) =>
      `${app(appId)}:result:${kind}:${hash}`,
    state: (appId: string, kind: InsightsKind, hash: string) =>
      `${app(appId)}:state:${kind}:${hash}`,
    day: (appId: string, day: string) => `${app(appId)}:sd:${day}`,
    generation: (appId: string) => `${app(appId)}:gen`,
    lastOpen: (appId: string) => `${app(appId)}:lastOpen`,
    keyProblem: (appId: string) => `${app(appId)}:keyProblem`,
    /** Padrões de `scan` do que a invalidação apaga (nunca `gen`, `lastOpen` nem `keyProblem`). */
    invalidationPatterns: (appId: string) => [
      `${app(appId)}:result:*`,
      `${app(appId)}:state:*`,
      `${app(appId)}:sd:*`,
    ],
    lastOpenPattern: () => `insights:${env}:*:lastOpen`,
    /** Extrai o `appId` de uma chave `lastOpen`. */
    appIdFromLastOpen: (key: string) => {
      const head = `insights:${env}:`
      const tail = ':lastOpen'
      return key.startsWith(head) && key.endsWith(tail)
        ? key.slice(head.length, key.length - tail.length)
        : null
    },
  }
}

export type InsightsKeys = ReturnType<typeof makeInsightsKeys>
