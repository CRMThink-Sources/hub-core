import { env } from '@/config/env'
import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { thinkzapInboundQueue } from './thinkzap-inbound.queue'
import { importSheetRunQueue } from '@/modules/importsheet/queue/importsheet-run.queue'
import { importSheetSchedulerQueue } from '@/modules/importsheet/queue/importsheet-scheduler.queue'

const serverAdapter = new ExpressAdapter()
serverAdapter.setBasePath('/api/admin/queues')

createBullBoard({
  queues: [
    new BullMQAdapter(thinkzapInboundQueue),
    new BullMQAdapter(importSheetRunQueue),
    new BullMQAdapter(importSheetSchedulerQueue),
  ],
  serverAdapter,
})

// Bull Board express adapter does not expose a fully typed router signature.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const bullBoardRouter: RequestHandler = serverAdapter.getRouter()

export const isBullBoardEnabled = env.bullBoard.enabled

export function bullBoardAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const username = env.bullBoard.username
  const password = env.bullBoard.password

  if (!username || !password) {
    return res.status(500).json({
      message:
        'Bull Board credentials are not configured. Set BULL_BOARD_USERNAME and BULL_BOARD_PASSWORD.',
    })
  }

  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"')
    return res.status(401).send('Authentication required')
  }

  const encoded = authorization.slice('Basic '.length)
  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  const [inputUser, inputPassword] = decoded.split(':')

  if (inputUser !== username || inputPassword !== password) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"')
    return res.status(401).send('Invalid credentials')
  }

  return next()
}
