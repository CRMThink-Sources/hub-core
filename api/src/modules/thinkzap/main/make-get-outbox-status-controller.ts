import { Controller } from '@/shared/presentation/controller'
import { PrismaWidgetOutboxRepository } from '@/modules/thinkzap/infra/persistence/repositories/prisma-widget-outbox.repository'
import { GetOutboxStatusController } from '@/modules/thinkzap/presentation/controllers/get-outbox-status.controller'

export const makeGetOutboxStatusController = (): Controller =>
  new GetOutboxStatusController(new PrismaWidgetOutboxRepository())
