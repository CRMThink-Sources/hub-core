import { env } from '@/config/env'

export const appIdResolver = {
  [env.appCodes.thinkzap]: 'crmthink.thinkzap',
  [env.appCodes.thinkanalise]: 'crmthink.thinkanalise',
  [env.appCodes.importsheet]: 'crmthink.importsheet',
  [env.appCodes.clicksign]: 'crmthink.clicksign',
}
