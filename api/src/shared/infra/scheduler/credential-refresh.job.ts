import cron from 'node-cron'
import { RefreshExpiredCredentials } from '@/shared/application/refresh-expired-credentials'
import { PrismaCredentialRepository } from '@/shared/infra/persistence/repositories/prisma-credential.repository'
import { BitrixOAuthClient } from '@/shared/infra/clients/bitrix-oauth.client'

function makeRefreshExpiredCredentials(): RefreshExpiredCredentials {
  const credentialRepository = new PrismaCredentialRepository()
  const bitrixOAuthClient = new BitrixOAuthClient()

  return new RefreshExpiredCredentials(
    credentialRepository,
    bitrixOAuthClient,
    credentialRepository,
  )
}

export function startCredentialRefreshJob(): void {
  const refreshExpiredCredentials = makeRefreshExpiredCredentials()

  const defaultLogMessage = '[CredentialRefreshJob]'

  cron.schedule('*/1 * * * *', async () => {
    const result = console.log(
      `${defaultLogMessage} - Running credential refresh check...`,
    )
    try {
      await refreshExpiredCredentials.execute()
      console.log(`${defaultLogMessage} - Result:`, result)
    } catch (error) {
      console.error(`${defaultLogMessage} - Unexpected error:`, error)
    }
  })

  console.log(`${defaultLogMessage} - Scheduled to run every 5 minutes`)
}
