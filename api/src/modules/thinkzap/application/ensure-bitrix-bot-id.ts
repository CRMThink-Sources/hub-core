import type IORedis from 'ioredis'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { isBitrixApiError } from '@/shared/infra/clients/bitrix-api.error'
import { createWorkerSourceLogger } from '@/shared/infra/logger'
import { logThinkzapError } from '../errors/catalog'

const log = createWorkerSourceLogger('bitrix')
const BOT_CODE = 'thinkzap-connector'
const BOT_CACHE_TTL_SECONDS = 2592000
const BOT_NOT_FOUND_CODE = 'BOT_NOT_FOUND'

function botCacheKey(domain: string, appCode: string): string {
  return `thinkzap:bot:${domain}:${appCode}`
}

/**
 * O bot cacheado não existe mais no portal (removido à mão, app reinstalado).
 *
 * Por **código**: `error_description` é traduzida pelo idioma do portal. O
 * `BitrixClient.callMethod` não preserva o código num campo — embute o corpo da
 * resposta na mensagem —, então o código também é procurado nela.
 */
export function isBotNotFoundError(error: unknown): boolean {
  if (isBitrixApiError(error)) {
    return error.code.toUpperCase() === BOT_NOT_FOUND_CODE
  }

  return error instanceof Error && error.message.includes(BOT_NOT_FOUND_CODE)
}

/**
 * Descarta o `botId` cacheado para o próximo `ensureBitrixBotId` resolver no
 * Bitrix (e registrar o bot de novo, se faltar).
 *
 * Sem isto, um bot removido do portal deixa o envio quebrado com `BOT_NOT_FOUND`
 * até o cache expirar — 30 dias —, porque nada mais reescreve a chave.
 */
export async function invalidateBitrixBotId(
  redis: IORedis,
  domain: string,
  appCode: string,
): Promise<void> {
  try {
    await redis.del(botCacheKey(domain, appCode))
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.bitrix.bot_id_failed',
      { domain, appCode, err, botIdCacheFailed: true },
      { level: 'warn', msg: 'Redis delete failed for bot ID cache' },
    )
  }
}

export async function ensureBitrixBotId(
  bitrixClient: BitrixClient,
  redis: IORedis,
  domain: string,
  appCode: string,
): Promise<number> {
  const cacheKey = botCacheKey(domain, appCode)

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return parseInt(cached, 10)
    }
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.bitrix.bot_id_failed',
      { domain, appCode, err, botIdCacheFailed: true },
      {
        level: 'warn',
        msg: 'Redis read failed for bot ID cache — fallback to Bitrix',
      },
    )
  }

  const botId = await resolveFromBitrix(bitrixClient, domain)

  try {
    await redis.set(cacheKey, String(botId), 'EX', BOT_CACHE_TTL_SECONDS)
  } catch (err) {
    logThinkzapError(
      log,
      'thinkzap.bitrix.bot_id_failed',
      { domain, appCode, err, botIdCacheFailed: true },
      { level: 'warn', msg: 'Redis write failed for bot ID cache' },
    )
  }

  return botId
}

async function resolveFromBitrix(
  bitrixClient: BitrixClient,
  domain: string,
): Promise<number> {
  const listResponse = await bitrixClient.callMethod<{
    result: { bots: Array<{ id: number; code: string }> }
  }>('imbot.v2.Bot.list', {})

  const bots = listResponse.result?.bots ?? []
  // Casa só por `code`: o portal pode ter outro bot nosso (`thinkzap-flow`, o
  // do bot-flow — ver `ensure-bot-flow-bot.ts`) já registrado, e um fallback
  // pro primeiro bot da lista pegaria esse bot errado em vez de registrar o
  // `thinkzap-connector` que falta.
  const existing = bots.find(b => b.code === BOT_CODE)

  if (existing) {
    log.debug(
      { domain, botId: existing.id },
      'Bot ID resolved from Bitrix list',
    )
    return existing.id
  }

  log.info({ domain }, 'No bot found — registering ThinkZap bot')
  const registerResponse = await bitrixClient.callMethod<{
    result: { bot: { id: number } }
  }>('imbot.v2.Bot.register', {
    fields: {
      code: BOT_CODE,
      type: 'supervisor',
      eventMode: 'fetch',
      properties: { name: 'ThinkZap' },
    },
  })

  const newBotId = registerResponse.result.bot.id
  log.info({ domain, botId: newBotId }, 'ThinkZap bot registered in Bitrix')
  return newBotId
}
