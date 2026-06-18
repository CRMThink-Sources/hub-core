import { NextFunction, Request, Response } from 'express'
import { CLICKSIGN_APP_CODE_ID } from '../../clicksign.constants'

export function requireClickSignApp(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.appId || !req.domainId) {
    res.status(400).json({ result: { error: 'Missing app context' } })
    return
  }
  if (req.appId !== CLICKSIGN_APP_CODE_ID) {
    res.status(400).json({ result: { error: 'Not a Clicksign app' } })
    return
  }
  next()
}
