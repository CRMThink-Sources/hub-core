import type { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { ListSends } from '@/modules/thinkzap/application/list-sends'
import { ListSendsController } from '@/modules/thinkzap/presentation/controllers/list-sends.controller'
import { makeSendLookups } from '@/modules/thinkzap/main/make-send-lookups'

export const makeListSendsController = (req: Request): Controller => {
  const { sends, locales, lines, senderNames } = makeSendLookups(req)
  return new ListSendsController(
    new ListSends(sends, locales, lines, senderNames),
  )
}
