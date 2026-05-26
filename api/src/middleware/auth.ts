import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
/**
 * Middleware que resolve a instalação atual a partir do header X-Installed-App-Id.
 * Em produção você trocaria por validação do token OAuth Bitrix e lookup por domain + app.
 */
export function createAuthMiddleware() {
  return function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const token = req.headers['authorization']?.split(' ')[1]

    if (!token) {
      res.status(401).json({ error: 'Missing Authorization header' })
      return
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET ?? '') as {
      appCodeId: string
      domainId: string
      bitrixUserId?: string
      isBitrixAdmin?: boolean
      bitrixDepartmentIds?: string[]
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

    next()
  }
}
