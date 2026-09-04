import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')

/**
 * Escopos sem os quais o bot do fluxo não funciona.
 *
 * `imbot` registra e atualiza o bot; `imopenlines` é o que permite falar, transferir e
 * encerrar a sessão do canal aberto. Faltar qualquer um dos dois inutiliza o fluxo, e
 * `imbot` ausente é a causa mais comum de falha na publicação.
 */
export const BOT_REQUIRED_SCOPES = ['imbot', 'imopenlines'] as const

/**
 * Escopos que faltam no app do portal, ou `[]`.
 *
 * `scope` **sem** `full: true` de propósito: sem o parâmetro o Bitrix devolve os escopos
 * concedidos a este app, que é a pergunta aqui. Com `full` ele devolveria todos os
 * escopos que o portal conhece, e a checagem passaria sempre.
 *
 * Nunca lança. É diagnóstico: se a própria consulta falhar, quem chama segue e tenta
 * registrar — o erro do registro é mais informativo que um erro sobre a checagem.
 */
export async function missingBotScopes(
  client: BitrixClient,
): Promise<readonly string[]> {
  let concedidos: string[]

  try {
    const response = await client.callMethod<unknown>('scope', {})
    concedidos = normalizeScopes(response)
  } catch (err) {
    log.warn({ err }, 'Não foi possível consultar os escopos do app')
    return []
  }

  // Resposta ilegível não vira "falta tudo": bloquearia a publicação de quem está com o
  // portal correto por causa de uma mudança de formato do Bitrix.
  if (!concedidos.length) {
    log.warn('Consulta de escopos devolveu lista vazia — checagem ignorada')
    return []
  }

  return BOT_REQUIRED_SCOPES.filter(scope => !concedidos.includes(scope))
}

/** Aceita `['imbot']` e `{ result: ['imbot'] }`: o wrapper do client já desembrulha às vezes. */
function normalizeScopes(response: unknown): string[] {
  const cru = Array.isArray(response)
    ? response
    : ((response as { result?: unknown } | null)?.result ?? null)

  if (!Array.isArray(cru)) return []

  return cru
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim().toLowerCase())
}
