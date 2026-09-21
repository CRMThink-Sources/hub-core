import { redisConnection } from '@/queue/redis-connection'
import { apiLogger } from '@/shared/infra/logger'
import { PrismaConnectionNotifyRecipientRepository } from '../infra/persistence/repositories/prisma-connection-notify-recipient.repository'

const CACHE_PREFIX = 'thinkzap:connection-notify:'
const CACHE_TTL_SECONDS = 5 * 60

export function parseCachedUserIds(raw: string | null): number[] | null {
  if (raw === null) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter(
      (n): n is number => typeof n === 'number' && Number.isInteger(n),
    )
  } catch {
    return null
  }
}

/**
 * Lista de destinatários do aviso de conexão/desconexão, com cache Redis na frente da
 * tabela (`ThinkzapConnectionNotifyRecipient`). Mesmo formato de cache do
 * `NotifyRecipientsService` que substitui — TTL 5min, fail-open em erro de Redis —
 * só que a fonte de verdade agora é o Postgres/MySQL, não `app.option`.
 */
export class ThinkzapConnectionNotifyRecipientsService {
  constructor(
    private readonly repo: PrismaConnectionNotifyRecipientRepository,
    private readonly appId: string,
  ) {}

  async get(): Promise<number[]> {
    const cached = await this.readCache()
    if (cached !== null) return cached
    const ids = await this.repo.listByAppId(this.appId)
    await this.writeCache(ids)
    return ids
  }

  async set(userIds: number[]): Promise<number[]> {
    const saved = await this.repo.replaceAll(this.appId, userIds)
    await this.writeCache(saved)
    return saved
  }

  private cacheKey(): string {
    return `${CACHE_PREFIX}${this.appId}`
  }

  private async readCache(): Promise<number[] | null> {
    try {
      const raw = await redisConnection.get(this.cacheKey())
      return parseCachedUserIds(raw)
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
        CACHE_TTL_SECONDS,
      )
    } catch (error) {
      apiLogger.warn(
        { appId: this.appId, error },
        'Failed to cache connection notify recipients',
      )
    }
  }
}
