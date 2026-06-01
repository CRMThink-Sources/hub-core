import type { Request, Response, NextFunction } from 'express'
import { PrismaInstalledAppRepository } from '@/shared/infra/persistence/repositories/prisma-installed-app.repository'
import { PrismaAllowedUserRepository } from '../persistence/repositories/prisma-allowed-user.repository'
import { PrismaAllowedDepartmentRepository } from '../persistence/repositories/prisma-allowed-department.repository'
import { checkThinkzapAccess } from '../../application/check-thinkzap-access'
import {
  hasThinkzapPermission,
  type ThinkzapPermissionAction,
  type ThinkzapPermissionCategory,
} from '../../domain/thinkzap-permissions'

const THINKZAP_ACCESS_DENIED = 'thinkzap_access_denied'
const THINKZAP_ADMIN_REQUIRED = 'thinkzap_admin_required'
const THINKZAP_PERMISSION_DENIED = 'thinkzap_permission_denied'

export function createThinkzapAccessMiddleware(options?: {
  requireAdmin?: boolean
}) {
  const installedAppRepo = new PrismaInstalledAppRepository()
  const allowedUserRepo = new PrismaAllowedUserRepository()
  const allowedDeptRepo = new PrismaAllowedDepartmentRepository()

  return async function thinkzapAccessMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const domainId = req.domainId
    const appCodeId = req.appId
    const bitrixUserId = req.bitrixUserId
    const isBitrixAdmin = req.isBitrixAdmin
    const bitrixDepartmentIds = req.bitrixDepartmentIds ?? []

    if (!domainId || !appCodeId || !bitrixUserId) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    const installedApp = await installedAppRepo.getByAppCodeAndDomainId(
      appCodeId,
      domainId,
    )
    if (!installedApp) {
      res.status(404).json({ error: 'App not found' })
      return
    }

    const access = await checkThinkzapAccess(
      allowedUserRepo,
      {
        installedAppId: installedApp.id,
        bitrixUserId,
        isBitrixAdmin: Boolean(isBitrixAdmin),
        bitrixDepartmentIds,
      },
      allowedDeptRepo,
    )

    if (!access) {
      res.status(403).json({ error: THINKZAP_ACCESS_DENIED })
      return
    }

    req.thinkzapInstalledAppId = installedApp.id
    req.thinkzapAccess = access

    if (options?.requireAdmin && !access.canManageAccess) {
      res.status(403).json({ error: THINKZAP_ADMIN_REQUIRED })
      return
    }

    next()
  }
}

export const thinkzapAccessMiddleware = createThinkzapAccessMiddleware()

export function requireThinkzapAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.thinkzapAccess?.canManageAccess) {
    res.status(403).json({ error: THINKZAP_ADMIN_REQUIRED })
    return
  }
  next()
}

/** Widget CRM: allow-listed users may message without connectors CRUD. */
export function requireThinkzapWidgetMessaging(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.thinkzapAccess) {
    res.status(403).json({ error: THINKZAP_ACCESS_DENIED })
    return
  }
  next()
}

export function requireThinkzapPermission(
  category: ThinkzapPermissionCategory,
  action: ThinkzapPermissionAction,
) {
  return function thinkzapPermissionGuard(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const access = req.thinkzapAccess
    if (!access) {
      res.status(403).json({ error: THINKZAP_ACCESS_DENIED })
      return
    }

    if (access.canManageAccess) {
      next()
      return
    }

    if (!hasThinkzapPermission(access.permissions, category, action)) {
      res.status(403).json({ error: THINKZAP_PERMISSION_DENIED })
      return
    }

    next()
  }
}
