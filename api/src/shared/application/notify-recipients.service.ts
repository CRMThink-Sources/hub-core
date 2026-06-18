import { BitrixAppOptionService } from './bitrix-app-option.service'
import { redisConnection } from '@/queue/redis-connection'
import { apiLogger } from '@/shared/infra/logger'

export function parseUserIds(raw: string | null): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return [
      ...new Set(parsed.map(Number).filter(n => Number.isInteger(n) && n > 0)),
    ]
  } catch {
    return []
  }
}

export type NotifyRecipientsConfig = {
  /** Chave da app.option (Bitrix) onde a lista mora. */
  optionKey: string
  /** Prefixo da chave de cache Redis; vira `${cachePrefix}${appId}`. */
  cachePrefix: string
  /** TTL do cache em segundos. Default 5min. */
  cacheTtlSeconds?: number
}

const DEFAULT_CACHE_TTL_SECONDS = 5 * 60

/**
 * Lista app-level de usuários a notificar, persistida na app.option do Bitrix
 * com cache Redis na frente. Genérico: cada app injeta sua optionKey/cachePrefix.
 * `appId` = id do app instalado (core_apps.id).
 */
export class NotifyRecipientsService {
  private readonly ttl: number

  constructor(
    private readonly appOption: BitrixAppOptionService,
    private readonly appId: string,
    private readonly config: NotifyRecipientsConfig,
  ) {
    this.ttl = config.cacheTtlSeconds ?? DEFAULT_CACHE_TTL_SECONDS
  }

  async get(): Promise<number[]> {
    const cached = await this.readCache()
    if (cached !== null) return cached
    const ids = parseUserIds(await this.appOption.get(this.config.optionKey))
    await this.writeCache(ids)
    return ids
  }

  async set(userIds: number[]): Promise<number[]> {
    const clean = [
      ...new Set(userIds.map(Number).filter(n => Number.isInteger(n) && n > 0)),
    ]
    await this.appOption.set(this.config.optionKey, JSON.stringify(clean))
    await this.writeCache(clean)
    return clean
  }

  private cacheKey(): string {
    return `${this.config.cachePrefix}${this.appId}`
  }

  private async readCache(): Promise<number[] | null> {
    try {
      const raw = await redisConnection.get(this.cacheKey())
      return raw === null ? null : parseUserIds(raw)
    } catch {
      return null
    }
  }

  private async writeCache(ids: number[]): Promise<void> {
    try {
      await redisConnection.set(
        this.cacheKey(),
        JSON.stringify(ids),
        'EX',
        this.ttl,
      )
    } catch (error) {
      apiLogger.warn(
        { appId: this.appId, optionKey: this.config.optionKey, error },
        'Failed to cache notify recipients',
      )
    }
  }
}
