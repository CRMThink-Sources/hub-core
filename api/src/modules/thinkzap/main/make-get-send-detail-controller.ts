import type { Request } from 'express'
import { Controller } from '@/shared/presentation/controller'
import { GetSendDetail } from '@/modules/thinkzap/application/get-send-detail'
import { GetSendDetailController } from '@/modules/thinkzap/presentation/controllers/get-send-detail.controller'
import { makeSendLookups } from '@/modules/thinkzap/main/make-send-lookups'

export const makeGetSendDetailController = (req: Request): Controller => {
  const { sends, locales, lines, senderNames } = makeSendLookups(req)
  return new GetSendDetailController(
    new GetSendDetail(sends, locales, lines, senderNames),
  )
}
