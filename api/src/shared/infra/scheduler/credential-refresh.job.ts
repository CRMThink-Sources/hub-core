import cron from 'node-cron'
import { randomUUID } from 'crypto'
import { RefreshExpiredCredentials } from '@/shared/application/refresh-expired-credentials'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'
import { redisConnection } from '@/queue/redis-connection'

function makeRefreshExpiredCredentials(): RefreshExpiredCredentials {
  const credentialRepository = new PrismaCredentialRepository()
  const bitrixOAuthClient = new BitrixOAuthClient()

  return new RefreshExpiredCredentials(
    credentialRepository,
    bitrixOAuthClient,
    credentialRepository,
  )
}

// Lock por tick: API e worker rodam o mesmo cron, mas só um refresca por minuto
// (Bitrix rotaciona o refresh_token → refresh concorrente quebraria).
const REFRESH_LOCK_KEY = 'credential-refresh:tick'
const REFRESH_LOCK_TTL_MS = 55_000
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`

async function withRefreshLock(fn: () => Promise<void>): Promise<boolean> {
  const token = randomUUID()
  const acquired = await redisConnection.set(
    REFRESH_LOCK_KEY,
    token,
    'PX',
    REFRESH_LOCK_TTL_MS,
    'NX',
  )
  if (acquired !== 'OK') return false
  try {
    await fn()
  } finally {
    await redisConnection.eval(RELEASE_SCRIPT, 1, REFRESH_LOCK_KEY, token)
  }
  return true
}

export function startCredentialRefreshJob(): void {
  const refreshExpiredCredentials = makeRefreshExpiredCredentials()

  const defaultLogMessage = '[CredentialRefreshJob]'

  cron.schedule('*/1 * * * *', async () => {
    try {
      const ran = await withRefreshLock(() =>
        refreshExpiredCredentials.execute(),
      )
      if (!ran) {
        console.log(`${defaultLogMessage} - Skipped (another process holds tick lock)`)
      }
    } catch (error) {
      console.error(`${defaultLogMessage} - Unexpected error:`, error)
    }
  })

  console.log(`${defaultLogMessage} - Scheduled to run every 1 minute`)
}
