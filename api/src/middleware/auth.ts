import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { setLogContext } from '@/shared/infra/log-context'
import { PrismaDomainRepository } from '@/shared/infra/persistence/repositories/prisma-domain.repository'

/**
 * Middleware que resolve a instalação atual a partir do header X-Installed-App-Id.
 * Em produção você trocaria por validação do token OAuth Bitrix e lookup por domain + app.
 */
export function createAuthMiddleware() {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    const token = req.headers['authorization']?.split(' ')[1]

    if (!token) {
      res.status(401).json({ error: 'Missing Authorization header' })
      return
    }

    let decoded: {
      appCodeId: string
      domainId: string
      bitrixUserId?: string
      isBitrixAdmin?: boolean
      bitrixDepartmentIds?: string[]
    }
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET ?? '') as typeof decoded
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    req.appId = decoded.appCodeId
    req.domainId = decoded.domainId
    req.bitrixUserId = decoded.bitrixUserId
    req.isBitrixAdmin = decoded.isBitrixAdmin ?? false
    req.bitrixDepartmentIds = decoded.bitrixDepartmentIds ?? []

    if (!req.bitrixUserId) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }

    // Tenant no log (best-effort, cobre as rotas authed de todos os apps).
    setLogContext({ appId: decoded.appCodeId })
    try {
      const domain = await new PrismaDomainRepository().getDomainById(
        decoded.domainId,
      )
      if (domain) setLogContext({ domain: domain.name })
    } catch {
      // segue sem o domínio
    }

    next()
  }
}
