import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

type PortalJwtPayload = {
  type?: string
  portalUserId?: string
  role?: string
}

export function createPortalAuthMiddleware() {
  return function portalAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const token = req.headers.authorization?.split(' ')[1]

    if (!token) {
      res.status(401).json({ error: 'Missing Authorization header' })
      return
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET ?? '',
      ) as PortalJwtPayload

      if (decoded.type !== 'portal' || !decoded.portalUserId) {
        res.status(401).json({ error: 'Invalid or expired token' })
        return
      }

      req.portalUserId = decoded.portalUserId
      req.portalUserRole = decoded.role

      next()
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' })
    }
  }
}
