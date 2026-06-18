import type IORedis from 'ioredis'
import type { BitrixClient } from '@/shared/infra/clients/bitrix.client'
import { createWorkerSourceLogger } from '@/shared/infra/logger'

const log = createWorkerSourceLogger('bitrix')
const BOT_CODE = 'thinkzap-connector'
const BOT_CACHE_TTL_SECONDS = 2592000

export async function ensureBitrixBotId(
  bitrixClient: BitrixClient,
  redis: IORedis,
  domain: string,
  appCode: string,
): Promise<number> {
  const cacheKey = `thinkzap:bot:${domain}:${appCode}`

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      return parseInt(cached, 10)
    }
  } catch (err) {
    log.warn(
      { domain, appCode, err, botIdCacheFailed: true },
      'Redis read failed for bot ID cache — fallback to Bitrix',
    )
  }

  const botId = await resolveFromBitrix(bitrixClient, domain)

  try {
    await redis.set(cacheKey, String(botId), 'EX', BOT_CACHE_TTL_SECONDS)
  } catch (err) {
    log.warn(
      { domain, appCode, err, botIdCacheFailed: true },
      'Redis write failed for bot ID cache',
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
  const existing = bots.find(b => b.code === BOT_CODE) ?? bots[0]

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
