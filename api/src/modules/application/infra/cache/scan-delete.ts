import type IORedis from 'ioredis'

/**
 * Quantas chaves o `SCAN` pede por iteração. Não é o número de chaves devolvidas —
 * é o esforço por passada. 500 é grande o bastante para não fazer dezenas de
 * round-trips no keyspace compartilhado com o BullMQ, e pequeno o bastante para
 * não segurar o Redis numa iteração só.
 */
const SCAN_COUNT = 500

/** Teto do `DEL` por chamada, para não montar um comando com milhares de argumentos. */
const DELETE_BATCH = 200

/**
 * Apaga todas as chaves que casam com os padrões, descobrindo-as por `SCAN`
 * cursorizado.
 *
 * `KEYS` está fora de questão: este Redis é o mesmo das filas BullMQ, e `KEYS`
 * bloqueia o servidor enquanto varre o keyspace inteiro. `SCAN` percorre o mesmo
 * keyspace, mas em fatias, sem travar quem está publicando job.
 *
 * O `SCAN` pode devolver a mesma chave mais de uma vez (é a garantia fraca do
 * cursor); o `Set` deduplica antes do `DEL`, que é idempotente de qualquer forma.
 *
 * @returns Quantas chaves foram apagadas — vai para o log, porque um número
 * inesperado aqui é o primeiro sinal de padrão largo demais.
 */
export async function scanDelete(
  redis: IORedis,
  patterns: string[],
): Promise<number> {
  const keys = new Set<string>()

  for (const pattern of patterns) {
    let cursor = '0'

    do {
      const [next, found] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        SCAN_COUNT,
      )

      for (const key of found) keys.add(key)
      cursor = next
    } while (cursor !== '0')
  }

  if (keys.size === 0) return 0

  const all = [...keys]
  for (let i = 0; i < all.length; i += DELETE_BATCH) {
    await redis.del(...all.slice(i, i + DELETE_BATCH))
  }

  return all.length
}
