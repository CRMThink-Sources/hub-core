import type { InsightsDataSource } from '@/modules/thinkzap/domain/ports/insights-data-source.port'

/**
 * Escolhe de onde o Insights lê as conversas do app. Fica num ponto só para
 * trocar a fonte (por chave configurada) sem mexer nos casos de uso do painel.
 */
export type InsightsSourceResolver = (
  appId: string,
) => Promise<InsightsDataSource>

/**
 * Chamado quando a leitura pela fonte do app falha. Devolve `true` quando o
 * erro fez o resolver trocar de fonte (ex.: chave Vibecode revogada → REST
 * clássico) e vale refazer a leitura; `false` deixa o erro subir. Assim o
 * caso de uso não precisa conhecer os erros de cada adaptador.
 */
export type InsightsSourceFailureHandler = (
  appId: string,
  error: unknown,
) => boolean

/**
 * Roda o cálculo com a fonte do app e, se a fonte for recusada, uma única
 * vez de novo com a fonte que o resolver passar a devolver. O cálculo inteiro
 * é refeito (e não só a chamada que falhou) porque o `mode` da fonte muda as
 * regras e precisa sair na resposta como o modo de fato usado.
 */
export async function runWithSourceFallback<T>(
  appId: string,
  deps: {
    resolveSource: InsightsSourceResolver
    onSourceFailure?: InsightsSourceFailureHandler
  },
  run: (source: InsightsDataSource) => Promise<T>,
): Promise<T> {
  try {
    return await run(await deps.resolveSource(appId))
  } catch (error) {
    if (!deps.onSourceFailure?.(appId, error)) throw error
    return run(await deps.resolveSource(appId))
  }
}
