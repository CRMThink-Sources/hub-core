import type IORedis from 'ioredis'
import z from 'zod'
import { apiLogger } from '@/shared/infra/logger'
import { staleKeyOf } from './keys'

/**
 * Validade da cópia de reserva. Cobre uma queda longa do Bitrix interno sem ficar
 * servindo, por dias, uma assinatura que já mudou — e ela só é lida com o Bitrix
 * falhando, então a idade dela nunca vence a fonte quando a fonte responde.
 */
export const STALE_TTL_SECONDS = 24 * 60 * 60

export type StaleLoadResult<T> = { value: T; stale: boolean }

/**
 * Carrega da fonte; se a fonte **falhar**, devolve a cópia de reserva da chave.
 *
 * Existe porque o contexto da aplicação é lido a cada envio de mensagem: com o TTL de
 * 5 min vencido, uma instabilidade de segundos no Bitrix virava "linha não existe" e
 * a mensagem do cliente se perdia. Com a fonte respondendo, nada muda — a reserva não
 * é consultada e o cache fresco segue valendo por 5 min.
 *
 * `stale: true` diz ao chamador para **não** regravar o cache fresco com a reserva:
 * isso faria a cópia velha sobreviver mais 5 min depois de o Bitrix voltar.
 *
 * Sem reserva (ou reserva ilegível), o erro original da fonte é relançado — quem chama
 * decide o que fazer com a falha, como antes.
 */
export async function loadWithStaleFallback<T>(options: {
  redis: IORedis
  key: string
  schema: z.ZodType<T>
  family: string
  load: () => Promise<T>
}): Promise<StaleLoadResult<T>> {
  try {
    return { value: await options.load(), stale: false }
  } catch (error) {
    const reserve = await readStale(options)
    if (reserve === null) throw error

    apiLogger.warn(
      {
        app: 'payments',
        key: staleKeyOf(options.key),
        family: options.family,
        error,
      },
      `${options.family} source failed — serving stale-if-error copy`,
    )

    return { value: reserve, stale: true }
  }
}

/**
 * Grava a cópia de reserva junto com a fresca. Falha de Redis aqui é engolida: perder
 * a reserva só tira a rede de proteção da próxima queda, não a leitura de agora.
 */
export async function writeStale(
  redis: IORedis,
  key: string,
  value: unknown,
): Promise<void> {
  try {
    await redis.set(
      staleKeyOf(key),
      JSON.stringify(value),
      'EX',
      STALE_TTL_SECONDS,
    )
  } catch (error) {
    apiLogger.warn(
      { app: 'payments', key: staleKeyOf(key), error },
      'Stale-if-error cache write failed — ignoring',
    )
  }
}

async function readStale<T>(options: {
  redis: IORedis
  key: string
  schema: z.ZodType<T>
}): Promise<T | null> {
  let raw: string | null
  try {
    raw = await options.redis.get(staleKeyOf(options.key))
  } catch {
    return null
  }
  if (!raw) return null

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }

  const parsed = options.schema.safeParse(json)
  return parsed.success ? parsed.data : null
}
