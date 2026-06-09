import { NextFunction, Request, Response } from 'express'
import { IMPORTSHEET_APP_CODE_ID } from '../../importsheet.constants'

export function requireImportSheetApp(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.appId || !req.domainId) {
    res.status(400).json({ result: { error: 'Missing app context' } })
    return
  }
  if (req.appId !== IMPORTSHEET_APP_CODE_ID) {
    res.status(400).json({ result: { error: 'Not an ImportSheet app' } })
    return
  }
  next()
}
