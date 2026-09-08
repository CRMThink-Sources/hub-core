import { Controller } from '@/shared/presentation/controller'
import { makeGetAplicationContext } from '@/modules/application/main/make-get-aplication-context'
import { PrismaInstanceRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-instance.repository'
import { PrismaThinkzapMessageRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-thinkzap-message.repository'
import { GetThinkzapHomeMessageStatsController } from '../presentation/controllers/get-thinkzap-home-message-stats.controller'

export const makeGetThinkzapHomeMessageStatsController = (): Controller => {
  return new GetThinkzapHomeMessageStatsController(
    makeGetAplicationContext(),
    new PrismaInstanceRepository(),
    new PrismaThinkzapMessageRepository(),
  )
}
