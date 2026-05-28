import type { ThinkzapAccessResult } from '@/modules/thinkzap/application/check-thinkzap-access'

declare global {
  namespace Express {
    interface Request {
      appId?: string
      domainId?: string
      bitrixUserId?: string
      isBitrixAdmin?: boolean
      bitrixDepartmentIds?: string[]
      thinkzapInstalledAppId?: string
      thinkzapAccess?: ThinkzapAccessResult
      portalUserId?: string
      portalUserRole?: string
    }
  }
}

export {}
